# Deploy SafePay Escrow to a VPS (Ubuntu/Debian)

Gets `https://sasalink.co.ke` live on your server, permanently. You run ~3 commands; a
single script does the rest (Docker, database, HTTPS, firewall, auto-restart on reboot).

**Server:** `178.162.252.107` · **Domain:** `sasalink.co.ke`

---

## Step 1 — Point the domain at the server (do this first)

In your host's DNS panel for `sasalink.co.ke`, create two **A records**:

| Type | Name | Value |
|------|------|-------|
| A | `@`   (or `sasalink.co.ke`) | `178.162.252.107` |
| A | `www` | `178.162.252.107` |

> If the domain currently points at the old shared host, change it to the VPS IP above.
> DNS can take a few minutes to a couple of hours to propagate. The HTTPS step needs this done.

Check it's pointing correctly (from any computer):
```bash
ping sasalink.co.ke        # should show 178.162.252.107
```

## Step 2 — Log into the VPS

```bash
ssh root@178.162.252.107
```
(Use the root password or SSH key your host gave you. Or use the host's web console.)

## Step 3 — Get the code and run the installer

```bash
apt-get update -y && apt-get install -y git
git clone https://github.com/BlackWeasel0711/Escrow_project.git
cd Escrow_project
sudo bash deploy/vps-setup.sh sasalink.co.ke YOUR_ADMIN_EMAIL 'YOUR_STRONG_PASSWORD'
```

Replace `YOUR_ADMIN_EMAIL` and `YOUR_STRONG_PASSWORD` with the admin login you want.
The script will:

1. Install Docker, nginx, a firewall (ufw)
2. Generate a strong `JWT_SECRET` and database password (saved to `deploy/.env`)
3. Build and start PostgreSQL + the app (auto-restarts on reboot)
4. Configure nginx and get a free Let's Encrypt HTTPS certificate

When it finishes you'll see:
```
Site:      https://sasalink.co.ke
Admin:     YOUR_ADMIN_EMAIL
```

Open **https://sasalink.co.ke** and log in as the admin. Done.

---

## Everyday operations

**Update to the latest code:**
```bash
cd Escrow_project && git pull
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml up -d --build
```

**View logs:**
```bash
docker compose -f deploy/docker-compose.prod.yml logs -f app
```

**Restart / stop:**
```bash
docker compose -f deploy/docker-compose.prod.yml restart
docker compose -f deploy/docker-compose.prod.yml down
```

**HTTPS renews automatically** (certbot installs a timer). To renew manually: `certbot renew`.

---

## Turning on real payments (when ready)

The app runs in **demo mode** (`SIMULATE_PAYMENTS=true`) until you add gateway keys.
Edit `deploy/.env`, set `SIMULATE_PAYMENTS=false`, add your M-Pesa/PayPal/Stripe keys
(see `backend/.env.example`), then re-run the update command above.

For real M-Pesa, set the callback to `https://sasalink.co.ke/api/webhooks/mpesa`.

---

## If the HTTPS step failed
That almost always means DNS wasn't pointing at the server yet. Once `ping sasalink.co.ke`
returns `178.162.252.107`, run:
```bash
certbot --nginx -d sasalink.co.ke -d www.sasalink.co.ke --agree-tos -m YOUR_ADMIN_EMAIL --redirect
```

## Security notes
- `deploy/.env` holds your secrets — it is git-ignored; never commit it.
- Only ports 22 (SSH), 80, 443 are open. The app and database are not exposed directly.
- Consider creating a non-root user and disabling root SSH login after first setup.
