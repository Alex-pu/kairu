# Go-Live Runbook

How to put SafePay Escrow on a **permanent public URL** and switch on **real M-Pesa**.
(For local development, see `backend/README.md` — `npm run dev:local` gives you everything
on http://localhost:4000 with demo accounts.)

---

## 1. Permanent hosting on Render (~15 min, one time)

1. Click **[Deploy to Render](https://render.com/deploy?repo=https://github.com/BlackWeasel0711/Escrow_project)**
   (or dashboard → New + → Blueprint → pick this repo).
2. **Sign in with GitHub** and authorize Render. Free tier works; no card needed.
3. Render reads [`render.yaml`](render.yaml) and provisions:
   - `safepay-db` — managed PostgreSQL
   - `safepay` — one Docker web service serving the **API + website + /docs** together
4. Enter the two secrets it asks for (kept out of Git on purpose):
   - `SEED_ADMIN_EMAIL` — your admin login email
   - `SEED_ADMIN_PASSWORD` — a strong password
   (On first boot the server creates/repairs this admin automatically — `src/bootstrap.ts`.)
5. Click **Apply**. First build ≈ 5–10 min. When the service shows **Live**, your permanent
   URL is at the top: `https://safepay-XXXX.onrender.com`.

**Free-tier note:** the service sleeps after ~15 idle minutes and wakes in ~30–50 s on the
next visit. The URL itself never changes or dies. Upgrade the plan to stay always-on.

## 2. Auto-deploy on every push (30 s, one time)

1. Render → your `safepay` service → **Settings → Deploy Hook** → copy the URL.
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `RENDER_DEPLOY_HOOK`
   - Value: the copied hook URL
3. Done. The CI/CD pipeline (`.github/workflows/ci.yml`) already has a deploy stage:
   every push to `main` now runs **tests → Docker build → deploy** automatically.

## 3. Real M-Pesa (Daraja) — leave practice mode

Payments run simulated (`SIMULATE_PAYMENTS=true`) until you add gateway keys.

1. Create a (free) app at https://developer.safaricom.co.ke → copy its keys.
2. Render → service → **Environment** → add:

   | Variable | Value |
   |---|---|
   | `SIMULATE_PAYMENTS` | `false` |
   | `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | from your Daraja app |
   | `MPESA_SHORTCODE` | `174379` (sandbox Paybill) |
   | `MPESA_PASSKEY` | sandbox passkey from Daraja |
   | `MPESA_TEST_MSISDN` | sandbox test phone number |
   | `MPESA_STK_CALLBACK_URL` | `https://<your-render-url>/api/webhooks/mpesa/stk` |
   | `MPESA_B2C_RESULT_URL` | `https://<your-render-url>/api/webhooks/mpesa/b2c/result` |
   | `MPESA_B2C_TIMEOUT_URL` | `https://<your-render-url>/api/webhooks/mpesa/b2c/timeout` |

3. The STK flow is already wired end-to-end: deposit stays `PAYMENT_PENDING` until the
   buyer approves on their phone; Safaricom then calls `/api/webhooks/mpesa`, which locks
   the funds (`HELD`) and notifies both parties. The callback **must be public HTTPS**
   (your Render URL is), never `localhost`.
4. Payouts/refunds to real phones additionally need `MPESA_INITIATOR_NAME`,
   `MPESA_SECURITY_CREDENTIAL` (and optionally `MPESA_B2C_SHORTCODE`) — issued by
   Safaricom for a live B2C shortcode. PayPal/Visa keys are analogous (see `.env.example`).

## 4. Verify after any deploy

- `https://<url>/health` → `{"status":"ok"}`
- Log in as the admin you seeded; check the dashboard loads.
- API reference: `https://<url>/docs/api.html`
- Full local proof (spins up its own DB, 72 checks): `cd backend && npm run verify`
  — the same suite CI runs on every push.

## Why not the trycloudflare demo link?

Quick-tunnels are for demos only: the address expires, changes on every restart, requires
the demo PC to stay awake, and some VPN/DNS providers block the whole `trycloudflare.com`
domain. Render (or any Docker host — see `Dockerfile`, `docker-compose.yml`) is the real home.
