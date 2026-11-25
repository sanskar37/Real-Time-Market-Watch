import { MarketEngine } from './market-engine';
import { buildCatalog } from './stock-catalog';

/** Small seeded generator so every run of the suite sees the same market. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const options = { updateRatio: 0.5, volatility: 0.002 };

describe('MarketEngine', () => {
  it('opens with the exact figures from the reference design', () => {
    const engine = new MarketEngine(buildCatalog(9), options, mulberry32(1));
    expect(engine.quote('RELIANCE')).toEqual({
      symbol: 'RELIANCE',
      ltp: 1425.6,
      changePct: 2.35,
      dayHigh: 1430,
      dayLow: 1398.2,
      volume: 12_500_000,
      high52: 1620,
      low52: 1210.3,
    });
  });

  it('only reports quotes that moved, and each one really changed', () => {
    const engine = new MarketEngine(buildCatalog(30), options, mulberry32(7));
    const before = new Map(buildCatalog(30).map((s) => [s.symbol, s.ltp]));
    const changed = engine.step();
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThan(30);
    for (const quote of changed) expect(quote.ltp).not.toBe(before.get(quote.symbol));
  });

  it('keeps every invariant over a long run', () => {
    const engine = new MarketEngine(buildCatalog(30), options, mulberry32(42));
    for (let i = 0; i < 5000; i += 1) engine.step();
    for (const { symbol } of buildCatalog(30)) {
      const q = engine.quote(symbol)!;
      expect(q.ltp).toBeGreaterThan(0);
      expect(q.dayHigh).toBeGreaterThanOrEqual(q.ltp);
      expect(q.dayLow).toBeLessThanOrEqual(q.ltp);
      expect(q.high52).toBeGreaterThanOrEqual(q.dayHigh);
      expect(q.low52).toBeLessThanOrEqual(q.dayLow);
      expect(Math.round(q.ltp * 20)).toBeCloseTo(q.ltp * 20, 5); // on the 0.05 grid
    }
  });

  it('returns copies, so callers cannot corrupt the market', () => {
    const engine = new MarketEngine(buildCatalog(3), options, mulberry32(3));
    engine.quote('TCS')!.ltp = 1;
    expect(engine.quote('TCS')!.ltp).toBe(3467.8);
  });

  it('scales to any N with synthetic names after the real ones', () => {
    const catalog = buildCatalog(500);
    expect(catalog).toHaveLength(500);
    expect(new Set(catalog.map((s) => s.symbol)).size).toBe(500);
    expect(catalog[0].symbol).toBe('RELIANCE');
  });
});
