import type { StockSeed } from './market.types';

/**
 * The first nine rows are copied from the reference design so the first
 * screen opens with exactly the numbers shown there. The rest are plausible
 * starting values for other large NSE names.
 */
const DESIGN_SEEDS: StockSeed[] = [
  {
    symbol: 'RELIANCE',
    company: 'Reliance Industries',
    ltp: 1425.6,
    changePct: 2.35,
    dayHigh: 1430.0,
    dayLow: 1398.2,
    volume: 12_500_000,
    high52: 1620.0,
    low52: 1210.3,
  },
  {
    symbol: 'TCS',
    company: 'Tata Consultancy Services',
    ltp: 3467.8,
    changePct: 1.21,
    dayHigh: 3480.0,
    dayLow: 3420.5,
    volume: 8_700_000,
    high52: 3950.0,
    low52: 2850.1,
  },
  {
    symbol: 'HDFCBANK',
    company: 'HDFC Bank',
    ltp: 1892.25,
    changePct: -0.72,
    dayHigh: 1905.0,
    dayLow: 1880.3,
    volume: 10_100_000,
    high52: 2000.0,
    low52: 1580.2,
  },
  {
    symbol: 'INFY',
    company: 'Infosys',
    ltp: 1523.1,
    changePct: 0.88,
    dayHigh: 1530.0,
    dayLow: 1505.2,
    volume: 7_300_000,
    high52: 1780.0,
    low52: 1320.4,
  },
  {
    symbol: 'ICICIBANK',
    company: 'ICICI Bank',
    ltp: 1305.75,
    changePct: -0.15,
    dayHigh: 1314.2,
    dayLow: 1298.0,
    volume: 6_200_000,
    high52: 1520.5,
    low52: 1180.25,
  },
  {
    symbol: 'SBIN',
    company: 'State Bank of India',
    ltp: 812.4,
    changePct: 1.47,
    dayHigh: 816.6,
    dayLow: 799.75,
    volume: 9_800_000,
    high52: 950.0,
    low52: 680.2,
  },
  {
    symbol: 'BHARTIARTL',
    company: 'Bharti Airtel',
    ltp: 1732.2,
    changePct: -0.33,
    dayHigh: 1739.0,
    dayLow: 1720.1,
    volume: 5_500_000,
    high52: 1980.0,
    low52: 1420.3,
  },
  {
    symbol: 'ITC',
    company: 'ITC Limited',
    ltp: 412.15,
    changePct: 0.56,
    dayHigh: 414.0,
    dayLow: 408.2,
    volume: 4_100_000,
    high52: 460.0,
    low52: 360.25,
  },
  {
    symbol: 'KOTAKBANK',
    company: 'Kotak Mahindra Bank',
    ltp: 2028.7,
    changePct: -1.12,
    dayHigh: 2046.3,
    dayLow: 2015.4,
    volume: 3_900_000,
    high52: 2380.0,
    low52: 1720.1,
  },
];

interface CompactSeed {
  symbol: string;
  company: string;
  ltp: number;
  changePct: number;
  volumeM: number;
}

