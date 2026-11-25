const rupees = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1425.6 -> "₹ 1,425.60" */
export function formatRupees(value: number): string {
  return `₹ ${rupees.format(value)}`;
}

/** 2.35 -> "+2.35%", -0.72 -> "-0.72%" */
export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

/** 12_500_000 -> "12.5M" */
export function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

const IST = 'Asia/Kolkata';
const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: IST,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: IST,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

/** Indian market time, shown as two parts: "Nov 17, 2025" and "02:30:45 PM". */
export function formatMarketClock(epochMs: number): { date: string; time: string } {
  const at = new Date(epochMs);
  return { date: dateFormat.format(at), time: timeFormat.format(at) };
}
