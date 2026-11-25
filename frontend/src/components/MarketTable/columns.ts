import { formatRupees, formatVolume } from '../../lib/format';
import type { QuoteField } from '../../lib/types';

/** A column that shows one live number, formatted the same way in every row. */
export interface ValueColumn {
  id: QuoteField;
  label: string;
  format: (value: number) => string;
}

/**
 * The scrolling value columns, after the sticky Symbol / Company / LTP block,
 * the Change % column and the unlabelled spacer column from the reference.
 */
export const VALUE_COLUMNS: readonly ValueColumn[] = [
  { id: 'dayHigh', label: 'Day High', format: formatRupees },
  { id: 'dayLow', label: 'Day Low', format: formatRupees },
  { id: 'volume', label: 'Volume', format: formatVolume },
  { id: 'high52', label: '52W High', format: formatRupees },
  { id: 'low52', label: '52W Low', format: formatRupees },
];

/** Columns drawn on screen, including the unlabelled spacer. */
export const COLUMN_COUNT = 10;

/** Columns exposed to assistive tech: the spacer is hidden from them. */
export const ACCESSIBLE_COLUMN_COUNT = COLUMN_COUNT - 1;
