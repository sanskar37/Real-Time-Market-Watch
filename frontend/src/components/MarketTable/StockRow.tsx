import { memo } from 'react';
import { ChangeCell, LiveCell, LtpCell } from './cells';
import { VALUE_COLUMNS } from './columns';
import styles from './MarketTable.module.css';

interface StockRowProps {
  symbol: string;
  company: string;
}

/**
 * One stock. Its props are two strings that never change, so once mounted
 * the row itself never re-renders; only its live cells do.
 */
export const StockRow = memo(function StockRow({ symbol, company }: StockRowProps) {
  return (
    <div role="row" className={styles.row} data-symbol={symbol}>
      <div role="rowheader" className={`${styles.cell} ${styles.sticky} ${styles.symbol}`}>
        {symbol}
      </div>
      <div
        role="cell"
        className={`${styles.cell} ${styles.sticky} ${styles.stickyCompany} ${styles.company}`}
      >
        <span className={styles.companyText}>{company}</span>
      </div>
      <LtpCell symbol={symbol} />
      <ChangeCell symbol={symbol} />
      <div role="cell" className={`${styles.cell} ${styles.spacer}`} aria-hidden="true" />
      {VALUE_COLUMNS.map((column) => (
        <LiveCell
          key={column.id}
          symbol={symbol}
          field={column.id}
          format={column.format}
          className={column.id === 'volume' ? `${styles.cell} ${styles.volume}` : undefined}
        />
      ))}
    </div>
  );
});
