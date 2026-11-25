import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { RawData } from 'ws';

/** Base URL of an app listening on a random port, e.g. `ws://127.0.0.1:51234`. */
export function baseUrl(app: INestApplication, scheme: 'ws' | 'http'): string {
  const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
  return `${scheme}://127.0.0.1:${port}`;
}

/** Parses one server frame. The `ws` client delivers text frames as a Buffer. */
export function parseFrame<T>(raw: RawData): T {
  const buffer = Array.isArray(raw)
    ? Buffer.concat(raw)
    : raw instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(raw))
      : raw;
  return JSON.parse(buffer.toString('utf8')) as T;
}
