import { QUOTE_FIELDS, type Quote, type QuoteField } from '../lib/types';

type Listener = () => void;

const keyOf = (symbol: string, field: QuoteField): string => `${symbol}:${field}`;

/**
 * Holds the latest quote for every watched stock, outside React.
 *
 * Each table cell subscribes to exactly one `symbol:field` key. When new data
 * arrives, the store compares it with what it already has and wakes up only
 * the cells whose own value changed. That is the whole rendering strategy:
 * no row, table or page component re-renders when a price ticks.
 */
export class MarketStore {
  private readonly quotes = new Map<string, Quote>();
  private readonly tracked = new Set<string>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly fieldListeners = new Map<QuoteField, Set<Listener>>();

  /** Reads one value. `undefined` means the first snapshot has not arrived yet. */
  get(symbol: string, field: QuoteField): number | undefined {
    return this.quotes.get(symbol)?.[field];
  }

  /** Subscribes to one cell's value. Returns the unsubscribe function. */
  subscribe(symbol: string, field: QuoteField, listener: Listener): () => void {
    const key = keyOf(symbol, field);
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(key);
    };
  }

  /**
   * Subscribes to one field across every stock, e.g. "any LTP changed".
   * Used by sorting, which only needs to know that the order may have changed.
   */
  subscribeField(field: QuoteField, listener: Listener): () => void {
    let set = this.fieldListeners.get(field);
    if (!set) this.fieldListeners.set(field, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.fieldListeners.delete(field);
    };
  }

  /** Declares which symbols are on screen. Data for any other symbol is ignored. */
  track(symbols: Iterable<string>): void {
    const next = new Set(symbols);
    for (const symbol of this.tracked) {
      if (!next.has(symbol)) this.quotes.delete(symbol);
    }
    this.tracked.clear();
    for (const symbol of next) this.tracked.add(symbol);
  }

  /** Merges quotes from the server and notifies only the cells that changed. */
  apply(incoming: readonly Quote[]): void {
    for (const quote of incoming) {
      if (!this.tracked.has(quote.symbol)) continue;
      const current = this.quotes.get(quote.symbol);
      if (!current) {
        this.quotes.set(quote.symbol, { ...quote });
        for (const field of QUOTE_FIELDS) this.notify(quote.symbol, field);
        continue;
      }
      for (const field of QUOTE_FIELDS) {
        if (current[field] === quote[field]) continue;
        current[field] = quote[field];
        this.notify(quote.symbol, field);
      }
    }
  }

  private notify(symbol: string, field: QuoteField): void {
    const cell = this.listeners.get(keyOf(symbol, field));
    if (cell) for (const listener of cell) listener();
    const column = this.fieldListeners.get(field);
    if (column) for (const listener of column) listener();
  }
}
