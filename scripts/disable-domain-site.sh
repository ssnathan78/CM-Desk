#!/bin/bash
# Stop nginx from serving cmdesk.senneris.in. Does not delete the
# Let's Encrypt certificate. Refuses when this is the only enabled site.
# See docs/PUBLIC_HOSTNAME.md.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo" >&2
  exit 1
fi

other_sites=0
for site in /etc/nginx/sites-enabled/*; do
  base="$(basename "${site}")"
  if [[ "${base}" == "cmdesk" ]]; then
    continue
  fi
  other_sites=$((other_sites + 1))
done
if [[ "${other_sites}" -lt 1 ]]; then
  echo "cmdesk is the only enabled site; refusing to disable it" >&2
  exit 1
fi

rm -f /etc/nginx/sites-enabled/cmdesk
nginx -t
systemctl reload nginx
echo "domain-site-disabled"
