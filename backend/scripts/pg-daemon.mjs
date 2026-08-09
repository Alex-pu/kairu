// Starts an embedded PostgreSQL and keeps it running until the process is killed.
import EmbeddedPostgres from 'embedded-postgres';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const PORT = 55432;
const dataDir = path.join(os.tmpdir(), 'safepay-verify-pgdata');
fs.rmSync(dataDir, { recursive: true, force: true });

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PORT, persistent: true });
await pg.initialise();
await pg.start();
try { await pg.createDatabase('escrow'); } catch {}
console.log('PG_READY on', PORT);

process.on('SIGINT', async () => { await pg.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await pg.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
