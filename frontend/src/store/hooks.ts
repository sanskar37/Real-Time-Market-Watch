import { useCallback, useContext, useSyncExternalStore } from 'react';
import type { QuoteField } from '../lib/types';
import { MarketContext, type MarketServices } from './context';

export function useMarketServices(): MarketServices {
  const services = useContext(MarketContext);
  if (!services) throw new Error('useMarketServices must be used inside <MarketProvider>');
  return services;
}

/**
 * Reads one value from the store and re-renders only when that value changes.
 * The snapshot is a primitive, so React can compare it directly.
 */
export function useQuoteValue(symbol: string, field: QuoteField): number | undefined {
  const { store } = useMarketServices();
  const subscribe = useCallback(
    (onChange: () => void) => store.subscribe(symbol, field, onChange),
    [store, symbol, field],
  );
  return useSyncExternalStore(subscribe, () => store.get(symbol, field));
}

/**
 * Like {@link useQuoteValue}, but the snapshot is the formatted text. A volume
 * moving from 12,500,010 to 12,500,020 still reads "12.5M", so the cell skips
 * the render entirely.
 */
export function useQuoteText(
  symbol: string,
  field: QuoteField,
  format: (value: number) => string,
): string | undefined {
  const { store } = useMarketServices();
  const subscribe = useCallback(
    (onChange: () => void) => store.subscribe(symbol, field, onChange),
    [store, symbol, field],
  );
  return useSyncExternalStore(subscribe, () => {
    const value = store.get(symbol, field);
    return value === undefined ? undefined : format(value);
  });
}

export function useConnectionStatus() {
  const { socket } = useMarketServices();
  return useSyncExternalStore(socket.subscribeStatus, socket.getStatus);
}
