import { describe, expect, it } from 'vitest';
import { nextSort, orderSymbols } from './sort';

const prices: Record<string, number | undefined> = { TCS: 3467.8, ITC: 412.15, SBIN: 812.4, INFY: undefined };
const valueOf = (symbol: string) => prices[symbol];
const picked = ['TCS', 'ITC', 'INFY', 'SBIN'];

describe('nextSort', () => {
  it('starts prices highest-first, then flips, then turns off', () => {
    expect(nextSort(null, 'ltp')).toEqual({ key: 'ltp', direction: 'desc' });
    expect(nextSort({ key: 'ltp', direction: 'desc' }, 'ltp')).toEqual({ key: 'ltp', direction: 'asc' });
    expect(nextSort({ key: 'ltp', direction: 'asc' }, 'ltp')).toBeNull();
  });

  it('starts Symbol A to Z', () => {
    expect(nextSort(null, 'symbol')).toEqual({ key: 'symbol', direction: 'asc' });
    expect(nextSort({ key: 'symbol', direction: 'asc' }, 'symbol')).toEqual({
      key: 'symbol',
      direction: 'desc',
    });
  });

  it('switching column starts that column fresh', () => {
    expect(nextSort({ key: 'ltp', direction: 'asc' }, 'changePct')).toEqual({
      key: 'changePct',
      direction: 'desc',
    });
  });
});

describe('orderSymbols', () => {
  it('keeps the picking order when unsorted', () => {
    expect(orderSymbols(picked, null, valueOf)).toEqual(picked);
  });

  it('sorts by price, with stocks still loading kept at the end', () => {
    expect(orderSymbols(picked, { key: 'ltp', direction: 'desc' }, valueOf)).toEqual([
      'TCS',
      'SBIN',
      'ITC',
      'INFY',
    ]);
    expect(orderSymbols(picked, { key: 'ltp', direction: 'asc' }, valueOf)).toEqual([
      'ITC',
      'SBIN',
      'TCS',
      'INFY',
    ]);
  });

  it('sorts symbols alphabetically', () => {
    expect(orderSymbols(picked, { key: 'symbol', direction: 'asc' }, valueOf)).toEqual([
      'INFY',
      'ITC',
      'SBIN',
      'TCS',
    ]);
  });

  it('breaks ties by picking order so equal rows never swap', () => {
    const tied = (s: string) => (s === 'B' || s === 'A' ? 5 : 1);
    expect(orderSymbols(['B', 'C', 'A'], { key: 'changePct', direction: 'desc' }, tied)).toEqual([
      'B',
      'A',
      'C',
    ]);
  });
});
