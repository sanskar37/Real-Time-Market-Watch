import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CheckIcon, ChevronDown, CloseIcon } from '../icons/icons';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { Stock } from '../../lib/types';
import styles from './StockSelect.module.css';

interface StockSelectProps {
  /** Every stock that can be picked, in display order. */
  stocks: readonly Stock[];
  /** Picked symbols, in the order they were picked. */
  selected: readonly string[];
  onToggle: (symbol: string) => void;
  /** id of the visible label. */
  labelledBy: string;
}

/** How many chips fit before the rest collapse into "+N". */
function useVisibleChipCount(): number {
  const wide = useMediaQuery('(min-width: 900px)');
  const medium = useMediaQuery('(min-width: 420px)');
  return wide ? 3 : medium ? 2 : 1;
}

interface OptionProps {
  id: string;
  index: number;
  stock: Stock;
  selected: boolean;
  active: boolean;
  onToggle: (symbol: string) => void;
  onHover: (index: number) => void;
}

const Option = memo(function Option({ id, index, stock, selected, active, onToggle, onHover }: OptionProps) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      className={styles.option}
      data-active={active || undefined}
      onClick={() => onToggle(stock.symbol)}
      onMouseMove={() => onHover(index)}
    >
      <span className={styles.check} data-checked={selected || undefined} aria-hidden="true">
        {selected && <CheckIcon />}
      </span>
      <span className={styles.optionSymbol}>{stock.symbol}</span>
      <span className={styles.optionCompany}>{stock.company}</span>
    </li>
  );
});

/**
 * Multi-select dropdown. The closed state matches the reference: chips with a
 * remove button, a "+N" chip for the rest, and a chevron. Opening it shows a
 * listbox you can drive with mouse, touch or keyboard.
 */
export function StockSelect({ stocks, selected, onToggle, labelledBy }: StockSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-opt-${index}`;

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const maxChips = useVisibleChipCount();
  const visibleChips = selected.slice(0, maxChips);
  const hiddenCount = selected.length - visibleChips.length;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openList = useCallback(() => {
    setOpen(true);
    setActiveIndex(0);
  }, []);

  // Move focus into the list when it opens, so arrow keys work straight away.
  useEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Close when the user clicks or taps anywhere else.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  // Keep the keyboard-highlighted option in view.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${baseId}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, baseId]);

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = stocks.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        setActiveIndex((i) => Math.min(last, i + 1));
        break;
      case 'ArrowUp':
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        setActiveIndex(0);
        break;
      case 'End':
        setActiveIndex(last);
        break;
      case 'Enter':
      case ' ': {
        const stock = stocks[activeIndex];
        if (stock) onToggle(stock.symbol);
        break;
      }
      case 'Escape':
        close(true);
        break;
      case 'Tab':
        close(false);
        return;
      default: {
        // Type a letter to jump to the next symbol starting with it.
        if (event.key.length !== 1) return;
        const letter = event.key.toUpperCase();
        const from = activeIndex + 1;
        const order = [...stocks.slice(from), ...stocks.slice(0, from)];
        const hit = order.find((s) => s.symbol.startsWith(letter));
        if (hit) setActiveIndex(stocks.indexOf(hit));
        else return;
      }
    }
    event.preventDefault();
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <div
        className={styles.field}
        data-open={open || undefined}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button[data-remove]')) return;
          if (open) close(false);
          else openList();
        }}
      >
        <ul className={styles.chips} aria-label="Selected stocks">
          {visibleChips.map((symbol) => (
            <li key={symbol} className={styles.chip}>
              <span className={styles.chipText}>{symbol}</span>
              <button
                type="button"
                data-remove
                className={styles.remove}
                aria-label={`Remove ${symbol}`}
                onClick={() => onToggle(symbol)}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className={`${styles.chip} ${styles.more}`} aria-label={`${hiddenCount} more selected`}>
              +{hiddenCount}
            </li>
          )}
        </ul>
        <button
          ref={triggerRef}
          type="button"
          className={styles.trigger}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={labelledBy}
          onClick={(event) => {
            event.stopPropagation();
            if (open) close(false);
            else openList();
          }}
        >
          <span className="visually-hidden">{`${selected.length} selected`}</span>
          <ChevronDown className={styles.chevron} />
        </button>
      </div>

      {open && (
        <div className={styles.popup}>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={labelledBy}
            aria-activedescendant={optionId(activeIndex)}
            tabIndex={-1}
            className={styles.list}
            onKeyDown={onListKeyDown}
          >
            {stocks.map((stock, index) => (
              <Option
                key={stock.symbol}
                id={optionId(index)}
                index={index}
                stock={stock}
                selected={selectedSet.has(stock.symbol)}
                active={index === activeIndex}
                onToggle={onToggle}
                onHover={setActiveIndex}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
