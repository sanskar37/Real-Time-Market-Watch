import { Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { WebSocket } from 'ws';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { MarketSimulatorService } from '../market/market-simulator.service';
import type { TickResult } from '../market/market.types';
import { MetricsService } from '../metrics/metrics.service';
import { frame, helloFrame, parseSymbols, toWire } from './protocol';
import { ClientSession, SubscriptionRegistry } from './subscription-registry';

const OPEN = 1; // WebSocket.OPEN

/**
 * Streams quotes to browsers.
 *
 * Every tick is handled in three steps:
 *   1. each moved quote is serialised once,
 *   2. it is queued for just the sessions watching that symbol,
 *   3. each session with something queued gets one batched frame.
 *
 * A socket that cannot keep up keeps its queue (newest value per symbol wins)
 * instead of being flooded, and is dropped if the backlog becomes absurd.
 */
@WebSocketGateway({ path: '/ws' })
export class MarketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(MarketGateway.name);
  private readonly registry = new SubscriptionRegistry<WebSocket>();
  private readonly dirty = new Set<ClientSession<WebSocket>>();
  private heartbeat?: NodeJS.Timeout;
  private unsubscribeTicks?: () => void;

  constructor(
    private readonly simulator: MarketSimulatorService,
    private readonly metrics: MetricsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get connections(): number {
    return this.registry.size;
  }

  /** Total stock subscriptions across every connected user. */
  get subscriptions(): number {
    return this.registry.subscriptionCount;
  }

  afterInit(): void {
    this.unsubscribeTicks = this.simulator.onTick((tick) => this.broadcast(tick));
    this.heartbeat = setInterval(() => this.sweepDeadSockets(), this.config.heartbeatSeconds * 1000);
    this.heartbeat.unref();
  }

  onModuleDestroy(): void {
    this.unsubscribeTicks?.();
    if (this.heartbeat) clearInterval(this.heartbeat);
  }

  handleConnection(socket: WebSocket): void {
    const session = this.registry.open(socket);
    socket.on('pong', () => {
      session.isAlive = true;
    });
    socket.send(helloFrame(Date.now(), this.config.tickIntervalMs));
  }

  handleDisconnect(socket: WebSocket): void {
    const session = this.registry.get(socket);
    if (session) this.dirty.delete(session);
    this.registry.close(socket);
  }

  @SubscribeMessage('subscribe')
  onSubscribe(@ConnectedSocket() socket: WebSocket, @MessageBody() body: unknown): void {
    const session = this.registry.get(socket);
    if (!session) return;
    const wanted = parseSymbols(body, this.simulator.stocks().length).filter((s) => this.simulator.has(s));
    const added = this.registry.subscribe(session, wanted);
    if (added.length > 0) this.sendSnapshot(session, added);
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(@ConnectedSocket() socket: WebSocket, @MessageBody() body: unknown): void {
    const session = this.registry.get(socket);
    if (!session) return;
    this.registry.unsubscribe(session, parseSymbols(body, this.simulator.stocks().length));
  }

  @SubscribeMessage('refresh')
  onRefresh(@ConnectedSocket() socket: WebSocket): void {
    const session = this.registry.get(socket);
    if (!session || session.symbols.size === 0) return;
    session.pending.clear();
    this.sendSnapshot(session, [...session.symbols]);
  }

  private sendSnapshot(session: ClientSession<WebSocket>, symbols: readonly string[]): void {
    const quotes: string[] = [];
    for (const symbol of symbols) {
      const quote = this.simulator.quote(symbol);
      if (quote) quotes.push(JSON.stringify(toWire(quote)));
    }
    if (quotes.length > 0 && session.socket.readyState === OPEN) {
      this.send(session.socket, frame('snapshot', Date.now(), quotes), quotes.length);
    }
  }

  private broadcast({ ts, changed }: TickResult): void {
    if (this.registry.size === 0) return;
    const started = performance.now();

    for (const quote of changed) {
      const watchers = this.registry.watchersOf(quote.symbol);
      if (!watchers) continue;
      const json = JSON.stringify(toWire(quote)); // once per quote, shared by every watcher
      for (const session of watchers) {
        session.pending.set(quote.symbol, json);
        this.dirty.add(session);
      }
    }

    for (const session of this.dirty) this.flush(session, ts);
    this.metrics.recordTick(performance.now() - started);
  }

  private send(socket: WebSocket, payload: string, quotes: number): void {
    socket.send(payload);
    this.metrics.recordFrame(quotes, payload.length);
  }

  private flush(session: ClientSession<WebSocket>, ts: number): void {
    const { socket } = session;
    if (socket.readyState !== OPEN) {
      this.dirty.delete(session);
      return;
    }
    const queued = socket.bufferedAmount;
    if (queued > this.config.maxBufferedBytes) {
      this.logger.warn(`Dropping slow client (${queued} bytes queued)`);
      this.metrics.slowClientsDropped += 1;
      this.dirty.delete(session);
      socket.terminate();
      return;
    }
    if (queued > this.config.highWaterBytes) return; // try again next tick; pending keeps the latest values

    this.send(socket, frame('tick', ts, session.pending.values()), session.pending.size);
    session.pending.clear();
    this.dirty.delete(session);
  }

  /** Ping everyone; anyone who never answered the last ping is gone. */
  private sweepDeadSockets(): void {
    for (const session of this.registry.all()) {
      if (!session.isAlive) {
        session.socket.terminate();
        continue;
      }
      session.isAlive = false;
      session.socket.ping();
    }
  }
}
