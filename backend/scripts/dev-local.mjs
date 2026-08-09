/**
 * One-command local stack for trying the app in a browser:
 * boots an embedded PostgreSQL, applies the schema, seeds demo accounts, and starts
 * the API on http://localhost:4000 (what web/config.js points at). Keeps running until killed.
 *
 * Run: npm run dev:local
 */
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const PORT_DB = 55432;
const PORT_API = 4000;
const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT_DB}/escrow`;
const dataDir = path.join(os.tmpdir(), 'safepay-devlocal-pgdata');

// DEV_LOCAL_KEEP_DATA=1 (used by the watchdog) restarts on the EXISTING database
// instead of wiping it, so accounts/transactions survive a crash-restart.
const keepData = !!process.env.DEV_LOCAL_KEEP_DATA;
const alreadyInitialised = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
if (!keepData) fs.rmSync(dataDir, { recursive: true, force: true });
// A hard kill can leave a stale lock file behind — remove it so postgres can start.
fs.rmSync(path.join(dataDir, 'postmaster.pid'), { force: true });
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PORT_DB, persistent: true });

console.log('Starting embedded PostgreSQL...');
if (!keepData || !alreadyInitialised) await pg.initialise();
await pg.start();
try { await pg.createDatabase('escrow'); } catch {}

console.log('Applying schema...');
const ddl = execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-empty',
  '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', shell: true });
const client = new Client(DATABASE_URL);
await client.connect();
try {
  await client.query(ddl);
} catch (e) {
  if (!keepData) throw e;
  console.log('Schema already present — keeping existing data.');
}
await client.end();

console.log('Seeding demo accounts...');
await new Promise((resolve, reject) => {
  const p = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'prisma/seed.ts'],
    { env: { ...process.env, DATABASE_URL, SEED_ADMIN_EMAIL: 'admin@safepay.test', SEED_ADMIN_PASSWORD: 'admin12345' }, shell: false, stdio: 'inherit' });
  p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error('seed failed'))));
});

console.log('Starting API + web on http://localhost:4000 ...');
const webDir = path.resolve(process.cwd(), '..', 'web');
const docsDir = path.resolve(process.cwd(), '..', 'docs');
const server = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/server.ts'],
  { env: { ...process.env, DATABASE_URL, JWT_SECRET: 'dev-local-secret', SIMULATE_PAYMENTS: 'true', PORT: String(PORT_API), SERVE_WEB_DIR: webDir, SERVE_DOCS_DIR: docsDir }, shell: false, stdio: 'inherit' });

async function shutdown() {
  console.log('\nShutting down...');
  server.kill();
  await sleep(400);
  try { await pg.stop(); } catch {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Wait for health, then print ready banner + demo credentials.
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://localhost:${PORT_API}/health`); if (r.ok) break; } catch {}
  await sleep(500);
}
console.log('\n==============================================');
console.log('  SafePay is ready:  http://localhost:4000');
console.log('  (web app + API both served from this one URL)');
console.log('  Seeded logins:');
console.log('    admin  admin@safepay.test  / admin12345');
console.log('    buyer  buyer@safepay.test  / buyer12345');
console.log('    seller seller@safepay.test / seller12345');
console.log('  Open http://localhost:4000 in your browser.');
console.log('==============================================\n');

setInterval(() => {}, 1 << 30);
