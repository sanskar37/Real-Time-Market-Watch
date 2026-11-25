import type { Page, WebSocketRoute } from '@playwright/test';

export interface WireQuote {
  s: string;
  ltp: number;
  chg: number;
  dh: number;
  dl: number;
  vol: number;
  h52: number;
  l52: number;
}

/** The nine rows of the reference image, value for value. */
export const DESIGN_ROWS: WireQuote[] = [
  { s: 'RELIANCE', ltp: 1425.6, chg: 2.35, dh: 1430, dl: 1398.2, vol: 12_500_000, h52: 1620, l52: 1210.3 },
  { s: 'TCS', ltp: 3467.8, chg: 1.21, dh: 3480, dl: 3420.5, vol: 8_700_000, h52: 3950, l52: 2850.1 },
  { s: 'HDFCBANK', ltp: 1892.25, chg: -0.72, dh: 1905, dl: 1880.3, vol: 10_100_000, h52: 2000, l52: 1580.2 },
  { s: 'INFY', ltp: 1523.1, chg: 0.88, dh: 1530, dl: 1505.2, vol: 7_300_000, h52: 1780, l52: 1320.4 },
  {
    s: 'ICICIBANK',
    ltp: 1305.75,
    chg: -0.15,
    dh: 1314.2,
    dl: 1298,
    vol: 6_200_000,
    h52: 1520.5,
    l52: 1180.25,
  },
  { s: 'SBIN', ltp: 812.4, chg: 1.47, dh: 816.6, dl: 799.75, vol: 9_800_000, h52: 950, l52: 680.2 },
  { s: 'BHARTIARTL', ltp: 1732.2, chg: -0.33, dh: 1739, dl: 1720.1, vol: 5_500_000, h52: 1980, l52: 1420.3 },
  { s: 'ITC', ltp: 412.15, chg: 0.56, dh: 414, dl: 408.2, vol: 4_100_000, h52: 460, l52: 360.25 },
  { s: 'KOTAKBANK', ltp: 2028.7, chg: -1.12, dh: 2046.3, dl: 2015.4, vol: 3_900_000, h52: 2380, l52: 1720.1 },
];

const EXTRA_ROWS: WireQuote[] = [
  // Longest symbol and a five-digit price: wider than the reference's columns.
  {
    s: 'ULTRACEMCO',
    ltp: 11200,
    chg: -0.58,
    dh: 11267.2,
    dl: 11099.2,
    vol: 400_000,
    h52: 13888,
    l52: 8736,
  },
  { s: 'LT', ltp: 3540, chg: 0.64, dh: 3561.25, dl: 3508.15, vol: 2_800_000, h52: 4389.6, l52: 2761.2 },
  { s: 'WIPRO', ltp: 462.8, chg: -0.19, dh: 465.6, dl: 458.65, vol: 5_900_000, h52: 573.85, l52: 361 },
];

export const COMPANIES: Record<string, string> = {
  RELIANCE: 'Reliance Industries',
  TCS: 'Tata Consultancy Services',
  HDFCBANK: 'HDFC Bank',
  INFY: 'Infosys',
  ICICIBANK: 'ICICI Bank',
  SBIN: 'State Bank of India',
  BHARTIARTL: 'Bharti Airtel',
  ITC: 'ITC Limited',
  KOTAKBANK: 'Kotak Mahindra Bank',
  ULTRACEMCO: 'UltraTech Cement',
  LT: 'Larsen & Toubro',
  WIPRO: 'Wipro',
};

/** 17 Nov 2025, 02:30:45 PM in India: the time shown in the reference header. */
export const DESIGN_TIME = new Date(Date.UTC(2025, 10, 17, 9, 0, 45));

export interface MockMarket {
  /** Every message the page sent, parsed. */
  sent: { event: string; data?: { symbols?: string[] } }[];
  /** Sends a tick frame to the page. */
  tick(quotes: WireQuote[]): void;
  /** Changes server-side prices without telling the page, like a lost frame. */
  changeSilently(quotes: WireQuote[]): void;
  latest(symbol: string): WireQuote;
  /** Closes the socket from the server side, like a network drop. */
  drop(): Promise<void>;
  connections(): number;
}

/**
 * Replaces the API and the WebSocket with an in-test fake that serves the
 * reference numbers, so the page is fully deterministic.
 */
export interface MockOptions {
  /** Clock the fake server reports. Match it to `page.clock` when a test freezes time. */
  serverTime?: Date;
}

export async function mockMarket(page: Page, options: MockOptions = {}): Promise<MockMarket> {
  const quotes = new Map([...DESIGN_ROWS, ...EXTRA_ROWS].map((q) => [q.s, { ...q }]));
  const sent: MockMarket['sent'] = [];
  let socket: WebSocketRoute | undefined;
  let connections = 0;

  await page.route('**/api/stocks', (route) =>
    route.fulfill({
      json: {
        stocks: [...quotes.keys()].map((symbol) => ({ symbol, company: COMPANIES[symbol] })),
        defaults: DESIGN_ROWS.map((q) => q.s),
      },
    }),
  );

  await page.routeWebSocket('**/ws', (ws) => {
    socket = ws;
    connections += 1;
    const watching = new Set<string>();
    const snapshot = (symbols: Iterable<string>) =>
      ws.send(
        JSON.stringify({
          t: 'snapshot',
          ts: Date.now(),
          q: [...symbols].flatMap((s) => quotes.get(s) ?? []),
        }),
      );

    ws.send(JSON.stringify({ t: 'hello', ts: options.serverTime?.getTime() ?? Date.now(), tickMs: 500 }));
    ws.onMessage((raw) => {
      const message = JSON.parse(String(raw)) as MockMarket['sent'][number];
      sent.push(message);
      const symbols = message.data?.symbols ?? [];
      if (message.event === 'subscribe') {
        symbols.forEach((s) => watching.add(s));
        snapshot(symbols);
      }
      if (message.event === 'unsubscribe') symbols.forEach((s) => watching.delete(s));
      if (message.event === 'refresh') snapshot(watching); // same contract as the real gateway
    });
  });

  return {
    sent,
    tick(changed) {
      for (const q of changed) quotes.set(q.s, { ...q });
      socket?.send(JSON.stringify({ t: 'tick', ts: Date.now(), q: changed }));
    },
    changeSilently(changed) {
      for (const q of changed) quotes.set(q.s, { ...q });
    },
    latest(symbol) {
      return { ...quotes.get(symbol)! };
    },
    async drop() {
      await socket?.close({ code: 1012, reason: 'restart' });
    },
    connections: () => connections,
  };
}

/** Waits until every row has real numbers rather than the loading dash. */
export async function waitForData(page: Page, rows = DESIGN_ROWS.length) {
  await page
    .locator('[role="row"][data-symbol]')
    .nth(rows - 1)
    .waitFor();
  await page.waitForFunction(() => !document.querySelector('[role="table"]')?.textContent?.includes('—'));
  await page.evaluate(() => document.fonts.ready);
}

export const row = (page: Page, symbol: string) => page.locator(`[role="row"][data-symbol="${symbol}"]`);

export async function resetRenderCounts(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __renders: Record<string, number> }).__renders = {};
  });
}

export async function renderCounts(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => ({ ...(window as unknown as { __renders: Record<string, number> }).__renders }));
}
