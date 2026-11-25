/** Injection token for the validated runtime configuration. */
export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  /** HTTP + WebSocket port. */
  port: number;
  /** Origin allowed by CORS. `*` allows any. */
  corsOrigin: string;
  /** Number of stocks to simulate (N). Real NSE names first, synthetic after. */
  stockCount: number;
  /** Milliseconds between simulation ticks. */
  tickIntervalMs: number;
  /** Fraction (0-1] of stocks that receive a new price on every tick. */
  updateRatio: number;
  /** Max relative price move per update (0.001 = 0.1%). */
  volatility: number;
  /** Start the ticker on boot. Disable for deterministic screenshots. */
  autoStart: boolean;
  /** Seconds between WebSocket liveness pings. */
  heartbeatSeconds: number;
  /** Pause sending to a socket once this many bytes are queued (backpressure). */
  highWaterBytes: number;
  /** Terminate a socket whose queue grows beyond this many bytes. */
  maxBufferedBytes: number;
}

type Env = Record<string, string | undefined>;

function readNumber(env: Env, key: string, fallback: number, min: number, max: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${key} must be a number between ${min} and ${max}, got "${raw}"`);
  }
  return value;
}

function readBoolean(env: Env, key: string, fallback: boolean): boolean {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

/** Reads and validates configuration from environment variables. */
export function loadConfig(env: Env = process.env): AppConfig {
  return {
    port: readNumber(env, 'PORT', 3000, 1, 65535),
    corsOrigin: env.CORS_ORIGIN || '*',
    stockCount: readNumber(env, 'STOCK_COUNT', 30, 1, 5000),
    tickIntervalMs: readNumber(env, 'TICK_INTERVAL_MS', 500, 20, 60_000),
    updateRatio: readNumber(env, 'UPDATE_RATIO', 0.4, 0.01, 1),
    volatility: readNumber(env, 'VOLATILITY', 0.0012, 0.00001, 0.05),
    autoStart: readBoolean(env, 'SIM_AUTOSTART', true),
    heartbeatSeconds: readNumber(env, 'HEARTBEAT_SECONDS', 30, 1, 600),
    highWaterBytes: readNumber(env, 'WS_HIGH_WATER_BYTES', 256 * 1024, 1024, 64 * 1024 * 1024),
    maxBufferedBytes: readNumber(env, 'WS_MAX_BUFFERED_BYTES', 4 * 1024 * 1024, 4096, 256 * 1024 * 1024),
  };
}
