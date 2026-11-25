import { memo, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { ArrowDown, ArrowUp } from '../icons/icons';
import { ColumnFitContext } from './columnFit';
import { formatPercent, formatRupees } from '../../lib/format';
import { probeRender } from '../../lib/renderProbe';
import type { QuoteField } from '../../lib/types';
import { useQuoteText, useQuoteValue } from '../../store/hooks';
import styles from './MarketTable.module.css';

const PLACEHOLDER = '—';

interface LiveCellProps {
  symbol: string;
  field: QuoteField;
  format: (value: number) => string;
  className?: string;
}

/** A cell bound to one live value. It re-renders only when its displayed text changes. */
export const LiveCell = memo(function LiveCell({ symbol, field, format, className }: LiveCellProps) {
  const text = useQuoteText(symbol, field, format);
  useEffect(() => probeRender(`${symbol}:${field}`));
  return (
    <div role="cell" className={className ?? styles.cell}>
      {text ?? PLACEHOLDER}
    </div>
  );
});

/**
 * Last traded price: bold, in the sticky block. When the price gains or loses
 * a digit (9,999.95 → 10,000.00) it asks the table to re-check the column width.
 */
export const LtpCell = memo(function LtpCell({ symbol }: { symbol: string }) {
  const text = useQuoteText(symbol, 'ltp', formatRupees);
  const requestFit = useContext(ColumnFitContext);
  const length = useRef<number | undefined>(undefined);

  useEffect(() => probeRender(`${symbol}:ltp`));
  useLayoutEffect(() => {
    // "No price yet" counts as length 0, so the first price to arrive is checked too.
    const next = text?.length ?? 0;
    if (length.current !== undefined && length.current !== next) requestFit?.();
    length.current = next;
  }, [text, requestFit]);

  return (
    <div role="cell" className={`${styles.cell} ${styles.sticky} ${styles.stickyLtp} ${styles.ltp}`}>
      {text ?? PLACEHOLDER}
    </div>
  );
});

/** Change % with a coloured arrow showing direction. */
export const ChangeCell = memo(function ChangeCell({ symbol }: { symbol: string }) {
  const value = useQuoteValue(symbol, 'changePct');
  useEffect(() => probeRender(`${symbol}:changePct`));

  if (value === undefined) {
    return (
      <div role="cell" className={`${styles.cell} ${styles.change}`}>
        {PLACEHOLDER}
      </div>
    );
  }
  const tone = value > 0 ? styles.up : value < 0 ? styles.down : styles.flat;
  const Arrow = value < 0 ? ArrowDown : ArrowUp;
  return (
    <div role="cell" className={`${styles.cell} ${styles.change} ${tone}`}>
      {value !== 0 && <Arrow className={styles.arrow} />}
      <span>{formatPercent(value)}</span>
      <span className="visually-hidden">{value > 0 ? ' up' : value < 0 ? ' down' : ''}</span>
    </div>
  );
});
