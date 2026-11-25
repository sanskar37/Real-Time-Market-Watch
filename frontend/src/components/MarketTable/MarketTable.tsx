import { memo, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { SortIcon } from '../icons/icons';
import { nextSort, type SortKey, type SortState } from '../../lib/sort';
import type { Stock } from '../../lib/types';
import { ColumnFitContext, useColumnFit } from './columnFit';
import { ACCESSIBLE_COLUMN_COUNT, COLUMN_COUNT, VALUE_COLUMNS } from './columns';
import { StockRow } from './StockRow';
import { useSortedStocks } from './useSortedStocks';
import styles from './MarketTable.module.css';

interface MarketTableProps {
  /** Selected stocks, in the order the user picked them. */
  stocks: readonly Stock[];
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

interface SortableHeadProps {
  label: string;
  sortKey: SortKey;
  sort: SortState | null;
  onSort: (key: SortKey) => void;
  className: string;
}

/** A heading with the reference's sort arrows. Clicking cycles through its sort orders. */
function SortableHead({ label, sortKey, sort, onSort, className }: SortableHeadProps) {
  const direction = sort?.key === sortKey ? sort.direction : undefined;
  return (
    <div role="columnheader" aria-sort={direction ? ARIA_SORT[direction] : 'none'} className={className}>
      <button
        type="button"
        className={styles.sortButton}
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label}`}
      >
        {label}
        <SortIcon direction={direction} className={styles.sortIcon} />
      </button>
    </div>
  );
}

/** Re-renders only when the sort changes; never on a price tick. */
const HeaderRow = memo(function HeaderRow({
  sort,
  onSort,
}: {
  sort: SortState | null;
  onSort: (key: SortKey) => void;
}) {
  return (
    <div role="row" className={`${styles.row} ${styles.headRow}`}>
      <SortableHead
        label="Symbol"
        sortKey="symbol"
        sort={sort}
        onSort={onSort}
        className={`${styles.head} ${styles.sticky} ${styles.symbolHead}`}
      />
      <div role="columnheader" className={`${styles.head} ${styles.sticky} ${styles.stickyCompany}`}>
        Company
      </div>
      <SortableHead
        label="LTP"
        sortKey="ltp"
        sort={sort}
        onSort={onSort}
        className={`${styles.head} ${styles.sticky} ${styles.stickyLtp} ${styles.ltpHead}`}
      />
      <SortableHead
        label="Change %"
        sortKey="changePct"
        sort={sort}
        onSort={onSort}
        className={`${styles.head} ${styles.changeHead}`}
      />
      <div role="columnheader" className={styles.head} aria-hidden="true" />
      {VALUE_COLUMNS.map((column) => (
        <div key={column.id} role="columnheader" className={styles.head}>
          {column.label}
        </div>
      ))}
    </div>
  );
});

/** Decorative strip under the last row: the column lines carry on down to the scrollbar. */
const TailRow = memo(function TailRow() {
  return (
    <div className={`${styles.row} ${styles.tail}`} aria-hidden="true">
      <div className={`${styles.cell} ${styles.sticky}`} />
      <div className={`${styles.cell} ${styles.sticky} ${styles.stickyCompany}`} />
      <div className={`${styles.cell} ${styles.sticky} ${styles.stickyLtp}`} />
      {Array.from({ length: COLUMN_COUNT - 3 }, (_, i) => (
        <div key={i} className={styles.cell} />
      ))}
    </div>
  );
});

/** Adds a faint shadow under the sticky columns once the user scrolls sideways. */
function useScrolledFlag(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      el.dataset.scrolled = el.scrollLeft > 0 ? 'true' : 'false';
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

export function MarketTable({ stocks }: MarketTableProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLDivElement>(null);
  useScrolledFlag(scroller);
  // Re-measure when stocks are added or removed; re-ordering never changes widths.
  const requestFit = useColumnFit(table, stocks);

  const [sort, setSort] = useState<SortState | null>(null);
  const onSort = useCallback((key: SortKey) => setSort((current) => nextSort(current, key)), []);
  const rows = useSortedStocks(stocks, sort);

  return (
    <div
      ref={scroller}
      className={styles.scroller}
      data-scrolled="false"
      tabIndex={0}
      aria-label="Market watch table, scrolls sideways"
    >
      <div
        ref={table}
        role="table"
        aria-label="Market watch"
        aria-colcount={ACCESSIBLE_COLUMN_COUNT}
        aria-rowcount={rows.length + 1}
        className={styles.table}
      >
        <div role="rowgroup">
          <HeaderRow sort={sort} onSort={onSort} />
        </div>
        <ColumnFitContext.Provider value={requestFit}>
          <div role="rowgroup">
            {rows.map((stock) => (
              <StockRow key={stock.symbol} symbol={stock.symbol} company={stock.company} />
            ))}
          </div>
        </ColumnFitContext.Provider>
        <TailRow />
      </div>
      {stocks.length === 0 && <p className={styles.empty}>Pick stocks above to start watching them.</p>}
    </div>
  );
}
