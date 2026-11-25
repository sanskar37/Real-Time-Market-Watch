import type { ReactNode } from 'react';
import { MarketContext, type MarketServices } from './context';

export function MarketProvider({ value, children }: { value: MarketServices; children: ReactNode }) {
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}
