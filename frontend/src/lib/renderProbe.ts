/**
 * Counts committed renders per cell so tests can prove that a tick only
 * re-renders the cells whose value changed. Compiled away in production builds.
 */
export function probeRender(key: string): void {
  if (!import.meta.env.DEV) return;
  const w = window as unknown as { __renders?: Record<string, number> };
  const counts = (w.__renders ??= {});
  counts[key] = (counts[key] ?? 0) + 1;
}
