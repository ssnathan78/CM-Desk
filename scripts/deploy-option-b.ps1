# Option B: build production image on the laptop, load on the Droplet, recreate app only.
# Requires: Docker, ssh host alias cm-desk-prod (see docs/SSH.md), pushed git commit if you use -SyncGit.
#
# Usage:
#   .\scripts\deploy-option-b.ps1
#   .\scripts\deploy-option-b.ps1 -VerifyInDocker          # also run unit tests inside docker build
#   .\scripts\deploy-option-b.ps1 -SkipHostTests         # skip yarn unit-test on laptop (not recommended)
#   .\scripts\deploy-option-b.ps1 -NoSyncGit             # image-only: skip git pull on server
#   .\scripts\deploy-option-b.ps1 -SkipGitPull           # same as -NoSyncGit

param(
  [string] $SshHost = "cm-desk-prod",
  [string] $RemoteDir = "/srv/cmdesk",
  [string] $Image = "cm-desk-app:latest",
  [switch] $VerifyInDocker,
  [switch] $SkipHostTests,
  [switch] $SkipGitPull,
  [switch] $NoSyncGit
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Write-Step([string] $Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

if (-not $SkipHostTests) {
  Write-Step "yarn unit-test (host)"
  yarn unit-test
} else {
  Write-Warning "Skipping host unit tests (-SkipHostTests)."
}

$env:DOCKER_BUILDKIT = "1"
if ($VerifyInDocker) {
  $env:VERIFY_UNIT_TESTS = "true"
} else {
  $env:VERIFY_UNIT_TESTS = "false"
}

Write-Step "docker compose build app (BuildKit cache; VERIFY_UNIT_TESTS=$env:VERIFY_UNIT_TESTS)"
docker compose build app
if ($LASTEXITCODE -ne 0) { throw "docker compose build failed" }

$tar = Join-Path $env:TEMP "cm-desk-app.tar"
if (Test-Path $tar) { Remove-Item -Force $tar }

Write-Step "docker save -> $tar"
docker save $Image -o $tar
if ($LASTEXITCODE -ne 0) { throw "docker save failed" }

Write-Step "scp image to $SshHost"
scp $tar "${SshHost}:/tmp/cm-desk-app.tar"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }

Remove-Item -Force $tar

Write-Step "docker load on server"
ssh -o BatchMode=yes $SshHost -- "docker load -i /tmp/cm-desk-app.tar; rm -f /tmp/cm-desk-app.tar"
if ($LASTEXITCODE -ne 0) { throw "docker load failed" }

$gitPull = ""
if (-not $SkipGitPull -and -not $NoSyncGit) {
  # Default: pull so /srv/cmdesk matches the shipped commit (compose, drizzle list, debugging).
  $gitPull = "git pull origin master && "
}

Write-Step "recreate app container"
ssh -o BatchMode=yes $SshHost -- "cd $RemoteDir && ${gitPull}docker compose up -d --no-deps app"
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }

Write-Step "wait for health"
$ok = $false
foreach ($i in 1..12) {
  Start-Sleep -Seconds 5
  try {
    $health = ssh -o BatchMode=yes $SshHost -- "curl -fsS -m 10 http://127.0.0.1:3000/api/health" 2>$null
    if ($health -match '"status"\s*:\s*"ok"') {
      $ok = $true
      Write-Host $health
      break
    }
  } catch {
    # retry
  }
  Write-Host "  ... not ready ($i/12)"
}
if (-not $ok) {
  throw "Health check did not pass. Check: ssh $SshHost -- docker logs --tail 80 cm-desk-app"
}

$rev = ssh -o BatchMode=yes $SshHost -- "git -C $RemoteDir rev-parse --short HEAD 2>/dev/null || echo unknown"
Write-Host ""
Write-Host "Deploy complete. Server tree: $rev" -ForegroundColor Green
Write-Host "MOCK_ORDERS and secrets: check Desk / Risk — not printed here."
