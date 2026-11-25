/**
 * Scalability demo: many concurrent users against a running API.
 *
 *   npm run demo:scale                      100 users for 30 s, live dashboard
 *   npm run demo:scale -- --users 500 --seconds 60 --report docs/scalability-report.md
 *
 * Users arrive gradually (--ramp per second). Each watches its own random 3–12
 * stocks, and every ~10 s swaps one for another (turn off with --no-churn),
 * so the server keeps handling subscription changes under load.
 *
 * Every second it prints what the users receive and what the server reports
 * about itself (/api/metrics). At the end it checks six things and exits
 * non-zero if any fail:
 *   1. every user connected and stayed connected
 *   2. no user ever received a stock it wasn't watching
 *   3. every stock a user watched for 15 s+ actually streamed to that user
 *   4. every subscription was answered with a snapshot
 *   5. delivery latency p95 under 250 ms
 *   6. the server stayed responsive: event-loop delay p99 under 100 ms
 *
 * Latency is measured from the server's tick timestamp to arrival, so run it
 * on the same machine as the API (shared clock).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import WebSocket from 'ws';

const { values: args } = parseArgs({
  allowNegative: true,
  options: {
    users: { type: 'string', default: '100' },
    seconds: { type: 'string', default: '30' },
    ramp: { type: 'string', default: '50' },
    url: { type: 'string', default: 'ws://localhost:3000/ws' },
    churn: { type: 'boolean', default: true },
    report: { type: 'string' },
  },
});

const USERS = Number(args.users);
const SECONDS = Number(args.seconds);
const RAMP_PER_SEC = Number(args.ramp);
const WS_URL = args.url;
const HTTP = WS_URL.replace(/^ws/, 'http').replace(/\/ws$/, '');
const IN_FLIGHT_GRACE_MS = 1_000; // a frame already on the wire when a user unsubscribes
const STREAMED_AFTER_MS = 15_000;

interface WireFrame {
  t: 'hello' | 'snapshot' | 'tick';
  ts: number;
  q?: { s: string }[];
}

interface Metrics {
  connections: number;
  subscriptions: number;
  memoryMb: { rss: number; heapUsed: number };
  totals: { ticks: number; framesSent: number; quotesSent: number; slowClientsDropped: number };
  window: {
    framesPerSec: number;
    quotesPerSec: number;
    kbPerSec: number;
    broadcastMs: { avg: number; max: number };
    eventLoopDelayMs: { p50: number; p99: number; max: number };
    cpuPercent: number;
  } | null;
}

interface User {
  id: number;
  ws: WebSocket;
  open: boolean;
  dropped: boolean;
  /** symbol -> when this user started watching it */
  watching: Map<string, number>;
  /** symbol -> when this user stopped watching it */
  left: Map<string, number>;
  /** symbol -> updates received */
  received: Map<string, number>;
  /** symbol -> when the subscribe was sent, until its snapshot arrives */
  awaitingSnapshot: Map<string, number>;
  frames: number;
  leaks: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const percentile = (sorted: number[], p: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : NaN;
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${HTTP}${path}`);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return (await response.json()) as T;
}

const catalog = await getJson<{ stocks: { symbol: string }[] }>('/api/stocks').catch((error: unknown) => {
  console.error(`Cannot reach the API at ${HTTP}. Start it first (npm run dev).\n${String(error)}`);
  process.exit(1);
});
const SYMBOLS = catalog.stocks.map((s) => s.symbol);

const users: User[] = [];
const latencies: number[] = [];
let connectErrors = 0;
let changes = 0;
let stopping = false;

function send(user: User, event: string, symbols: string[]) {
  if (user.ws.readyState === WebSocket.OPEN) user.ws.send(JSON.stringify({ event, data: { symbols } }));
}

function subscribe(user: User, symbols: string[]) {
  const now = Date.now();
  for (const s of symbols) {
    user.watching.set(s, now);
    user.left.delete(s);
    user.awaitingSnapshot.set(s, now);
  }
  send(user, 'subscribe', symbols);
}

function unsubscribe(user: User, symbol: string) {
  user.watching.delete(symbol);
  user.awaitingSnapshot.delete(symbol);
  user.left.set(symbol, Date.now());
  send(user, 'unsubscribe', [symbol]);
}

/** The `ws` client delivers text frames as a Buffer (or fragments of one). */
function text(raw: WebSocket.RawData): string {
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  return raw instanceof ArrayBuffer
    ? Buffer.from(new Uint8Array(raw)).toString('utf8')
    : raw.toString('utf8');
}

function onFrame(user: User, raw: WebSocket.RawData) {
  const frame = JSON.parse(text(raw)) as WireFrame;
  if (frame.t === 'hello') return;
  const now = Date.now();
  user.frames += 1;
  if (frame.t === 'tick') latencies.push(now - frame.ts);
  for (const { s } of frame.q ?? []) {
    if (user.watching.has(s)) {
      user.received.set(s, (user.received.get(s) ?? 0) + 1);
      if (frame.t === 'snapshot') user.awaitingSnapshot.delete(s);
    } else if (now - (user.left.get(s) ?? -Infinity) > IN_FLIGHT_GRACE_MS) {
      user.leaks += 1; // a stock this user never asked for, or dropped long ago
    }
  }
}

function connect(id: number): Promise<void> {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    const user: User = {
      id,
      ws,
      open: false,
      dropped: false,
      watching: new Map(),
      left: new Map(),
      received: new Map(),
      awaitingSnapshot: new Map(),
      frames: 0,
      leaks: 0,
    };
    users.push(user);
    ws.on('open', () => {
      user.open = true;
      const count = 3 + Math.floor(Math.random() * 10);
      subscribe(user, [...SYMBOLS].sort(() => Math.random() - 0.5).slice(0, count));
      resolve();
    });
    ws.on('message', (raw) => onFrame(user, raw));
    ws.on('error', () => {
      if (!user.open) connectErrors += 1;
      resolve();
    });
    ws.on('close', () => {
      if (user.open && !stopping) user.dropped = true;
      user.open = false;
    });
  });
}

/** Each user swaps one stock for another every ~10 s. */
function churn() {
  for (const user of users) {
    if (!user.open || Math.random() > 0.1) continue;
    const watched = [...user.watching.keys()];
    const unwatched = SYMBOLS.filter((s) => !user.watching.has(s));
    if (watched.length <= 1 || unwatched.length === 0) continue;
    unsubscribe(user, pick(watched));
    subscribe(user, [pick(unwatched)]);
    changes += 1;
  }
}

// ---------------------------------------------------------------- run
console.log(
  `\nScalability demo: ${USERS} users, ${RAMP_PER_SEC}/s arrival, ${SECONDS}s steady, ` +
    `${args.churn ? 'selection changes on' : 'no selection changes'}, ${SYMBOLS.length} stocks, ${WS_URL}\n`,
);

const startedAt = Date.now();
let lastFrames = 0;
let lastLatencyIndex = 0;
let latest: Metrics | null = null;

const dashboard = setInterval(() => {
  void getJson<Metrics>('/api/metrics')
    .then((m) => {
      latest = m;
      const connected = users.filter((u) => u.open).length;
      const frames = users.reduce((n, u) => n + u.frames, 0);
      const recent = latencies.slice(lastLatencyIndex).sort((a, b) => a - b);
      lastLatencyIndex = latencies.length;
      const leaks = users.reduce((n, u) => n + u.leaks, 0);
      const w = m.window;
      console.log(
        `${String(Math.round((Date.now() - startedAt) / 1000)).padStart(4)}s │ users ${String(connected).padStart(4)}/${USERS}` +
          ` │ frames/s ${fmt(frames - lastFrames).padStart(5)} │ p95 ${String(percentile(recent, 95)).padStart(3)} ms` +
          ` │ leaks ${leaks} │ server: ${m.connections} conns, ${fmt(m.subscriptions)} subs` +
          (w ? `, cpu ${w.cpuPercent}%, loop p99 ${w.eventLoopDelayMs.p99} ms` : ', warming up') +
          `, rss ${m.memoryMb.rss} MB`,
      );
      lastFrames = frames;
    })
    .catch(() => console.log('  (metrics unavailable)'));
}, 1000);

// Users arrive gradually, like real traffic.
const arrivals: Promise<void>[] = [];
for (let i = 0; i < USERS; i += 1) {
  arrivals.push(connect(i));
  await sleep(1000 / RAMP_PER_SEC);
}
await Promise.all(arrivals);

const churnTimer = args.churn ? setInterval(churn, 1000) : undefined;
await sleep(SECONDS * 1000);
clearInterval(churnTimer);
await sleep(1500); // let in-flight snapshots and the next metrics window land
clearInterval(dashboard);

const final = await getJson<Metrics>('/api/metrics');
const peak = latest ?? final;
stopping = true;
users.forEach((u) => u.ws.close());

// ---------------------------------------------------------------- verdict
const now = Date.now();
const connectedAll = users.filter((u) => u.open || u.frames > 0).length;
const dropped = users.filter((u) => u.dropped).length;
const leaks = users.reduce((n, u) => n + u.leaks, 0);

let longWatched = 0;
let silent = 0;
for (const u of users) {
  for (const [symbol, since] of u.watching) {
    if (now - since < STREAMED_AFTER_MS) continue;
    longWatched += 1;
    if ((u.received.get(symbol) ?? 0) < 2) silent += 1; // snapshot alone isn't streaming
  }
}
const unanswered = users.reduce(
  (n, u) => n + [...u.awaitingSnapshot.values()].filter((t) => now - t > 2000).length,
  0,
);
const sorted = [...latencies].sort((a, b) => a - b);
const p50 = percentile(sorted, 50);
const p95 = percentile(sorted, 95);
const p99 = percentile(sorted, 99);
const loopP99 = peak.window?.eventLoopDelayMs.p99 ?? NaN;

const checks: [string, boolean, string][] = [
  [
    'Every user connected and stayed connected',
    connectedAll === USERS && connectErrors === 0 && dropped === 0,
    `${connectedAll}/${USERS} connected, ${connectErrors} connection errors, ${dropped} dropped`,
  ],
  ["No user received a stock it wasn't watching", leaks === 0, `${leaks} stray quotes`],
  [
    'Every stock watched for 15 s+ streamed to its user',
    silent === 0,
    `${longWatched - silent}/${longWatched} streaming`,
  ],
  ['Every subscription answered with a snapshot', unanswered === 0, `${unanswered} unanswered`],
  ['Delivery latency p95 under 250 ms', p95 < 250, `p50 ${p50} ms, p95 ${p95} ms, p99 ${p99} ms`],
  ['Server responsive (event-loop delay p99 under 100 ms)', loopP99 < 100, `p99 ${loopP99} ms`],
];
const pass = checks.every(([, ok]) => ok);

const w = peak.window;
console.log('\nResult');
for (const [name, ok, detail] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
console.log(
  `\n  Server at load: ${peak.connections} connections, ${fmt(peak.subscriptions)} subscriptions` +
    (w
      ? `, ${fmt(w.framesPerSec)} frames/s, ${fmt(w.quotesPerSec)} quotes/s, ${w.kbPerSec} KB/s,` +
        ` CPU ${w.cpuPercent}% of one core, fan-out ${w.broadcastMs.avg} ms avg per tick`
      : '') +
    `, memory ${peak.memoryMb.rss} MB`,
);
console.log(`  Selection changes during the run: ${changes}`);
console.log(`\n${pass ? 'PASS' : 'FAIL'}\n`);

if (args.report) {
  const lines = [
    '# Scalability report',
    '',
    `Generated by \`npm run demo:scale\` on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
    '',
    '| Setting | Value |',
    '| --- | --- |',
    `| Concurrent users | ${USERS} (arriving ${RAMP_PER_SEC} per second) |`,
    `| Steady-state duration | ${SECONDS} s |`,
    `| Stocks per user | 3 to 12, chosen at random |`,
    `| Selection changes | ${args.churn ? `on: ${changes} swaps during the run` : 'off'} |`,
    `| Stocks simulated | ${SYMBOLS.length} |`,
    '',
    '## Checks',
    '',
    '| Check | Result | Detail |',
    '| --- | --- | --- |',
    ...checks.map(([name, ok, detail]) => `| ${name} | ${ok ? 'PASS' : 'FAIL'} | ${detail} |`),
    '',
    '## Server under load (from `/api/metrics`)',
    '',
    '| Measure | Value |',
    '| --- | --- |',
    `| Connections | ${peak.connections} |`,
    `| Stock subscriptions | ${fmt(peak.subscriptions)} |`,
    ...(w
      ? [
          `| Frames sent per second | ${fmt(w.framesPerSec)} |`,
          `| Quotes sent per second | ${fmt(w.quotesPerSec)} |`,
          `| Outbound bandwidth | ${w.kbPerSec} KB/s |`,
          `| Fan-out time per tick | ${w.broadcastMs.avg} ms avg, ${w.broadcastMs.max} ms max |`,
          `| CPU | ${w.cpuPercent}% of one core |`,
          `| Event-loop delay | p50 ${w.eventLoopDelayMs.p50} ms, p99 ${w.eventLoopDelayMs.p99} ms |`,
        ]
      : []),
    `| Memory (RSS) | ${peak.memoryMb.rss} MB |`,
    `| Slow clients dropped | ${final.totals.slowClientsDropped} |`,
    '',
    `**Overall: ${pass ? 'PASS' : 'FAIL'}**`,
    '',
  ];
  await mkdir(dirname(args.report), { recursive: true });
  await writeFile(args.report, lines.join('\n'));
  console.log(`Report written to ${args.report}`);
}

process.exit(pass ? 0 : 1);
