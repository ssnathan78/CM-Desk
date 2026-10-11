#!/bin/bash
# Issue or reuse a Let's Encrypt certificate for cmdesk.senneris.in.
# See docs/PUBLIC_HOSTNAME.md.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo" >&2
  exit 1
fi

DOMAIN="cmdesk.senneris.in"
WEBROOT="/var/www/html"
AVAIL="/etc/nginx/sites-available/cmdesk"
ENABLED="/etc/nginx/sites-enabled/cmdesk"

install -d -m 755 "${WEBROOT}/.well-known/acme-challenge"

cat > "${AVAIL}" << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name cmdesk.senneris.in;

    location ^~ /.well-known/acme-challenge/ {
        default_type "text/plain";
        root /var/www/html;
    }

    location / {
        return 301 https://cmdesk.senneris.in$request_uri;
    }
}
EOF

ln -sfn "${AVAIL}" "${ENABLED}"
nginx -t
systemctl reload nginx

certbot certonly --webroot -w "${WEBROOT}" -d "${DOMAIN}" \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --keep-until-expiring \
  --deploy-hook "systemctl reload nginx"

cat > "${AVAIL}" << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name cmdesk.senneris.in;

    location ^~ /.well-known/acme-challenge/ {
        default_type "text/plain";
        root /var/www/html;
    }

    location / {
        return 301 https://cmdesk.senneris.in$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name cmdesk.senneris.in;

    ssl_certificate /etc/letsencrypt/live/cmdesk.senneris.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cmdesk.senneris.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozSSL:10m;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

nginx -t
systemctl reload nginx
echo "tls-ready ${DOMAIN}"
