import type { Quote } from '../market/market.types';

/**
 * Wire format. Clients send Nest's standard `{ event, data }` envelope;
 * the server replies with small tagged frames (`t`).
 *
 *   client -> server  { event: 'subscribe',   data: { symbols: string[] } }
 *                     { event: 'unsubscribe', data: { symbols: string[] } }
 *                     { event: 'refresh' }
 *
 *   server -> client  { t: 'hello',    ts, tickMs }
 *                     { t: 'snapshot', ts, q: Quote[] }   full state, on subscribe/refresh
 *                     { t: 'tick',     ts, q: Quote[] }   only quotes that moved
 */
export interface WireQuote {
  s: string;
  ltp: number;
  chg: number;
  dh: number;
  dl: number;
  vol: number;
  h52: number;
  l52: number;
}

export function toWire(quote: Quote): WireQuote {
  return {
    s: quote.symbol,
    ltp: quote.ltp,
    chg: quote.changePct,
    dh: quote.dayHigh,
    dl: quote.dayLow,
    vol: quote.volume,
    h52: quote.high52,
    l52: quote.low52,
  };
}

/** Frames are assembled from pre-serialised quote strings so each quote is stringified once per tick. */
export function frame(type: 'snapshot' | 'tick', ts: number, serialisedQuotes: Iterable<string>): string {
  return `{"t":"${type}","ts":${ts},"q":[${Array.from(serialisedQuotes).join(',')}]}`;
}

export function helloFrame(ts: number, tickMs: number): string {
  return JSON.stringify({ t: 'hello', ts, tickMs });
}

/** Pulls a clean list of symbol strings out of an untrusted message body. */
export function parseSymbols(data: unknown, limit: number): string[] {
  if (typeof data !== 'object' || data === null) return [];
  const raw = (data as { symbols?: unknown }).symbols;
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const item of raw) {
    if (typeof item === 'string' && item.length > 0 && item.length <= 32) out.add(item);
    if (out.size >= limit) break;
  }
  return [...out];
}
