import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Header } from './components/Header/Header';
import { MarketTable } from './components/MarketTable/MarketTable';
import { StockSelect } from './components/StockSelect/StockSelect';
import type { StockCatalog } from './lib/types';
import { fetchCatalog } from './services/api';
import { useMarketServices } from './store/hooks';
import styles from './App.module.css';

type CatalogState =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; catalog: StockCatalog };

const NO_STOCKS: readonly string[] = [];

function useCatalog() {
  const [state, setState] = useState<CatalogState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(controller.signal)
      .then((catalog) => setState({ kind: 'ready', catalog }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}

export function App() {
  const { store, socket } = useMarketServices();
  const { state, retry } = useCatalog();
  const labelId = useId();
  const catalog = state.kind === 'ready' ? state.catalog : undefined;

  // Until the user changes anything, the selection is the reference design's stocks.
  const [chosen, setChosen] = useState<readonly string[] | null>(null);
  const selected = chosen ?? catalog?.defaults ?? NO_STOCKS;

  useEffect(() => {
    socket.connect();
    return () => socket.disconnect();
  }, [socket]);

  // The selection drives both the store (what to keep) and the server (what to send).
  useEffect(() => {
    store.track(selected);
    socket.setSymbols(selected);
  }, [selected, store, socket]);

  const toggle = useCallback(
    (symbol: string) => {
      setChosen((current) => {
        const base = current ?? catalog?.defaults ?? NO_STOCKS;
        return base.includes(symbol) ? base.filter((s) => s !== symbol) : [...base, symbol];
      });
    },
    [catalog],
  );

  const rows = useMemo(() => {
    if (!catalog) return [];
    const bySymbol = new Map(catalog.stocks.map((s) => [s.symbol, s]));
    return selected.flatMap((symbol) => bySymbol.get(symbol) ?? []);
  }, [catalog, selected]);

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <Header />
        <section className={styles.filters} aria-label="Stock selection">
          <span id={labelId} className={styles.label}>
            Select Stocks
          </span>
          {catalog ? (
            <StockSelect stocks={catalog.stocks} selected={selected} onToggle={toggle} labelledBy={labelId} />
          ) : (
            <div className={styles.fieldPlaceholder} aria-hidden="true" />
          )}
        </section>

        {state.kind === 'error' ? (
          <div className={styles.notice} role="alert">
            <p>Couldn’t load the stock list. Is the API running on port 3000?</p>
            <button type="button" className={styles.retry} onClick={retry}>
              Try again
            </button>
          </div>
        ) : (
          <MarketTable stocks={rows} />
        )}
      </main>
    </div>
  );
}
