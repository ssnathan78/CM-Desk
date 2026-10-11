# Public hostname

How to serve this desk at `https://cmdesk.senneris.in`, and how to go back to the Droplet IPv4. The IPv4 address stays in nginx and in laptop `~/.ssh/config`. Do not commit it.

Done on **2026-10-11**. Certificate expires **2027-01-09**. Certbot renews it and reloads nginx. `MOCK_ORDERS` is not part of this switch.

Both names can be served at once. The app and Kite follow `NEXT_PUBLIC_APP_URL` and the kite.trade redirect, not whichever nginx site still exists.

| Piece | Domain | IPv4 |
|---|---|---|
| nginx | `sites-available/cmdesk`, Let's Encrypt | IPv4 nginx site, self-signed files in `/etc/nginx/ssl/` |
| App URL | `https://cmdesk.senneris.in` | `https://` plus the Droplet IPv4 |
| Kite redirect | `https://cmdesk.senneris.in/api/redirect_url_kite` | `https://<Droplet IPv4>/api/redirect_url_kite` |
| Cookie | Secure. Log in again after a switch. The other host's cookie is not sent. | Same |

`SESSION_COOKIE_SECURE` stays `true` for both, because both are HTTPS.

## Who can run sudo

`cmdesk` is in the `sudo` group, and its Linux password is **locked**. SSH as `cmdesk` still works with the laptop key. For sudo, SSH as `senthil` (same key, password is enabled) and enter that account's Linux password. That password is not the SSH key passphrase.

```powershell
ssh -t -o User=senthil cm-desk-prod -- sudo bash /home/cmdesk/setup-cmdesk-tls.sh
```

Copy a script up before running it:

```powershell
scp scripts/setup-cmdesk-tls.sh cm-desk-prod:/home/cmdesk/setup-cmdesk-tls.sh
scp scripts/disable-domain-site.sh cm-desk-prod:/home/cmdesk/disable-domain-site.sh
scp scripts/set-public-url.py cm-desk-prod:/home/cmdesk/set-public-url.py
```

`set-public-url.py` writes `/srv/cmdesk/.env` and must run as `cmdesk`, not as root. It prints the new URL only.

Recreating the app restarts workers and runs the entrypoint migrations already on that tree. Prefer a closed market. Never `docker compose down -v`.

## IP address to domain

1. DNS A record: `cmdesk.senneris.in` → Droplet IPv4. Check from the server with `getent hosts cmdesk.senneris.in`.
2. On kite.trade, set the production app redirect to `https://cmdesk.senneris.in/api/redirect_url_kite`. One app has one redirect. Local Docker (`http://127.0.0.1:3000/api/redirect_url_kite`) needs that URL changed back temporarily, or a second paid Kite app.
3. Install the certificate and the domain nginx site. The IPv4 site and the self-signed certificate files stay in place. The script does not copy them.

```powershell
ssh -t -o User=senthil cm-desk-prod -- sudo bash /home/cmdesk/setup-cmdesk-tls.sh
```

Wait until it prints `tls-ready cmdesk.senneris.in`.

4. Point the app at the hostname and recreate only the app container.

```powershell
ssh -o BatchMode=yes cm-desk-prod -- "python3 /home/cmdesk/set-public-url.py https://cmdesk.senneris.in && cd /srv/cmdesk && docker compose up -d --no-deps app && docker exec cm-desk-app printenv NEXT_PUBLIC_APP_URL MOCK_ORDERS SESSION_COOKIE_SECURE"
```

5. Confirm `https://cmdesk.senneris.in/api/health` and log in again at that URL.

## Domain back to the IP address

1. On kite.trade, set the redirect back to `https://<Droplet IPv4>/api/redirect_url_kite`.
2. Point the app at the IP and recreate only the app container. Replace the placeholder with the Droplet address. Do not paste that command into git.

```powershell
ssh -o BatchMode=yes cm-desk-prod -- "python3 /home/cmdesk/set-public-url.py https://DROPLET_IPV4 && cd /srv/cmdesk && docker compose up -d --no-deps app && docker exec cm-desk-app printenv NEXT_PUBLIC_APP_URL MOCK_ORDERS SESSION_COOKIE_SECURE"
```

3. Open `https://<Droplet IPv4>` and accept the self-signed warning, then log in again.
4. Optional. Stop answering the hostname. The certificate and `sites-available/cmdesk` stay on disk.

```powershell
ssh -t -o User=senthil cm-desk-prod -- sudo bash /home/cmdesk/disable-domain-site.sh
```

To serve the hostname again, repeat the domain steps. `setup-cmdesk-tls.sh` keeps the existing certificate until it is due for renewal (`--keep-until-expiring`).
