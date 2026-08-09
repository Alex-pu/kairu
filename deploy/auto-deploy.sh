#!/usr/bin/env bash
#
# SafePay continuous deployment — pull side.
#
# Runs on the VPS every couple of minutes (safepay-deploy.timer) and releases new
# commits from GitHub automatically. It is deliberately pull-based: GitHub never
# needs inbound access to this server and no private key or password has to be
# handed to a third party.
#
# Safety rules, in order:
#   1. Never deploy on top of uncommitted local edits — a human is mid-change.
#   2. Never deploy a commit whose CI is failing, and wait while CI is running.
#   3. Verify /health after the release; roll straight back to the previous
#      commit if it does not come up.
#
# Install with: sudo bash deploy/install-autodeploy.sh

set -uo pipefail

BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_URL="http://127.0.0.1:4000/health"
HEALTH_TRIES=45          # x2s = 90s for the container to come up
CI_GRACE_MINUTES=20      # deploy unchecked commits only after CI has had this long

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE=(docker compose --env-file "$REPO_DIR/deploy/.env" -f "$REPO_DIR/deploy/docker-compose.prod.yml")

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

cd "$REPO_DIR" || { log "FATAL: cannot enter $REPO_DIR"; exit 1; }

# --- 1. never clobber work in progress ---------------------------------------
if ! git diff --quiet --ignore-submodules -- || ! git diff --cached --quiet --ignore-submodules --; then
  log "SKIP: uncommitted changes in the working tree — refusing to deploy over them"
  exit 0
fi

git fetch --quiet origin "$BRANCH" || { log "SKIP: could not reach GitHub"; exit 0; }
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
[ "$LOCAL" = "$REMOTE" ] && exit 0     # nothing new; stay quiet

# Only ever move FORWARD. If HEAD is not an ancestor of origin/main the branch
# has diverged — unpushed local commits, or a force-push that rewrote history.
# Releasing would mean `reset --hard` throwing that work away, so stop instead.
if ! git merge-base --is-ancestor "$LOCAL" "$REMOTE"; then
  log "SKIP: HEAD ${LOCAL:0:8} is not an ancestor of origin/$BRANCH ${REMOTE:0:8} — branch diverged, refusing to reset"
  exit 0
fi

log "new commit on $BRANCH: ${REMOTE:0:8} (current ${LOCAL:0:8})"

# --- 2. only release what CI says is good ------------------------------------
SLUG="$(git config --get remote.origin.url | sed -E 's#.*github\.com[:/]([^/]+/[^/]+?)(\.git)?$#\1#')"
CHECKS="$(curl -fsSL -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/$SLUG/commits/$REMOTE/check-runs" 2>/dev/null)"

verdict="none"
if [ -n "$CHECKS" ]; then
  verdict="$(printf '%s' "$CHECKS" | python3 -c '
import sys, json
try:
    runs = json.load(sys.stdin).get("check_runs", [])
except Exception:
    print("none"); raise SystemExit
if not runs:
    print("none")
elif any(r.get("status") != "completed" for r in runs):
    print("pending")
elif any(r.get("conclusion") not in ("success", "neutral", "skipped") for r in runs):
    print("failed")
else:
    print("passed")
' 2>/dev/null)"
fi

case "$verdict" in
  passed)
    log "CI passed — releasing"
    ;;
  pending)
    log "CI still running — will retry on the next tick"
    exit 0
    ;;
  failed)
    log "CI FAILED for ${REMOTE:0:8} — not deploying. Fix the build, then push again."
    exit 0
    ;;
  *)
    # No checks reported. Give CI a chance to appear, then release anyway so a
    # repo without workflows is not stuck forever.
    age_min=$(( ( $(date -u +%s) - $(git log -1 --format=%ct "$REMOTE") ) / 60 ))
    if [ "$age_min" -lt "$CI_GRACE_MINUTES" ]; then
      log "no CI checks yet (commit is ${age_min}m old) — waiting"
      exit 0
    fi
    log "no CI checks after ${age_min}m — releasing without a CI gate"
    ;;
esac

# --- 3. release --------------------------------------------------------------
release() {
  local sha="$1"
  git reset --hard --quiet "$sha" || return 1
  "${COMPOSE[@]}" up -d --build 2>&1 | sed 's/^/    /'
  return "${PIPESTATUS[0]}"
}

healthy() {
  for _ in $(seq 1 "$HEALTH_TRIES"); do
    curl -fsS "$HEALTH_URL" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

log "building and starting ${REMOTE:0:8}…"
if release "$REMOTE" && healthy; then
  log "OK: ${REMOTE:0:8} is live — $(git log -1 --format=%s "$REMOTE")"
  exit 0
fi

log "!! ${REMOTE:0:8} failed to come up — rolling back to ${LOCAL:0:8}"
if release "$LOCAL" && healthy; then
  log "rollback OK: ${LOCAL:0:8} is live again. The bad commit stays unreleased."
else
  log "!! ROLLBACK ALSO FAILED — the site may be down. Check: ${COMPOSE[*]} logs app"
fi
exit 1
