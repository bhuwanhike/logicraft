/**
 * Regenerates src/test/fixtures/apiPayloads.ts from a running backend.
 *
 * The test suite is only worth anything if the shapes it asserts on are the
 * shapes the API actually returns. These fixtures are captured rather than
 * hand-written so a projection change shows up as a failing assertion rather
 * than as a fixture that quietly drifted.
 *
 *   npm run dev                          # frontend, not required
 *   (cd ../backend/logicraft && mvn spring-boot:run)
 *   npm run test:fixtures
 *
 * Set API_BASE to point at a deployed environment:
 *   API_BASE=https://api.example.com/api/v1 npm run test:fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8080/api/v1';
const ROWS = process.env.FIXTURE_ROWS ?? '2';

/** Path segment to exported name. */
const RESOURCES = {
  drivers: 'drivers',
  vehicles: 'vehicles',
  trips: 'trips',
  shipments: 'shipments',
  warehouses: 'warehouses',
  zones: 'zones',
  inventory: 'inventory',
  notifications: 'notifications',
  'audit-logs': 'auditLogs',
  users: 'users'
};

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/test/fixtures/apiPayloads.ts');

const header = `/**
 * Real API payloads, captured from a running backend.
 *
 * These are the shapes the workspace actually receives, not hand-written
 * approximations. Two classes of bug only appear against real data: a column
 * key the projection never aliased, and a value that arrives as a driver type
 * (TEXT[] as an array, jsonb as an object) rather than a JSON primitive. Both
 * shipped as blank or "[object Object]" cells before the render path was fixed.
 *
 * Captured with: curl "http://localhost:8080/api/v1/<resource>?workspaceId=1&size=${ROWS}"
 * Trimmed to ${ROWS} rows each. Regenerate with: npm run test:fixtures
 *
 * Do not hand-edit: change the projection and re-capture instead.
 */
import type { Rows } from "../../types";
`;

const blocks = [];
const failed = [];

for (const [path, name] of Object.entries(RESOURCES)) {
  const url = `${API_BASE}/${path}?workspaceId=1&size=${ROWS}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    failed.push(`${path}: content-type ${type || '(none)'}`);
    continue;
  }
  const body = await response.json();
  if (!Array.isArray(body) || body.length === 0) {
    failed.push(`${path}: ${Array.isArray(body) ? 'empty array' : typeof body}`);
    continue;
  }
  blocks.push(`/** ${path} */\nexport const ${name}Payload: Rows = ${JSON.stringify(body, null, 2)};\n`);
  console.log(`  captured ${path}: ${body.length} row(s), ${Object.keys(body[0]).length} keys`);
}

if (failed.length) {
  console.error(`\nNot JSON or empty for:\n  ${failed.join('\n  ')}`);
  process.exit(1);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${header}\n${blocks.join('\n')}`);
console.log(`\nwrote ${out}`);
