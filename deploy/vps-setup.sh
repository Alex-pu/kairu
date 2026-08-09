#!/usr/bin/env bash
#
# SafePay Escrow — one-shot VPS deployment (Ubuntu / Debian).
# Installs Docker, nginx, HTTPS, a firewall, then builds and starts the whole app.
#
# Run as root, from inside the cloned repo:
#   sudo bash deploy/vps-setup.sh <domain> <admin-email> <admin-password>
#
# Example:
#   sudo bash deploy/vps-setup.sh sasalink.co.ke you@example.com 'ChooseAStrongPassword'
#
# Prerequisite: point DNS first —  A  sasalink.co.ke -> your VPS IP  (and www too),
# otherwise the HTTPS certificate step at the end will fail (re-runnable).

set -euo pipefail

DOMAIN="${1:-}"
ADMIN_EMAIL="${2:-}"
ADMIN_PASSWORD="${3:-}"

if [[ -z "$DOMAIN" || -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  echo "Usage: sudo bash deploy/vps-setup.sh <domain> <admin-email> <admin-password>"
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (use sudo)."
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "==> Repo:   $REPO_DIR"
echo "==> Domain: $DOMAIN"

echo "==> [1/6] Installing prerequisites (git, nginx, ufw, curl)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git ufw nginx

echo "==> [2/6] Installing Docker..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || apt-get install -y docker-compose-plugin
systemctl enable --now docker

echo "==> [3/6] Firewall — allow SSH, HTTP, HTTPS..."
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
yes | ufw enable || true

echo "==> [4/6] Writing secrets (deploy/.env)..."
ENV_FILE="$REPO_DIR/deploy/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  JWT="$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 48)"
  DBP="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
  umask 077
  cat > "$ENV_FILE" <<EOF
JWT_SECRET=$JWT
DB_PASSWORD=$DBP
SIMULATE_PAYMENTS=true
SEED_ADMIN_EMAIL=$ADMIN_EMAIL
SEED_ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF
  echo "    wrote $ENV_FILE (generated JWT + DB password)"
else
  echo "    $ENV_FILE already exists — keeping existing secrets"
fi

echo "==> [5/6] Building and starting the app (Postgres + SafePay)..."
cd "$REPO_DIR/deploy"
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
echo "    waiting for the app to become healthy..."
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:4000/health >/dev/null 2>&1; then echo "    app is up."; break; fi
  sleep 2
done

echo "==> [6/6] nginx reverse proxy + HTTPS for $DOMAIN..."
# Proxy settings shared by every location, so they cannot drift apart.
mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/safepay-proxy.conf <<EOF
proxy_pass http://127.0.0.1:4000;
proxy_http_version 1.1;
proxy_set_header Host \$host;
proxy_set_header X-Real-IP \$remote_addr;
proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto \$scheme;
# The app's own caching headers are replaced per-location.
proxy_hide_header Cache-Control;
EOF

cat > /etc/nginx/sites-available/safepay <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 12m;

    # Compress text payloads. Images/fonts are already compressed, so they are
    # deliberately absent from this list — re-compressing them only burns CPU.
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 512;
    gzip_types text/plain text/css application/javascript application/json
               application/xml image/svg+xml application/manifest+json;

    # Images and fonts: stable filenames whose contents never change in place,
    # so browsers keep them for a month rather than refetching ~1 MB of artwork
    # on every visit.
    location ~* \.(?:png|webp|jpe?g|gif|ico|svg|woff2?|ttf)\$ {
        include snippets/safepay-proxy.conf;
        add_header Cache-Control "public, max-age=2592000" always;
    }

    # CSS/JS carry no content hash, so they revalidate — a 304 costs ~200 bytes
    # instead of resending them, and a deploy still lands immediately.
    location ~* \.(?:css|js)\$ {
        include snippets/safepay-proxy.conf;
        add_header Cache-Control "public, no-cache" always;
    }

    # HTML shell and the API: never cached, so sessions and balances stay live.
    location / {
        include snippets/safepay-proxy.conf;
        add_header Cache-Control "no-store" always;
    }
}
EOF
ln -sf /etc/nginx/sites-available/safepay /etc/nginx/sites-enabled/safepay
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

apt-get install -y certbot python3-certbot-nginx
if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect; then
  echo "    HTTPS enabled."
else
  echo "    !! HTTPS step failed — usually DNS is not pointing here yet."
  echo "       Point  A $DOMAIN -> this server's IP, then re-run:"
  echo "       certbot --nginx -d $DOMAIN -d www.$DOMAIN --agree-tos -m $ADMIN_EMAIL --redirect"
fi

echo ""
echo "==================================================================="
echo "  Deployment finished."
echo "  Site:      https://$DOMAIN"
echo "  Admin:     $ADMIN_EMAIL  (password you provided)"
echo "  Health:    https://$DOMAIN/health"
echo "  API docs:  https://$DOMAIN/docs/api.html"
echo ""
echo "  Update later:   cd $REPO_DIR && git pull && \\"
echo "                  docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml up -d --build"
echo "  Payments are in demo mode (SIMULATE_PAYMENTS=true) until you add real keys."
echo "==================================================================="
