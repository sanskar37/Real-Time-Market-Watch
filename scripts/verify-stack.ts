/**
 * Checks the technology rules from the problem statement, mechanically:
 *
 *   "Candidates should use ReactJs using Vite and NestJs for backend.
 *    For Language TypeScript. Don't use any library for Tables on UI.
 *    Use Websockets for Streaming data into the Table."
 *
 *   npm run verify:stack
 *
 * It reads the package manifests, the full lockfile (so indirect
 * dependencies count too), every source file in the repo, and every import
 * in the frontend. Exits non-zero if any rule is broken.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const json = <T>(path: string) => JSON.parse(read(path)) as T;

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
const frontend = json<Manifest>('frontend/package.json');
const backend = json<Manifest>('backend/package.json');
const lock = json<{ packages: Record<string, { version?: string }> }>('package-lock.json');

/** Every package installed anywhere in the tree, direct or indirect. */
const installed = new Set(
  Object.keys(lock.packages)
    .filter((key) => key.includes('node_modules/'))
    .map((key) => key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length)),
);

/** Table and data-grid libraries (and UI kits that ship one). None may be installed. */
const TABLE_LIBRARIES = [
  'ag-grid-community',
  'ag-grid-react',
  'ag-grid-enterprise',
  '@tanstack/react-table',
  '@tanstack/table-core',
  'react-table',
  'react-data-grid',
  '@mui/x-data-grid',
  '@mui/material',
  'handsontable',
  '@handsontable/react',
  'tabulator-tables',
  'react-tabulator',
  'material-react-table',
  'mantine-react-table',
  'mantine-datatable',
  'primereact',
  'antd',
  'rc-table',
  'react-virtualized',
  'react-window',
  '@glideapps/glide-data-grid',
  '@revolist/revogrid',
  'gridjs',
  'gridjs-react',
  'datatables.net',
  'react-bootstrap-table-next',
  'devextreme',
  'devextreme-react',
  '@syncfusion/ej2-react-grids',
  '@progress/kendo-react-grid',
  'rsuite-table',
  'fixed-data-table-2',
  'react-super-responsive-table',
  '@tanstack/react-virtual',
];
/** Streaming alternatives that would mean prices are not on plain WebSockets. */
const NON_WEBSOCKET_TRANSPORTS = [
  'socket.io',
  'socket.io-client',
  'engine.io',
  'engine.io-client',
  'sockjs',
  'sockjs-client',
  '@microsoft/signalr',
];

/**
 * Source files written for this project. Generated output, installed
 * packages and dot-folders (editor and tool caches) are skipped.
 */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'playwright-report', 'test-results']);
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
function sourceFiles(dir = ROOT): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return SKIP_DIRS.has(name) || name.startsWith('.') ? [] : sourceFiles(path);
    }
    return CODE_EXTENSIONS.has(extname(name)) ? [relative(ROOT, path).replaceAll('\\', '/')] : [];
  });
}
const files = sourceFiles();

/** Bare package names imported by the frontend's shipped code (tests excluded). */
const appFiles = files.filter(
  (f) => f.startsWith('frontend/src/') && !/\.test\.tsx?$/.test(f) && !f.includes('/test/'),
);
const imported = new Set<string>();
for (const file of appFiles) {
  for (const [, spec] of read(file).matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
    if (!spec.startsWith('.'))
      imported.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
  }
}

const socketClient = read('frontend/src/services/marketSocket.ts');
const gateway = read('backend/src/gateway/market.gateway.ts');
const main = read('backend/src/main.ts');
const has = (m: Manifest, name: string) => Boolean(m.dependencies?.[name] ?? m.devDependencies?.[name]);

const checks: [rule: string, ok: boolean, evidence: string][] = [];
const check = (rule: string, ok: boolean, evidence: string) => checks.push([rule, ok, evidence]);

// 1. ReactJS using Vite
check(
  'Frontend is React, built with Vite',
  has(frontend, 'react') &&
    has(frontend, 'react-dom') &&
    has(frontend, 'vite') &&
    has(frontend, '@vitejs/plugin-react') &&
    existsSync(join(ROOT, 'frontend/vite.config.ts')),
  `react ${frontend.dependencies?.react}, vite ${frontend.devDependencies?.vite}, frontend/vite.config.ts`,
);
// 2. NestJS backend
check(
  'Backend is NestJS',
  has(backend, '@nestjs/core') && has(backend, '@nestjs/common') && /NestFactory\.create/.test(main),
  `@nestjs/core ${backend.dependencies?.['@nestjs/core']}, NestFactory.create in backend/src/main.ts`,
);
// 3. TypeScript
const notTypeScript = files.filter((f) => !/\.(ts|tsx)$/.test(f));
check(
  'All source code is TypeScript',
  notTypeScript.length === 0 && files.length > 0,
  notTypeScript.length
    ? `not TypeScript: ${notTypeScript.join(', ')}`
    : `${files.length} source files, all .ts/.tsx`,
);
// 4. No table library
const tableLibs = TABLE_LIBRARIES.filter((name) => installed.has(name));
const allowedImports = new Set(['react', 'react-dom', '@fontsource-variable/inter']);
const unexpectedImports = [...imported].filter((name) => !allowedImports.has(name));
check(
  'No table or data-grid library, direct or indirect',
  tableLibs.length === 0,
  tableLibs.length
    ? `found: ${tableLibs.join(', ')}`
    : `none of ${TABLE_LIBRARIES.length} known table/grid libraries among ${installed.size} installed packages`,
);
check(
  'The UI imports only React and a font',
  unexpectedImports.length === 0,
  unexpectedImports.length
    ? `unexpected: ${unexpectedImports.join(', ')}`
    : `frontend/src imports: ${[...imported].sort().join(', ')}`,
);
// 5. WebSockets for streaming
const transports = NON_WEBSOCKET_TRANSPORTS.filter((name) => installed.has(name));
check(
  'Prices stream over plain WebSockets',
  has(backend, '@nestjs/platform-ws') &&
    has(backend, 'ws') &&
    /useWebSocketAdapter\(new WsAdapter/.test(main) &&
    /@WebSocketGateway\(/.test(gateway) &&
    /new WebSocket\(/.test(socketClient) &&
    transports.length === 0 &&
    !/EventSource|setInterval\([^)]*fetch/.test(socketClient),
  transports.length
    ? `other transports installed: ${transports.join(', ')}`
    : 'server: @nestjs/platform-ws WsAdapter + @WebSocketGateway; browser: native WebSocket; no Socket.IO, SockJS, SignalR, SSE or polling',
);

let failed = 0;
console.log('\nStack rules from the problem statement\n');
for (const [rule, ok, evidence] of checks) {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${rule}\n        ${evidence}`);
}
console.log(`\n${failed ? `FAIL: ${failed} rule(s) broken` : 'PASS: every rule holds'}\n`);
process.exit(failed ? 1 : 0);
