import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import WebSocket from 'ws';
import { AppModule } from '../src/app.module';
import { MarketSimulatorService } from '../src/market/market-simulator.service';
import { baseUrl, parseFrame } from './helpers';

interface Frame {
  t: 'hello' | 'snapshot' | 'tick';
  ts: number;
  q?: { s: string; ltp: number }[];
}

/** Opens a socket and records every frame it receives. */
async function connect(url: string) {
  const ws = new WebSocket(url);
  const frames: Frame[] = [];
  ws.on('message', (raw) => frames.push(parseFrame<Frame>(raw)));
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  const send = (event: string, data?: unknown) => ws.send(JSON.stringify({ event, data }));
  const waitFor = async (predicate: (f: Frame[]) => boolean) => {
    for (let i = 0; i < 100; i += 1) {
      if (predicate(frames)) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`timed out, frames: ${JSON.stringify(frames)}`);
  };
  return { ws, frames, send, waitFor };
}

describe('market gateway (end to end)', () => {
  let app: INestApplication;
  let simulator: MarketSimulatorService;
  let url: string;

  beforeAll(async () => {
    process.env.SIM_AUTOSTART = 'false'; // the test drives ticks by hand
    process.env.UPDATE_RATIO = '1';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(0);
    simulator = app.get(MarketSimulatorService);
    url = `${baseUrl(app, 'ws')}/ws`;
  });

  afterAll(async () => {
    delete process.env.SIM_AUTOSTART;
    delete process.env.UPDATE_RATIO;
    await app.close();
  });

  it('greets a new client and sends a snapshot only for what it subscribes to', async () => {
    const c = await connect(url);
    await c.waitFor((f) => f.some((x) => x.t === 'hello'));
    c.send('subscribe', { symbols: ['TCS', 'ITC', 'NOT-A-STOCK'] });
    await c.waitFor((f) => f.some((x) => x.t === 'snapshot'));

    const snapshot = c.frames.find((f) => f.t === 'snapshot')!;
    expect(snapshot.q!.map((q) => q.s).sort()).toEqual(['ITC', 'TCS']);
    c.ws.close();
  });

  it('keeps two users’ streams independent', async () => {
    const a = await connect(url);
    const b = await connect(url);
    a.send('subscribe', { symbols: ['TCS'] });
    b.send('subscribe', { symbols: ['SBIN'] });
    await a.waitFor((f) => f.some((x) => x.t === 'snapshot'));
    await b.waitFor((f) => f.some((x) => x.t === 'snapshot'));

    simulator.tick();
    await a.waitFor((f) => f.some((x) => x.t === 'tick'));
    await b.waitFor((f) => f.some((x) => x.t === 'tick'));

    const symbolsIn = (frames: Frame[]) => frames.flatMap((f) => f.q ?? []).map((q) => q.s);
    expect(new Set(symbolsIn(a.frames))).toEqual(new Set(['TCS']));
    expect(new Set(symbolsIn(b.frames))).toEqual(new Set(['SBIN']));
    a.ws.close();
    b.ws.close();
  });

  it('stops sending a symbol the moment it is unsubscribed', async () => {
    const c = await connect(url);
    c.send('subscribe', { symbols: ['TCS', 'ITC'] });
    await c.waitFor((f) => f.some((x) => x.t === 'snapshot'));
    c.send('unsubscribe', { symbols: ['TCS'] });
    await new Promise((r) => setTimeout(r, 50));
    const before = c.frames.length;

    simulator.tick();
    await c.waitFor((f) => f.length > before);
    const tick = c.frames.slice(before).find((f) => f.t === 'tick')!;
    expect(tick.q!.map((q) => q.s)).toEqual(['ITC']);
    c.ws.close();
  });

  it('survives garbage messages without dropping the connection', async () => {
    const c = await connect(url);
    c.ws.send('not json');
    c.send('subscribe', { symbols: 42 });
    c.send('subscribe', { symbols: ['TCS'] });
    await c.waitFor((f) => f.some((x) => x.t === 'snapshot'));
    expect(c.ws.readyState).toBe(WebSocket.OPEN);
    c.ws.close();
  });

  it('serves the stock catalogue over HTTP', async () => {
    const body = (await (await fetch(`${baseUrl(app, 'http')}/api/stocks`)).json()) as {
      stocks: unknown[];
      defaults: string[];
    };
    expect(body.stocks.length).toBeGreaterThanOrEqual(9);
    expect(body.defaults).toContain('RELIANCE');
  });
});
