---
name: prod-deploy-local-build
description: Deploy CM-Desk to the DigitalOcean Droplet by building the production Docker image on the laptop. Use when the operator asks to ship, deploy, push to production, update the droplet, or option B.
---

# Production deploy (laptop image)

Production is financially sensitive. Confirm the operator asked to **change** prod (not only diagnose). Prefer after market / weekend.

Full reference: `docs/DEPLOYMENT.md` (Option B, fast path).

## Fast path

```powershell
yarn deploy:prod
```

Or `.\scripts\deploy-option-b.ps1` from repo root.

- Host **`yarn unit-test`** then **BuildKit** docker build (Yarn + Next caches; no in-image tests by default).
- `docker save` → `scp` → `docker load` → `git pull` + `docker compose up -d --no-deps app` on `cm-desk-prod`.
- Waits for `/api/health`.

Flags: `-VerifyInDocker`, `-NoSyncGit`, `-SkipHostTests`. Push `master` before deploy if using server git pull.

## Manual (if script unavailable)

```powershell
$env:DOCKER_BUILDKIT = "1"
yarn unit-test
docker compose build app
docker save cm-desk-app:latest -o cm-desk-app.tar
scp cm-desk-app.tar cm-desk-prod:/tmp/cm-desk-app.tar
ssh -o BatchMode=yes cm-desk-prod -- "docker load -i /tmp/cm-desk-app.tar; rm /tmp/cm-desk-app.tar"
Remove-Item cm-desk-app.tar
ssh -o BatchMode=yes cm-desk-prod -- "cd /srv/cmdesk && git pull origin master && docker compose up -d --no-deps app"
```

Never `docker compose down -v`. Read new `drizzle/` SQL before shipping.

## Verify

```powershell
ssh -o BatchMode=yes cm-desk-prod -- "curl -fsS -m 15 http://127.0.0.1:3000/api/health"
ssh -o BatchMode=yes cm-desk-prod -- "git -C /srv/cmdesk rev-parse --short HEAD"
```

Print `NODE_ENV`, `MOCK_ORDERS`, `SESSION_COOKIE_SECURE`, `TZ` only — never `.env`, secrets, or BullMQ queue names.

SSH: `docs/SSH.md`. Host alias `cm-desk-prod` only.
