# Escrow Web Client

A zero-build, single-page front end for the escrow API. Plain HTML/CSS/JS — no framework, no bundler, no `npm install`.

## Run

1. Start the backend (`cd ../backend && npm run dev`) so the API is up on `http://localhost:4000`.
2. Serve this folder over HTTP (opening `index.html` via `file://` breaks fetch/CORS). Any static server works:
   ```
   npx serve .          # or: python -m http.server 5173
   ```
3. Open the printed URL (e.g. `http://localhost:3000`).

If the API runs somewhere else, edit `API_BASE` in [config.js](config.js).

## What's here

| File | Purpose |
|---|---|
| `index.html` | App shell (top bar, view container, toast). |
| `config.js` | Runtime API base URL — the only thing to change per environment. |
| `styles.css` | Dark theme, cards, badges, timeline, tables. |
| `app.js` | SPA: hash router, JWT session, API client, and all views. |

## Features

- Email/password register + login, JWT stored in `localStorage`, auto-expiry check.
- Buyer flow: create escrow (deposit) → view held funds → confirm received (release) → rate.
- Dispute center: open a dispute with evidence while funds are held.
- Transaction detail with full status timeline.
- Admin dashboard (shown only for `ADMIN` accounts): overview stats, dispute queue with
  release/refund rulings, and a full transaction listing.

The client role-gates the UI by decoding the JWT; the backend enforces authorization on every route.
