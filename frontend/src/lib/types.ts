/** A listed stock: the part that never changes. */
export interface Stock {
  symbol: string;
  company: string;
}

/** Live values for one stock. */
export interface Quote {
  symbol: string;
  ltp: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  high52: number;
  low52: number;
}

/** The fields of a quote that can change and be shown in a cell. */
export type QuoteField = Exclude<keyof Quote, 'symbol'>;

export const QUOTE_FIELDS: readonly QuoteField[] = [
  'ltp',
  'changePct',
  'dayHigh',
  'dayLow',
  'volume',
  'high52',
  'low52',
];

/** Compact shape sent by the server (see backend `gateway/protocol.ts`). */
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

export type ServerFrame =
  | { t: 'hello'; ts: number; tickMs: number }
  | { t: 'snapshot'; ts: number; q: WireQuote[] }
  | { t: 'tick'; ts: number; q: WireQuote[] };

export type ConnectionStatus = 'connecting' | 'live' | 'offline';

export interface StockCatalog {
  stocks: Stock[];
  defaults: string[];
}

export function fromWire(w: WireQuote): Quote {
  return {
    symbol: w.s,
    ltp: w.ltp,
    changePct: w.chg,
    dayHigh: w.dh,
    dayLow: w.dl,
    volume: w.vol,
    high52: w.h52,
    low52: w.l52,
  };
}
