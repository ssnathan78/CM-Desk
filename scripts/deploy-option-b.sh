#!/usr/bin/env bash
# Option B (bash/WSL): same flow as deploy-option-b.ps1
set -euo pipefail
cd "$(dirname "$0")/.."

SSH_HOST="${SSH_HOST:-cm-desk-prod}"
REMOTE_DIR="${REMOTE_DIR:-/srv/cmdesk}"
IMAGE="${IMAGE:-cm-desk-app:latest}"
VERIFY_IN_DOCKER="${VERIFY_IN_DOCKER:-false}"
SKIP_HOST_TESTS="${SKIP_HOST_TESTS:-false}"
SYNC_GIT="${SYNC_GIT:-false}"

step() { echo ""; echo "==> $*"; }

if [[ "$SKIP_HOST_TESTS" != "true" ]]; then
  step "yarn unit-test (host)"
  yarn unit-test
fi

export DOCKER_BUILDKIT=1
export VERIFY_UNIT_TESTS="$VERIFY_IN_DOCKER"

step "docker compose build app"
docker compose build app

TAR="${TMPDIR:-/tmp}/cm-desk-app.tar"
rm -f "$TAR"
step "docker save"
docker save "$IMAGE" -o "$TAR"

step "scp + load"
scp "$TAR" "${SSH_HOST}:/tmp/cm-desk-app.tar"
rm -f "$TAR"
ssh -o BatchMode=yes "$SSH_HOST" -- "docker load -i /tmp/cm-desk-app.tar; rm -f /tmp/cm-desk-app.tar"

GIT_PULL=""
if [[ "$SYNC_GIT" == "true" ]]; then
  GIT_PULL="git pull origin master && "
fi

step "recreate app"
ssh -o BatchMode=yes "$SSH_HOST" -- "cd $REMOTE_DIR && ${GIT_PULL}docker compose up -d --no-deps app"

step "health"
for i in $(seq 1 12); do
  if ssh -o BatchMode=yes "$SSH_HOST" -- "curl -fsS -m 10 http://127.0.0.1:3000/api/health" | grep -q '"status":"ok"'; then
    ssh -o BatchMode=yes "$SSH_HOST" -- "curl -fsS -m 10 http://127.0.0.1:3000/api/health"
    echo ""
    echo "Deploy complete."
    exit 0
  fi
  sleep 5
done
echo "Health check failed" >&2
exit 1
