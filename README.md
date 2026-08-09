# Escrow Website & Android App

A multi-payment escrow platform: buyers pay into escrow, funds are held until delivery is confirmed (or a dispute is resolved by an admin).

## 🌐 Live demo

**https://receives-electronic-fixtures-eminem.trycloudflare.com**

> ⚠️ This is a **temporary** demo link (a Cloudflare quick-tunnel) — it only works while the demo
> machine is running the app, and the address changes if it restarts. Note: some VPN/security DNS
> providers block `trycloudflare.com` entirely; if the link won't resolve, try another network.
> Seeded logins: `admin@safepay.test / admin12345`, `buyer@safepay.test / buyer12345`.

## 🚀 Permanent hosting — one click

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BlackWeasel0711/Escrow_project)

Click the button (or open `https://render.com/deploy?repo=https://github.com/BlackWeasel0711/Escrow_project`),
sign in with GitHub, set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, and Apply — Render provisions the
database + web service from [`render.yaml`](render.yaml) and gives you a permanent `*.onrender.com` URL.

## Structure

- `backend/` — REST API (Node.js/TypeScript/Express/Prisma/PostgreSQL). Start here — see `backend/README.md`.
- `web/` — website frontend (zero-build vanilla SPA). See `web/README.md`.
- `android/` — native Android app (Kotlin + Jetpack Compose + Retrofit). See `android/README.md`.
- `docs/` — OpenAPI spec, interactive API viewer, architecture & deployment notes. See `docs/README.md`.

## Status

Backend core is scaffolded and runnable in simulated-payments mode (no real gateway accounts needed yet):
- Email/password auth (JWT)
- Escrow transaction lifecycle: `CREATED → PAYMENT_PENDING → HELD → SHIPPED → DELIVERED → RELEASED` (seller shipping workflow), with `→ DISPUTED → RELEASED/REFUNDED` at any held stage
- Payment ledger: every deposit/release/refund recorded as a `Payment` row for admin/audit
- Seller reputation (average rating + review count) surfaced on each transaction
- Payment gateway adapters for PayPal, M-Pesa, and Visa (via Stripe), behind one interface — switch `SIMULATE_PAYMENTS=false` once real sandbox credentials are added
- Dispute center (open case, attach evidence, admin ruling)
- Ratings after completed transactions
- Notifications: both parties are actively notified on every status change (in-app, plus email when SMTP is configured)
- Admin overview/users/transactions endpoints

All four deliverables are now in place:
- **Web**: zero-build vanilla SPA — auth, full buyer/seller escrow flow, dispute center, ratings, admin dashboard.
- **Android**: native Kotlin/Compose app mirroring the user-facing flows via Retrofit.
- **Docs**: OpenAPI 3.0 spec (`docs/openapi.yaml` + `docs/api.html` viewer), architecture & deployment notes.
- **Seed + smoke test**: `npm run prisma:seed` creates a first admin and demo users; `backend/scripts/smoke.md`
  scripts the deposit → hold → dispute → release acceptance test for each payment method.

**Verified end-to-end.** `cd backend && npm run verify` stands up a throwaway PostgreSQL, applies the
schema, seeds, boots the API, and drives the full lifecycle — deposit → hold → dispute → release, the
plain confirm-received release, **and** a dispute resolved as a refund — across **all three payment
methods** — plus the full seller shipping workflow (HELD → SHIPPED → DELIVERED → RELEASED), the
payment ledger, admin payments/reviews, and seller reputation — asserting both parties are notified
at every step. **69/69 checks pass** with no external
setup. This satisfies the brief's acceptance criterion (a test transaction moving through each state,
visible in both the admin overview and the user's timeline).

Production-readiness in place:
- **Single-origin app**: the backend serves the website too, so the whole product runs as one service (no CORS, no separate frontend host). `web/config.js` auto-resolves the API URL per environment.
- **One-click hosting**: `render.yaml` blueprint (managed Postgres + one Docker service, HTTPS, generated secret). Also `docker compose up` or `npm run dev:local` → everything on `http://localhost:4000`.
- **HTTPS/TLS**: HSTS headers, `FORCE_HTTPS` redirect (proxy-aware), and optional native TLS (`TLS_KEY_PATH`/`TLS_CERT_PATH`).
- **CI**: `.github/workflows/ci.yml` typechecks + end-to-end verifies the backend (simulated **and** real gateway path), checks the web, and **compiles the Android app** on every push.

Still requires *your* accounts to fully go live: real gateway credentials (the PayPal/M-Pesa/Stripe
integration code already exists behind `SIMULATE_PAYMENTS` — just add keys), and pushing to a host.
