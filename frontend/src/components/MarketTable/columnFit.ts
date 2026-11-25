import { createContext, useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Lets an LTP cell ask the table to re-check column widths. Cells call it only
 * when their text changes length (a price gaining or losing a digit), never
 * on an ordinary tick.
 */
export const ColumnFitContext = createContext<(() => void) | null>(null);

const SYMBOL_CELLS = '[role="row"][data-symbol] > :nth-child(1)';
const LTP_CELLS = '[role="row"][data-symbol] > :nth-child(3)';

/** Width a cell needs for its text without clipping: text + padding + border. */
function widestNeeded(table: HTMLElement, selector: string): number {
  const cells = table.querySelectorAll<HTMLElement>(selector);
  const first = cells[0];
  if (!first) return 0;
  const style = getComputedStyle(first);
  const chrome =
    parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth);
  const range = document.createRange();
  let widest = 0;
  for (const cell of cells) {
    range.selectNodeContents(cell);
    widest = Math.max(widest, range.getBoundingClientRect().width);
  }
  return Math.ceil(widest + chrome);
}

/**
 * The reference column widths fit its own nine stocks. Others are longer
 * (ULTRACEMCO, "₹ 12,450.00"), so Symbol and LTP widen to fit the widest entry
 * on screen and narrow again when it goes, never below the reference width.
 *
 * The result goes into two CSS variables on the table. Each row keeps its own
 * small grid, so a price tick re-lays out one row, never the whole table.
 */
export function useColumnFit(tableRef: RefObject<HTMLElement | null>, rowsKey: unknown): () => void {
  const frame = useRef(0);

  const fit = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;
    const tokens = getComputedStyle(document.documentElement);
    const floor = (name: string) => parseFloat(tokens.getPropertyValue(name)) || 0;
    const symbol = Math.max(floor('--col-symbol'), widestNeeded(table, SYMBOL_CELLS));
    const ltp = Math.max(floor('--col-ltp'), widestNeeded(table, LTP_CELLS));
    table.style.setProperty('--col-symbol-fit', `${symbol}px`);
    table.style.setProperty('--col-ltp-fit', `${ltp}px`);
  }, [tableRef]);

  const requestFit = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      fit();
    });
  }, [fit]);

  // Rows added or removed: measure before the browser paints.
  useLayoutEffect(fit, [fit, rowsKey]);

  // Breakpoints change the type size; the web font may land after first paint.
  useEffect(() => {
    window.addEventListener('resize', requestFit);
    void document.fonts.ready.then(requestFit);
    return () => {
      window.removeEventListener('resize', requestFit);
      cancelAnimationFrame(frame.current);
    };
  }, [requestFit]);

  return requestFit;
}
