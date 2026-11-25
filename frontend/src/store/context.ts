import { createContext } from 'react';
import type { MarketSocket } from '../services/marketSocket';
import type { MarketStore } from './marketStore';

/** The page-wide store and socket, created once in `main.tsx`. */
export interface MarketServices {
  store: MarketStore;
  socket: MarketSocket;
}

export const MarketContext = createContext<MarketServices | null>(null);
