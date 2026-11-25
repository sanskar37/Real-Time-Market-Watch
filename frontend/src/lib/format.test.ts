import { describe, expect, it } from 'vitest';
import { formatMarketClock, formatPercent, formatRupees, formatVolume } from './format';

describe('formatters match the reference design', () => {
  it('formats rupees with a spaced symbol and two decimals', () => {
    expect(formatRupees(1425.6)).toBe('₹ 1,425.60');
    expect(formatRupees(812.4)).toBe('₹ 812.40');
    expect(formatRupees(12450)).toBe('₹ 12,450.00');
  });

  it('signs percentages', () => {
    expect(formatPercent(2.35)).toBe('+2.35%');
    expect(formatPercent(-0.72)).toBe('-0.72%');
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('abbreviates volume', () => {
    expect(formatVolume(12_500_000)).toBe('12.5M');
    expect(formatVolume(3_900_000)).toBe('3.9M');
    expect(formatVolume(640_000)).toBe('640.0K');
    expect(formatVolume(1_200_000_000)).toBe('1.2B');
  });

  it('shows Indian market time in the reference format', () => {
    // 17 Nov 2025, 09:00:45 UTC is 02:30:45 PM in India.
    expect(formatMarketClock(Date.UTC(2025, 10, 17, 9, 0, 45))).toEqual({
      date: 'Nov 17, 2025',
      time: '02:30:45 PM',
    });
  });
});
