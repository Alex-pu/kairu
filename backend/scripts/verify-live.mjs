/**
 * REAL payment-path verification. Runs the stack with SIMULATE_PAYMENTS=false so the
 * genuine PayPal / M-Pesa / Stripe gateway code executes (token fetch, order/STK/intent
 * creation, payout/capture, refund/reversal) — pointed at local mock gateways that mimic
 * the real API shapes. Proves the integration code is correct without live credentials.
 *
 * Run: npm run verify:live
 */
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { startMockGateways } from './mock-gateways.mjs';

const PORT_DB = 55433;
const PORT_API = 4066;
const PORT_MOCK = 6001;
const API = `http://127.0.0.1:${PORT_API}/api`;
const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT_DB}/escrow`;
const dataDir = path.join(os.tmpdir(), 'safepay-live-pgdata');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => (cond ? (console.log(`  ✓ ${name}`), pass++) : (console.log(`  ✗ ${name} ${extra}`), fail++));

async function api(p, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

/** Polls a transaction until it reaches the target status (or gives up). */
async function waitForStatus(id, token, target, tries = 25) {
  let tx;
  for (let i = 0; i < tries; i++) {
    tx = (await api(`/transactions/${id}`, { token })).data;
    if (tx?.status === target) return tx;
    await sleep(150);
  }
  return tx;
}

async function releasePath(method, mockPort) {
  console.log(`\n--- ${method}: deposit -> release (real gateway calls) ---`);
  const suffix = `${method.toLowerCase()}_live`;
  const buyer = (await api('/auth/register', { method: 'POST', body: { email: `b_${suffix}@t.test`, password: 'password123', fullName: 'Test User', phone: '254700000000' } })).data.token;
  await api('/auth/register', { method: 'POST', body: { email: `s_${suffix}@t.test`, password: 'password123', fullName: 'Test User', phone: '254700000000' } });

  const created = await api('/transactions', { method: 'POST', token: buyer, body: { sellerEmail: `s_${suffix}@t.test`, description: `Live ${method}`, amountCents: 250000, method } });
  check(`${method}: deposit succeeded (real STK/order/intent)`, created.status === 201, `HTTP ${created.status}: ${JSON.stringify(created.data)}`);
  let tx = created.data;
  if (tx?.status === 'PAYMENT_PENDING') {
    // Asynchronous M-Pesa STK: push accepted, funds not captured until the webhook fires.
    check(`${method}: STK push accepted — awaiting buyer approval (PAYMENT_PENDING)`, true);
    tx = await waitForStatus(tx.id, buyer, 'HELD');
    check(`${method}: webhook confirmation captured funds (HELD)`, tx?.status === 'HELD', `got ${tx?.status}`);
  } else {
    check(`${method}: status HELD`, tx?.status === 'HELD', `got ${tx?.status}`);
  }
  check(`${method}: gatewayRef is a REAL ref (not simulated)`, tx?.gatewayRef && !/SIMULATED/.test(tx.gatewayRef), `got ${tx?.gatewayRef}`);

  const rel = await api(`/transactions/${tx.id}/confirm-received`, { method: 'POST', token: buyer });
  check(`${method}: release succeeded (real payout/capture)`, rel.status === 200 && rel.data?.status === 'RELEASED', `HTTP ${rel.status}: ${JSON.stringify(rel.data)}`);
}

async function refundPath(method, adminToken) {
  console.log(`\n--- ${method}: deposit -> dispute -> REFUND (real reversal/refund) ---`);
  const suffix = `${method.toLowerCase()}_ref`;
  const buyer = (await api('/auth/register', { method: 'POST', body: { email: `b_${suffix}@t.test`, password: 'password123', fullName: 'Test User', phone: '254700000000' } })).data.token;
  await api('/auth/register', { method: 'POST', body: { email: `s_${suffix}@t.test`, password: 'password123', fullName: 'Test User', phone: '254700000000' } });
  let tx = (await api('/transactions', { method: 'POST', token: buyer, body: { sellerEmail: `s_${suffix}@t.test`, description: `Refund ${method}`, amountCents: 180000, method } })).data;
  if (tx?.status === 'PAYMENT_PENDING') tx = await waitForStatus(tx.id, buyer, 'HELD'); // let the STK webhook capture first
  await api('/disputes', { method: 'POST', token: buyer, body: { transactionId: tx.id, reason: 'not delivered' } });
  const d = (await api('/disputes', { token: adminToken })).data.find((x) => x.transactionId === tx.id);
  const ruling = await api(`/disputes/${d.id}/rule`, { method: 'POST', token: adminToken, body: { ruling: 'REFUND' } });
  check(`${method}: refund ruling succeeded (real reversal/refund call)`, ruling.status === 200, `HTTP ${ruling.status}: ${JSON.stringify(ruling.data)}`);
  const fin = (await api(`/transactions/${tx.id}`, { token: buyer })).data;
  check(`${method}: final status REFUNDED`, fin.status === 'REFUNDED', `got ${fin.status}`);
}

async function main() {
  fs.rmSync(dataDir, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PORT_DB, persistent: false });
  console.log('Starting embedded PostgreSQL...');
  await pg.initialise(); await pg.start(); await pg.createDatabase('escrow');

  console.log('Starting mock payment gateways...');
  const mock = await startMockGateways(PORT_MOCK);

  let server;
  try {
    console.log('Applying schema...');
    const ddl = execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', shell: true });
    const client = new Client(DATABASE_URL); await client.connect(); await client.query(ddl); await client.end();

    console.log('Seeding admin...');
    await new Promise((resolve, reject) => {
      const p = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'prisma/seed.ts'],
        { env: { ...process.env, DATABASE_URL, SEED_ADMIN_EMAIL: 'admin@safepay.test', SEED_ADMIN_PASSWORD: 'admin12345' }, shell: false, stdio: 'inherit' });
      p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error('seed failed'))));
    });

    console.log('Starting API with SIMULATE_PAYMENTS=false, gateways -> mock...\n');
    const mockBase = `http://127.0.0.1:${PORT_MOCK}`;
    server = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/server.ts'], {
      env: {
        ...process.env, DATABASE_URL, JWT_SECRET: 'live-secret', PORT: String(PORT_API),
        SIMULATE_PAYMENTS: 'false',
        // M-Pesa / Daraja
        MPESA_BASE_URL: mockBase, MPESA_CONSUMER_KEY: 'mock', MPESA_CONSUMER_SECRET: 'mock',
        MPESA_SHORTCODE: '174379', MPESA_PASSKEY: 'mock', MPESA_TEST_MSISDN: '254708374149',
        MPESA_CALLBACK_URL: `http://127.0.0.1:${PORT_API}/api/webhooks/mpesa`, MPESA_INITIATOR_NAME: 'testapi',
        MPESA_SECURITY_CREDENTIAL: 'mock', MPESA_B2C_SHORTCODE: '600000',
        // PayPal
        PAYPAL_BASE_URL: mockBase, PAYPAL_CLIENT_ID: 'mock', PAYPAL_CLIENT_SECRET: 'mock',
        PAYPAL_PAYOUT_PLACEHOLDER_EMAIL: 'seller@example.com',
        // Stripe / Visa
        STRIPE_BASE_URL: `${mockBase}/v1`, STRIPE_SECRET_KEY: 'sk_test_mock',
      },
      shell: false, stdio: 'inherit',
    });

    for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT_API}/health`)).ok) break; } catch {} await sleep(500); }

    console.log('=== REAL GATEWAY-PATH TESTS ===');
    const admin = (await api('/auth/login', { method: 'POST', body: { email: 'admin@safepay.test', password: 'admin12345' } })).data.token;
    check('admin login', !!admin);

    for (const m of ['MPESA', 'PAYPAL', 'VISA']) await releasePath(m, PORT_MOCK);
    for (const m of ['MPESA', 'PAYPAL', 'VISA']) await refundPath(m, admin);
  } finally {
    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
    if (server) server.kill();
    mock.close();
    await sleep(400);
    await pg.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
