import { INestApplication } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test } from '@nestjs/testing';
import WebSocket from 'ws';
import { AppModule } from '../src/app.module';
import { MarketSimulatorService } from '../src/market/market-simulator.service';
import { baseUrl, parseFrame } from './helpers';

const USERS = 60;

interface Client {
  ws: WebSocket;
  wanted: Set<string>;
  received: Set<string>;
  ticks: number;
}

describe(`${USERS} concurrent users (doc 2B)`, () => {
  let app: INestApplication;
  let simulator: MarketSimulatorService;
  let url: string;

  beforeAll(async () => {
    process.env.SIM_AUTOSTART = 'false';
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

  it('each user gets every update for their own stocks and nothing else', async () => {
    const symbols = simulator.stocks().map((s) => s.symbol);

    const clients: Client[] = await Promise.all(
      Array.from({ length: USERS }, async (_, i) => {
        // Every user watches a different slice of the market.
        const wanted = new Set(symbols.filter((_, j) => (i + j) % 4 === 0).slice(0, 3 + (i % 6)));
        const ws = new WebSocket(url);
        const client: Client = { ws, wanted, received: new Set(), ticks: 0 };
        ws.on('message', (raw) => {
          const frame = parseFrame<{ t: string; q?: { s: string }[] }>(raw);
          if (frame.t !== 'tick') return;
          client.ticks += 1;
          frame.q?.forEach((q) => client.received.add(q.s));
        });
        await new Promise((resolve) => ws.once('open', resolve));
        ws.send(JSON.stringify({ event: 'subscribe', data: { symbols: [...wanted] } }));
        return client;
      }),
    );

    await new Promise((r) => setTimeout(r, 200)); // subscriptions settle
    for (let i = 0; i < 5; i += 1) simulator.tick(); // every stock moves 5 times
    await new Promise((r) => setTimeout(r, 300));

    for (const client of clients) {
      expect(client.received).toEqual(client.wanted);
      expect(client.ticks).toBe(5); // one batched frame per tick, never one per stock
    }
    const health = (await (await fetch(`${baseUrl(app, 'http')}/api/health`)).json()) as {
      connections: number;
    };
    expect(health.connections).toBe(USERS);

    // The server's own counters agree with what the 60 clients saw.
    const metrics = (await (await fetch(`${baseUrl(app, 'http')}/api/metrics`)).json()) as {
      connections: number;
      subscriptions: number;
      totals: { ticks: number; framesSent: number };
    };
    expect(metrics.connections).toBe(USERS);
    expect(metrics.subscriptions).toBe(clients.reduce((n, c) => n + c.wanted.size, 0));
    expect(metrics.totals.ticks).toBe(5);
    // 60 snapshots on subscribe + 60 users x 5 ticks, each a single batched frame.
    expect(metrics.totals.framesSent).toBe(USERS + USERS * 5);

    clients.forEach((c) => c.ws.close());
  });
});
