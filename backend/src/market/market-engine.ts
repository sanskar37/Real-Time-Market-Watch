import type { Quote, StockSeed } from './market.types';

export interface EngineOptions {
  /** Fraction of stocks that move on every step. */
  updateRatio: number;
  /** Max relative move per update (0.001 = 0.1%). */
  volatility: number;
  /** Smallest price increment. NSE equities trade in steps of 0.05. */
  tickSize?: number;
}

interface StockState {
  quote: Quote;
  /** Close of the previous session; change % is measured against it. */
  prevClose: number;
  /** Where prices drift back to, so they never wander off for good. */
  anchor: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * The pure market model. It knows nothing about timers, sockets or Nest, so it
 * can be driven step by step in tests with a seeded random source.
 */
export class MarketEngine {
  private readonly states: StockState[];
  private readonly bySymbol = new Map<string, StockState>();
  private readonly tickSize: number;

  constructor(
    seeds: readonly StockSeed[],
    private readonly options: EngineOptions,
    private readonly random: () => number = Math.random,
  ) {
    this.tickSize = options.tickSize ?? 0.05;
    this.states = seeds.map((seed) => {
      const quote: Quote = {
        symbol: seed.symbol,
        ltp: seed.ltp,
        changePct: seed.changePct,
        dayHigh: seed.dayHigh,
        dayLow: seed.dayLow,
        volume: seed.volume,
        high52: seed.high52,
        low52: seed.low52,
      };
      const state: StockState = {
        quote,
        prevClose: round2(seed.ltp / (1 + seed.changePct / 100)),
        anchor: seed.ltp,
      };
      this.bySymbol.set(seed.symbol, state);
      return state;
    });
  }

  get size(): number {
    return this.states.length;
  }

  has(symbol: string): boolean {
    return this.bySymbol.has(symbol);
  }

  /** Current quote for a symbol. Returns a copy, never the live object. */
  quote(symbol: string): Quote | undefined {
    const state = this.bySymbol.get(symbol);
    return state ? { ...state.quote } : undefined;
  }

  /** Advances the market one step and returns copies of the quotes that moved. */
  step(): Quote[] {
    const changed: Quote[] = [];
    for (const state of this.states) {
      if (this.random() > this.options.updateRatio) continue;
      this.move(state);
      changed.push({ ...state.quote });
    }
    return changed;
  }

  private move(state: StockState): void {
    const { quote, anchor, prevClose } = state;
    const { volatility } = this.options;

    // A bell-shaped shock in (-1, 1), plus a faint pull back toward the anchor.
    const shock = (this.random() + this.random() + this.random() - 1.5) / 1.5;
    const pull = ((anchor - quote.ltp) / anchor) * 0.02;
    const relative = shock * volatility + pull;

    let steps = Math.round((quote.ltp * relative) / this.tickSize);
    if (steps === 0) steps = this.random() < 0.5 ? -1 : 1;

    const next = Math.max(this.tickSize, round2(quote.ltp + steps * this.tickSize));
    quote.ltp = next;
    quote.changePct = round2(((next - prevClose) / prevClose) * 100);
    if (next > quote.dayHigh) quote.dayHigh = next;
    if (next < quote.dayLow) quote.dayLow = next;
    if (next > quote.high52) quote.high52 = next;
    if (next < quote.low52) quote.low52 = next;

    // Every price update comes with some trades.
    quote.volume += 25 + Math.floor(this.random() * 2_500);
  }
}