/** Other names, expanded into full seeds by {@link expand}. */
const COMPACT_SEEDS: CompactSeed[] = [
  { symbol: 'LT', company: 'Larsen & Toubro', ltp: 3540.0, changePct: 0.64, volumeM: 2.8 },
  { symbol: 'HINDUNILVR', company: 'Hindustan Unilever', ltp: 2385.0, changePct: -0.41, volumeM: 2.2 },
  { symbol: 'AXISBANK', company: 'Axis Bank', ltp: 1098.5, changePct: 0.92, volumeM: 7.4 },
  { symbol: 'ASIANPAINT', company: 'Asian Paints', ltp: 2450.0, changePct: -0.27, volumeM: 1.6 },
  { symbol: 'MARUTI', company: 'Maruti Suzuki India', ltp: 12450.0, changePct: 0.38, volumeM: 0.6 },
  { symbol: 'SUNPHARMA', company: 'Sun Pharmaceutical', ltp: 1745.3, changePct: 1.05, volumeM: 3.1 },
  { symbol: 'TITAN', company: 'Titan Company', ltp: 3380.0, changePct: -0.83, volumeM: 1.9 },
  { symbol: 'BAJFINANCE', company: 'Bajaj Finance', ltp: 7120.0, changePct: 1.34, volumeM: 1.4 },
  { symbol: 'WIPRO', company: 'Wipro', ltp: 462.8, changePct: -0.19, volumeM: 5.9 },
  { symbol: 'HCLTECH', company: 'HCL Technologies', ltp: 1685.0, changePct: 0.71, volumeM: 3.3 },
  { symbol: 'ULTRACEMCO', company: 'UltraTech Cement', ltp: 11200.0, changePct: -0.58, volumeM: 0.4 },
  { symbol: 'NESTLEIND', company: 'Nestle India', ltp: 2240.0, changePct: 0.22, volumeM: 0.9 },
  { symbol: 'POWERGRID', company: 'Power Grid Corporation', ltp: 318.4, changePct: 0.47, volumeM: 8.6 },
  { symbol: 'NTPC', company: 'NTPC Limited', ltp: 345.6, changePct: -0.36, volumeM: 9.1 },
  { symbol: 'ONGC', company: 'Oil & Natural Gas Corporation', ltp: 262.15, changePct: 0.98, volumeM: 10.4 },
  { symbol: 'TATAMOTORS', company: 'Tata Motors', ltp: 742.9, changePct: -1.24, volumeM: 11.2 },
  { symbol: 'TATASTEEL', company: 'Tata Steel', ltp: 158.35, changePct: 0.63, volumeM: 14.8 },
  { symbol: 'ADANIPORTS', company: 'Adani Ports and SEZ', ltp: 1380.0, changePct: 1.76, volumeM: 3.7 },
  { symbol: 'JSWSTEEL', company: 'JSW Steel', ltp: 1015.5, changePct: -0.52, volumeM: 4.5 },
  { symbol: 'COALINDIA', company: 'Coal India', ltp: 402.3, changePct: 0.29, volumeM: 6.8 },
  { symbol: 'TECHM', company: 'Tech Mahindra', ltp: 1620.75, changePct: -0.67, volumeM: 2.4 },
];

const roundToTick = (value: number): number => Math.round(value / 0.05) * 0.05;
const money = (value: number): number => Number(roundToTick(value).toFixed(2));

function expand(seed: CompactSeed): StockSeed {
  const { ltp } = seed;
  return {
    symbol: seed.symbol,
    company: seed.company,
    ltp,
    changePct: seed.changePct,
    dayHigh: money(ltp * 1.006),
    dayLow: money(ltp * 0.991),
    volume: Math.round(seed.volumeM * 1_000_000),
    high52: money(ltp * 1.24),
    low52: money(ltp * 0.78),
  };
}

/** Deterministic stand-in names so the simulation can scale to any N. */
function synthetic(index: number): StockSeed {
  const n = index + 1;
  const ltp = money(80 + ((n * 137) % 4800));
  const changePct = Number((((n * 53) % 400) / 100 - 2).toFixed(2));
  return expand({
    symbol: `SIM${String(n).padStart(4, '0')}`,
    company: `Simulated Company ${n}`,
    ltp,
    changePct,
    volumeM: 0.5 + ((n * 17) % 120) / 10,
  });
}

const REAL_SEEDS: StockSeed[] = [...DESIGN_SEEDS, ...COMPACT_SEEDS.map(expand)];

/** Builds the list of N seeds: real names first, then synthetic ones. */
export function buildCatalog(count: number): StockSeed[] {
  if (count <= REAL_SEEDS.length) return REAL_SEEDS.slice(0, count).map((s) => ({ ...s }));
  const extra = Array.from({ length: count - REAL_SEEDS.length }, (_, i) => synthetic(i));
  return [...REAL_SEEDS.map((s) => ({ ...s })), ...extra];
}

/** Symbols shown in the reference design, in display order. */
export const DEFAULT_SYMBOLS: readonly string[] = DESIGN_SEEDS.map((s) => s.symbol);
