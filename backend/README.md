# Escrow Backend

REST API for the escrow platform: auth, escrow transactions (deposit → hold → dispute → release/refund), disputes, ratings, and admin.

## Setup

1. Install [PostgreSQL](https://www.postgresql.org/download/) (or use a hosted one) and create a database named `escrow`.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `JWT_SECRET`. Leave `SIMULATE_PAYMENTS=true` for now — it fakes payment gateway calls so you can run the full escrow flow with no real accounts.
4. `npm run prisma:migrate` — creates the tables.
5. `npm run prisma:seed` — creates a first admin + demo buyer/seller (see `prisma/seed.ts`).
6. `npm run dev` — starts the API on `http://localhost:4000`.

### Database access (Prisma + node-postgres driver adapter)

The Prisma client is configured with the **`@prisma/adapter-pg` driver adapter** (`src/prisma.ts`), so
queries run through the `pg` driver rather than Prisma's bundled query engine. This is the recommended
setup for serverless/edge and keeps connection handling in one well-understood driver. Nothing extra is
required to use it — just a reachable `DATABASE_URL`.

### One-command end-to-end verification

`npm run verify` spins up a throwaway **embedded PostgreSQL**, applies the schema, seeds, boots the API,
and drives the full lifecycle (deposit → hold → dispute → release, plus the plain confirm-received
release) across all three payment methods — no external database or config needed. It's a self-contained
proof that the whole stack works; see `scripts/verify.mjs`. `npm run db:local` starts just the embedded
database if you want to point `npm run dev` at it (`postgresql://postgres:postgres@127.0.0.1:55432/escrow`).

### Verifying the real payment code (no credentials needed)

`npm run verify:live` runs the stack with **`SIMULATE_PAYMENTS=false`** against local **mock
gateways** that mimic the real Daraja / PayPal / Stripe API shapes. This exercises the actual
integration code — OAuth token fetch, STK push / order / payment-intent creation, and B2C payout /
capture / reversal / refund — proving it works before you plug in live keys. (`npm run verify` covers
the same escrow lifecycle via the simulated path.)

## Adding real payment gateways later

Each gateway lives in `src/modules/payments/*.gateway.ts` behind the same `PaymentGateway` interface (`deposit`, `release`, `refund`). To go live with one:

- **PayPal**: create a sandbox app at developer.paypal.com, set `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`.
- **M-Pesa**: create a Daraja app at developer.safaricom.co.ke, set the `MPESA_*` vars. Deposits use STK Push; payouts (release) need a production B2C-enabled shortcode from Safaricom.
- **Visa**: create a Stripe account, set `STRIPE_SECRET_KEY` (test mode keys work first).

Then set `SIMULATE_PAYMENTS=false`.

## API overview

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/auth/register` / `login` | — | Email+password auth, returns a JWT |
| `POST /api/transactions` | user | Create an escrow + deposit funds |
| `GET /api/transactions` | user | List my transactions |
| `GET /api/transactions/:id` | user | Transaction detail + event timeline |
| `POST /api/transactions/:id/confirm-received` | buyer | Release held funds to seller |
| `POST /api/disputes` | user | Open a dispute on a held transaction |
| `POST /api/disputes/:id/evidence` | user | Attach more evidence |
| `GET /api/disputes` | admin | Queue of open/under-review disputes |
| `POST /api/disputes/:id/rule` | admin | Rule RELEASE or REFUND |
| `POST /api/ratings` | user | Rate the other party after release |
| `GET /api/ratings/users/:userId` | — | A user's average rating |
| `GET /api/notifications` | user | My notifications + unread count |
| `POST /api/notifications/read-all` | user | Mark all my notifications read |
| `POST /api/notifications/:id/read` | user | Mark one notification read |
| `GET /api/admin/overview` | admin | Totals: held funds, open disputes, users |
| `GET /api/admin/users` / `transactions` | admin | Full listings |

Full request/response schemas are enforced with `zod` in each `*.routes.ts` file — read those for exact payload shapes until formal OpenAPI docs are generated.
