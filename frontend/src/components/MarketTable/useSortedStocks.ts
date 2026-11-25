import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { orderSymbols, type SortState } from '../../lib/sort';
import type { Stock } from '../../lib/types';
import { useMarketServices } from '../../store/hooks';

const SEPARATOR = '\n';

/**
 * How often a live sort may re-order rows. Rows that jump more often than
 * this can't be read, and each re-order moves DOM nodes and re-lays out the
 * grid, which is what slow phones struggle with under burst load.
 */
export const RESORT_INTERVAL_MS = 500;

/**
 * Returns the stocks in display order, keeping live sorts live.
 *
 * The snapshot is the order itself, joined into one string. React compares it
 * by value, so the table re-renders only when a price change actually moves a
 * row. Rows are memoised and keyed, so a move shifts DOM nodes without
 * re-rendering a single cell.
 *
 * Re-sorting is throttled: the first price change after a quiet spell
 * re-sorts at once, later ones are folded into at most one re-sort per
 * {@link RESORT_INTERVAL_MS}, and a trailing re-sort always catches up.
 */
export function useSortedStocks(stocks: readonly Stock[], sort: SortState | null): readonly Stock[] {
  const { store } = useMarketServices();
  const liveField = sort && sort.key !== 'symbol' ? sort.key : null;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!liveField) return () => {};
      let timer = 0;
      let lastRun = -Infinity;
      const run = () => {
        timer = 0;
        lastRun = performance.now();
        onChange();
      };
      const unsubscribe = store.subscribeField(liveField, () => {
        if (timer) return;
        const wait = Math.max(0, lastRun + RESORT_INTERVAL_MS - performance.now());
        timer = window.setTimeout(run, wait);
      });
      return () => {
        unsubscribe();
        window.clearTimeout(timer);
      };
    },
    [store, liveField],
  );

  const orderKey = useSyncExternalStore(subscribe, () =>
    orderSymbols(
      stocks.map((s) => s.symbol),
      sort,
      (symbol, field) => store.get(symbol, field),
    ).join(SEPARATOR),
  );

  return useMemo(() => {
    if (!orderKey) return [];
    const bySymbol = new Map(stocks.map((s) => [s.symbol, s]));
    return orderKey.split(SEPARATOR).flatMap((symbol) => bySymbol.get(symbol) ?? []);
  }, [orderKey, stocks]);
}
