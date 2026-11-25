import { describe, expect, it, vi } from 'vitest';
import type { Quote } from '../lib/types';
import { MarketStore } from './marketStore';

const tcs: Quote = {
  symbol: 'TCS',
  ltp: 3467.8,
  changePct: 1.21,
  dayHigh: 3480,
  dayLow: 3420.5,
  volume: 8_700_000,
  high52: 3950,
  low52: 2850.1,
};

function storeWith(...symbols: string[]) {
  const store = new MarketStore();
  store.track(symbols);
  return store;
}

describe('MarketStore', () => {
  it('wakes every field of a stock when its first snapshot arrives', () => {
    const store = storeWith('TCS');
    const ltp = vi.fn();
    const volume = vi.fn();
    store.subscribe('TCS', 'ltp', ltp);
    store.subscribe('TCS', 'volume', volume);

    store.apply([tcs]);

    expect(ltp).toHaveBeenCalledTimes(1);
    expect(volume).toHaveBeenCalledTimes(1);
    expect(store.get('TCS', 'ltp')).toBe(3467.8);
  });

  it('wakes only the fields whose value changed', () => {
    const store = storeWith('TCS');
    store.apply([tcs]);
    const ltp = vi.fn();
    const dayHigh = vi.fn();
    const volume = vi.fn();
    store.subscribe('TCS', 'ltp', ltp);
    store.subscribe('TCS', 'dayHigh', dayHigh);
    store.subscribe('TCS', 'volume', volume);

    store.apply([{ ...tcs, ltp: 3470, volume: tcs.volume + 100 }]);

    expect(ltp).toHaveBeenCalledTimes(1);
    expect(volume).toHaveBeenCalledTimes(1);
    expect(dayHigh).not.toHaveBeenCalled();
  });

  it('does nothing when an identical quote arrives again', () => {
    const store = storeWith('TCS');
    store.apply([tcs]);
    const listener = vi.fn();
    store.subscribe('TCS', 'ltp', listener);
    store.apply([{ ...tcs }]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('never wakes another stock’s cells', () => {
    const store = storeWith('TCS', 'ITC');
    store.apply([tcs, { ...tcs, symbol: 'ITC', ltp: 412.15 }]);
    const itc = vi.fn();
    store.subscribe('ITC', 'ltp', itc);
    store.apply([{ ...tcs, ltp: 3500 }]);
    expect(itc).not.toHaveBeenCalled();
  });

  it('ignores late data for stocks the user has removed', () => {
    const store = storeWith('TCS');
    store.apply([tcs]);
    store.track([]);
    expect(store.get('TCS', 'ltp')).toBeUndefined();
    store.apply([tcs]);
    expect(store.get('TCS', 'ltp')).toBeUndefined();
  });

  it('stops calling a listener after it unsubscribes', () => {
    const store = storeWith('TCS');
    const listener = vi.fn();
    const unsubscribe = store.subscribe('TCS', 'ltp', listener);
    unsubscribe();
    store.apply([tcs]);
    expect(listener).not.toHaveBeenCalled();
  });
});
