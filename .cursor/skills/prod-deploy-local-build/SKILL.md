---
name: prod-deploy-local-build
description: Deploy CM-Desk to the DigitalOcean Droplet by building the production Docker image on the laptop. Use when the operator asks to ship, deploy, push to production, update the droplet, or option B.
---

# Production deploy (laptop image)

Production is financially sensitive. Confirm the operator asked to **change** prod (not only diagnose). Prefer after market / weekend.

## 1. Git

Commit only real content (skip CRLF-dirty files with empty `git diff --stat`). Push `master` if asked.

## 2. Build on the laptop

```powershell
docker compose build app
```

Image name: `cm-desk-app:latest`. Unit tests run inside the build.

## 3. Copy and load

```powershell
docker save cm-desk-app:latest -o cm-desk-app.tar
scp cm-desk-app.tar cm-desk-prod:/tmp/cm-desk-app.tar
ssh -o BatchMode=yes cm-desk-prod -- "docker load -i /tmp/cm-desk-app.tar; rm /tmp/cm-desk-app.tar"
Remove-Item cm-desk-app.tar
```

Do not pipe `docker save` through PowerShell if it corrupts the archive.

## 4. Recreate app only

```powershell
ssh -o BatchMode=yes cm-desk-prod -- "cd /srv/cmdesk && git pull origin master && docker compose up -d --no-deps app"
```

Never `docker compose down -v`. Leave postgres/redis. Read new `drizzle/` SQL before shipping (entrypoint migrates).

## 5. Verify

```powershell
ssh -o BatchMode=yes cm-desk-prod -- "curl -fsS -m 15 http://127.0.0.1:3000/api/health"
ssh -o BatchMode=yes cm-desk-prod -- "git -C /srv/cmdesk rev-parse --short HEAD"
```

Print `NODE_ENV`, `MOCK_ORDERS`, `SESSION_COOKIE_SECURE`, `TZ`. Never print `.env`, secrets, or BullMQ queue names.

SSH: `docs/SSH.md`. Host alias `cm-desk-prod` only.
