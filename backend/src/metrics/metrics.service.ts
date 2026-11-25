import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { monitorEventLoopDelay, type ELDHistogram } from 'node:perf_hooks';

const WINDOW_MS = 5_000;
const NS_PER_MS = 1e6;
/**
 * The monitor samples on a timer this often, and its readings include that
 * interval, so an idle loop reads about 10 ms. Subtracting it reports the real
 * delay: how long a ready callback waited.
 */
const LOOP_RESOLUTION_MS = 10;
const loopDelayMs = (ns: number) => Math.max(0, ns / NS_PER_MS - LOOP_RESOLUTION_MS);

interface Counters {
  ticks: number;
  framesSent: number;
  quotesSent: number;
  bytesSent: number;
  broadcastMsTotal: number;
  broadcastMsMax: number;
}

export interface WindowStats {
  seconds: number;
  ticksPerSec: number;
  framesPerSec: number;
  quotesPerSec: number;
  kbPerSec: number;
  /** Time spent fanning one tick out to every watcher. */
  broadcastMs: { avg: number; max: number };
  /** How late timers fire: the server's responsiveness under load. */
  eventLoopDelayMs: { p50: number; p99: number; max: number };
  /** Share of one CPU core used by this process. */
  cpuPercent: number;
}

const zero = (): Counters => ({
  ticks: 0,
  framesSent: 0,
  quotesSent: 0,
  bytesSent: 0,
  broadcastMsTotal: 0,
  broadcastMsMax: 0,
});

const round = (n: number, digits = 1) => Number(n.toFixed(digits));

/**
 * Cheap, always-on counters for the streaming path, rolled up every five
 * seconds. Recording is a few integer additions, so it costs nothing on the
 * hot path; `GET /api/metrics` reads the last complete window.
 */
@Injectable()
export class MetricsService implements OnModuleDestroy {
  readonly totals: Counters = zero();
  private window: Counters = zero();
  private last: WindowStats | null = null;
  private readonly loop: ELDHistogram = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });
  private cpuAt = process.cpuUsage();
  private windowStartedAt = performance.now();
  private readonly timer: NodeJS.Timeout;
  slowClientsDropped = 0;

  constructor() {
    this.loop.enable();
    this.timer = setInterval(() => this.roll(), WINDOW_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
    this.loop.disable();
  }

  recordTick(broadcastMs: number): void {
    for (const c of [this.totals, this.window]) {
      c.ticks += 1;
      c.broadcastMsTotal += broadcastMs;
      if (broadcastMs > c.broadcastMsMax) c.broadcastMsMax = broadcastMs;
    }
  }

  recordFrame(quotes: number, bytes: number): void {
    for (const c of [this.totals, this.window]) {
      c.framesSent += 1;
      c.quotesSent += quotes;
      c.bytesSent += bytes;
    }
  }

  lastWindow(): WindowStats | null {
    return this.last;
  }

  private roll(): void {
    const now = performance.now();
    const seconds = (now - this.windowStartedAt) / 1000;
    const cpu = process.cpuUsage(this.cpuAt);
    const w = this.window;
    this.last = {
      seconds: round(seconds),
      ticksPerSec: round(w.ticks / seconds),
      framesPerSec: round(w.framesSent / seconds),
      quotesPerSec: round(w.quotesSent / seconds),
      kbPerSec: round(w.bytesSent / 1024 / seconds),
      broadcastMs: {
        avg: round(w.ticks ? w.broadcastMsTotal / w.ticks : 0, 2),
        max: round(w.broadcastMsMax, 2),
      },
      eventLoopDelayMs: {
        p50: round(loopDelayMs(this.loop.percentile(50))),
        p99: round(loopDelayMs(this.loop.percentile(99))),
        max: round(loopDelayMs(this.loop.max)),
      },
      cpuPercent: round(((cpu.user + cpu.system) / 1000 / (seconds * 1000)) * 100),
    };
    this.window = zero();
    this.loop.reset();
    this.cpuAt = process.cpuUsage();
    this.windowStartedAt = now;
  }
}
