import type { StockCatalog } from '../lib/types';

/** Loads the list of stocks the user can pick from. */
export async function fetchCatalog(signal?: AbortSignal): Promise<StockCatalog> {
  const response = await fetch('/api/stocks', { signal });
  if (!response.ok) throw new Error(`Could not load stocks (${response.status})`);
  return (await response.json()) as StockCatalog;
}
