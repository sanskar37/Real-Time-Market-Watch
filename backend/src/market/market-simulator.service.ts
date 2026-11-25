import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { MarketEngine } from './market-engine';
import type { Quote, StockInfo, TickListener } from './market.types';
import { buildCatalog } from './stock-catalog';

/**
 * Owns the market model and the clock that drives it. Anything that wants live
 * prices registers a listener with {@link onTick}; the simulator knows nothing
 * about who is listening or how they are connected.
 */
@Injectable()
export class MarketSimulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketSimulatorService.name);
  private readonly engine: MarketEngine;
  private readonly stockList: StockInfo[];
  private readonly listeners = new Set<TickListener>();
  private timer?: NodeJS.Timeout;
  private tickCount = 0;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    const seeds = buildCatalog(config.stockCount);
    this.stockList = seeds.map(({ symbol, company }) => ({ symbol, company }));
    this.engine = new MarketEngine(seeds, {
      updateRatio: config.updateRatio,
      volatility: config.volatility,
    });
  }

  onModuleInit(): void {
    if (this.config.autoStart) this.start();
    else this.logger.warn('Simulation is paused (SIM_AUTOSTART=false)');
  }

  onModuleDestroy(): void {
    this.stop();
  }

  get ticks(): number {
    return this.tickCount;
  }

  get running(): boolean {
    return this.timer !== undefined;
  }

  /** Starts the clock. Calling it twice is harmless. */
  start(): void {
    if (this.timer) return;
    const interval = this.config.tickIntervalMs;
    let nextAt = Date.now() + interval;

    const loop = (): void => {
      this.tick();
      // Aim for the next slot on the grid so slow ticks do not stretch the cadence.
      nextAt += interval;
      const delay = Math.max(0, nextAt - Date.now());
      if (delay === 0) nextAt = Date.now() + interval;
      this.timer = setTimeout(loop, delay);
    };

    this.timer = setTimeout(loop, interval);
    this.logger.log(`Simulating ${this.engine.size} stocks every ${interval}ms`);
  }

  stop(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Runs one step now. Public so tests can drive the market by hand. */
  tick(): void {
    const changed = this.engine.step();
    this.tickCount += 1;
    if (changed.length === 0 || this.listeners.size === 0) return;
    const tick = { ts: Date.now(), changed };
    for (const listener of this.listeners) listener(tick);
  }

  /** Subscribes to ticks. Returns the function that unsubscribes. */
  onTick(listener: TickListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  stocks(): readonly StockInfo[] {
    return this.stockList;
  }

  has(symbol: string): boolean {
    return this.engine.has(symbol);
  }

  quote(symbol: string): Quote | undefined {
    return this.engine.quote(symbol);
  }
}
