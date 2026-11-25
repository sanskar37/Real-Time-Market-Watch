import type { MarketStore } from '../store/marketStore';
import { fromWire, type ConnectionStatus, type ServerFrame } from '../lib/types';

type StatusListener = () => void;

const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 15_000;

/** Default endpoint: same origin, so the dev proxy and a production reverse proxy both work. */
export function defaultSocketUrl(): string {
  const override = import.meta.env.VITE_WS_URL as string | undefined;
  if (override) return override;
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/ws`;
}

/**
 * One WebSocket for the whole screen.
 *
 * It remembers which symbols the user wants (`desired`), so a reconnect simply
 * says it again. Messages from the server go straight into the store.
 */
export class MarketSocket {
  private socket?: WebSocket;
  private status: ConnectionStatus = 'connecting';
  private readonly statusListeners = new Set<StatusListener>();
  private readonly desired = new Set<string>();
  private attempts = 0;
  private retryTimer?: number;
  private stopped = false;
  private serverOffsetMs = 0;

  constructor(
    private readonly url: string,
    private readonly store: MarketStore,
  ) {}

  /** Server time now, estimated from the clock offset learned on connect. */
  serverNow(): number {
    return Date.now() + this.serverOffsetMs;
  }

  getStatus = (): ConnectionStatus => this.status;

  subscribeStatus = (listener: StatusListener): (() => void) => {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  };

  connect(): void {
    this.stopped = false;
    this.open();
  }

  disconnect(): void {
    this.stopped = true;
    window.clearTimeout(this.retryTimer);
    this.socket?.close();
    this.socket = undefined;
  }

  /** Tells the server which stocks this user watches, sending only what changed. */
  setSymbols(symbols: readonly string[]): void {
    const next = new Set(symbols);
    const added = [...next].filter((s) => !this.desired.has(s));
    const removed = [...this.desired].filter((s) => !next.has(s));
    this.desired.clear();
    next.forEach((s) => this.desired.add(s));

    if (removed.length > 0) this.send('unsubscribe', { symbols: removed });
    if (added.length > 0) this.send('subscribe', { symbols: added });
  }

  /** Asks for fresh values now; reconnects first if the link is down. */
  refresh(): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.send('refresh');
    else this.reconnectNow();
  }

  private open(): void {
    this.setStatus('connecting');
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.setStatus('live');
      if (this.desired.size > 0) this.send('subscribe', { symbols: [...this.desired] });
    };
    socket.onmessage = (event: MessageEvent<string>) => this.handle(event.data);
    socket.onclose = () => {
      if (this.socket !== socket) return; // a newer socket has replaced this one
      this.setStatus('offline');
      if (!this.stopped) this.scheduleRetry();
    };
    socket.onerror = () => socket.close();
  }

  private handle(raw: string): void {
    let frame: ServerFrame;
    try {
      frame = JSON.parse(raw) as ServerFrame;
    } catch {
      return;
    }
    switch (frame.t) {
      case 'hello':
        this.serverOffsetMs = frame.ts - Date.now();
        break;
      case 'snapshot':
      case 'tick':
        this.store.apply(frame.q.map(fromWire));
        break;
    }
  }

  private reconnectNow(): void {
    window.clearTimeout(this.retryTimer);
    const old = this.socket;
    this.socket = undefined;
    old?.close();
    this.attempts = 0;
    this.open();
  }

  private scheduleRetry(): void {
    const ceiling = Math.min(MAX_DELAY_MS, MIN_DELAY_MS * 2 ** this.attempts);
    const delay = ceiling / 2 + Math.random() * (ceiling / 2); // jitter spreads out a reconnect stampede
    this.attempts += 1;
    this.retryTimer = window.setTimeout(() => this.open(), delay);
  }

  private send(event: string, data?: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ event, data }));
  }

  private setStatus(next: ConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.statusListeners.forEach((listener) => listener());
  }
}
