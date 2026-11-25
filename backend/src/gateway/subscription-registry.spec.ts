import { parseSymbols } from './protocol';
import { SubscriptionRegistry } from './subscription-registry';

describe('SubscriptionRegistry', () => {
  it('keeps each user’s watch list separate', () => {
    const registry = new SubscriptionRegistry<object>();
    const a = registry.open({});
    const b = registry.open({});
    registry.subscribe(a, ['TCS', 'ITC']);
    registry.subscribe(b, ['TCS', 'SBIN']);

    expect([...a.symbols]).toEqual(['TCS', 'ITC']);
    expect([...b.symbols]).toEqual(['TCS', 'SBIN']);

    registry.unsubscribe(a, ['TCS']);
    expect(registry.watchersOf('TCS')?.has(b)).toBe(true);
    expect(registry.watchersOf('TCS')?.has(a)).toBe(false);
    expect(b.symbols.has('TCS')).toBe(true);
  });

  it('reports only newly added symbols so snapshots are not repeated', () => {
    const registry = new SubscriptionRegistry<object>();
    const a = registry.open({});
    expect(registry.subscribe(a, ['TCS', 'ITC'])).toEqual(['TCS', 'ITC']);
    expect(registry.subscribe(a, ['ITC', 'SBIN'])).toEqual(['SBIN']);
  });

  it('forgets a closed connection completely', () => {
    const registry = new SubscriptionRegistry<object>();
    const socket = {};
    const a = registry.open(socket);
    registry.subscribe(a, ['TCS']);
    registry.close(socket);
    expect(registry.size).toBe(0);
    expect(registry.watchersOf('TCS')).toBeUndefined();
  });

  it('drops queued quotes for a symbol once it is unsubscribed', () => {
    const registry = new SubscriptionRegistry<object>();
    const a = registry.open({});
    registry.subscribe(a, ['TCS']);
    a.pending.set('TCS', '{}');
    registry.unsubscribe(a, ['TCS']);
    expect(a.pending.size).toBe(0);
  });
});

describe('parseSymbols', () => {
  it('accepts a clean list and removes duplicates', () => {
    expect(parseSymbols({ symbols: ['TCS', 'TCS', 'ITC'] }, 10)).toEqual(['TCS', 'ITC']);
  });

  it('ignores anything that is not a short string', () => {
    expect(parseSymbols({ symbols: [1, null, '', 'x'.repeat(40), 'OK'] }, 10)).toEqual(['OK']);
    expect(parseSymbols(null, 10)).toEqual([]);
    expect(parseSymbols({ symbols: 'TCS' }, 10)).toEqual([]);
  });

  it('caps the list size', () => {
    expect(parseSymbols({ symbols: ['A', 'B', 'C', 'D'] }, 2)).toEqual(['A', 'B']);
  });
});
