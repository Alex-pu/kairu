#!/usr/bin/env bash
#
# Installs the continuous-deployment timer. Run once, as root, from the repo:
#   sudo bash deploy/install-autodeploy.sh
#
# Afterwards every push to main that passes CI is released automatically, with a
# health check and rollback. Watch it with:
#   journalctl -u safepay-deploy -f      (or: tail -f /var/log/safepay-deploy.log)
# Pause it with:  systemctl disable --now safepay-deploy.timer

set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Please run as root (sudo)."; exit 1; }

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INTERVAL="${DEPLOY_INTERVAL:-2min}"

chmod +x "$REPO_DIR/deploy/auto-deploy.sh"

cat > /etc/systemd/system/safepay-deploy.service <<EOF
[Unit]
Description=SafePay — release new commits from GitHub (CI-gated, with rollback)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_DIR
ExecStart=/bin/bash $REPO_DIR/deploy/auto-deploy.sh
StandardOutput=append:/var/log/safepay-deploy.log
StandardError=append:/var/log/safepay-deploy.log
EOF

cat > /etc/systemd/system/safepay-deploy.timer <<EOF
[Unit]
Description=Check GitHub for new SafePay releases

[Timer]
OnBootSec=3min
OnUnitActiveSec=$INTERVAL
AccuracySec=15s

[Install]
WantedBy=timers.target
EOF

touch /var/log/safepay-deploy.log
systemctl daemon-reload
systemctl enable --now safepay-deploy.timer

echo "Continuous deployment is on (checks every $INTERVAL)."
echo "Logs: /var/log/safepay-deploy.log"
