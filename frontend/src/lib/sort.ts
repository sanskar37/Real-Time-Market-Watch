import type { QuoteField } from './types';

/** The columns that carry sort arrows in the reference design. */
export type SortKey = 'symbol' | 'ltp' | 'changePct';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

/**
 * Click cycle for a header. Prices start highest-first (top gainers, costliest
 * stocks); Symbol starts A to Z. The third click returns to the user's own order.
 */
export function nextSort(current: SortState | null, key: SortKey): SortState | null {
  const first: SortDirection = key === 'symbol' ? 'asc' : 'desc';
  if (!current || current.key !== key) return { key, direction: first };
  if (current.direction === first) return { key, direction: first === 'asc' ? 'desc' : 'asc' };
  return null;
}

/**
 * Orders symbols for display. Ties, and stocks still waiting for their first
 * price, keep the order the user picked them in, so rows never shuffle for no reason.
 */
export function orderSymbols(
  symbols: readonly string[],
  sort: SortState | null,
  valueOf: (symbol: string, field: QuoteField) => number | undefined,
): string[] {
  if (!sort) return [...symbols];
  const position = new Map(symbols.map((symbol, i) => [symbol, i]));
  const byPosition = (a: string, b: string) => position.get(a)! - position.get(b)!;
  const sign = sort.direction === 'asc' ? 1 : -1;

  if (sort.key === 'symbol') {
    return [...symbols].sort((a, b) => sign * a.localeCompare(b) || byPosition(a, b));
  }

  const field = sort.key;
  return [...symbols].sort((a, b) => {
    const va = valueOf(a, field);
    const vb = valueOf(b, field);
    if (va === undefined || vb === undefined) {
      return (va === undefined ? 1 : 0) - (vb === undefined ? 1 : 0) || byPosition(a, b);
    }
    return sign * (va - vb) || byPosition(a, b);
  });
}
