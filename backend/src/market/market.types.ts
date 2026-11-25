/** Static, never-changing details about a listed stock. */
export interface StockInfo {
  symbol: string;
  company: string;
}

/** The full set of live values for one stock. Plain numbers, never formatted. */
export interface Quote {
  symbol: string;
  /** Last traded price, in rupees. */
  ltp: number;
  /** Percentage change versus the previous close. */
  changePct: number;
  dayHigh: number;
  dayLow: number;
  /** Shares traded today. */
  volume: number;
  high52: number;
  low52: number;
}

/** What one simulation tick produced. */
export interface TickResult {
  /** Epoch milliseconds when the tick was produced. */
  ts: number;
  /** Only the quotes that actually moved. */
  changed: Quote[];
}

export type TickListener = (tick: TickResult) => void;

/** Starting values for a stock before the simulation moves it. */
export interface StockSeed extends StockInfo {
  ltp: number;
  /** Change versus previous close at start-up, in percent. */
  changePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  high52: number;
  low52: number;
}
