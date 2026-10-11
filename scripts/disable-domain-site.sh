#!/bin/bash
# Stop nginx from serving cmdesk.senneris.in. Does not delete the
# Let's Encrypt certificate or the self-signed IP certificate.
# See docs/PUBLIC_HOSTNAME.md.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo" >&2
  exit 1
fi

ip_site_enabled=0
for site in /etc/nginx/sites-enabled/*; do
  base="$(basename "${site}")"
  if [[ "${base}" == "cmdesk" ]]; then
    continue
  fi
  target="${site}"
  if [[ -L "${site}" ]]; then
    target="$(readlink -f "${site}")"
  fi
  if grep -q "nginx-selfsigned" "${target}"; then
    ip_site_enabled=1
    break
  fi
done
if [[ "${ip_site_enabled}" -ne 1 ]]; then
  echo "IPv4 site is not enabled; refusing to disable the domain site" >&2
  exit 1
fi

rm -f /etc/nginx/sites-enabled/cmdesk
nginx -t
systemctl reload nginx
echo "domain-site-disabled"
