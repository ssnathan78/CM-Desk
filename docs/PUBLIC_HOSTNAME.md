# Public hostname

How to serve this desk at `https://cmdesk.senneris.in`. The Droplet IPv4 stays in laptop `~/.ssh/config` only. Do not commit it.

Done on **2026-10-11**. Certificate expires **2027-01-09**. Certbot renews it and reloads nginx. `MOCK_ORDERS` is not part of this switch.

The public nginx site is `cmdesk.senneris.in` only. The old IPv4 site and its self-signed certificate were removed the same day. Opening the desk by IP does not work until a new nginx server block is written. The app and Kite follow `NEXT_PUBLIC_APP_URL` and the kite.trade redirect.

| Piece | Domain |
|---|---|
| nginx | `sites-available/cmdesk`, Let's Encrypt |
| App URL | `https://cmdesk.senneris.in` |
| Kite redirect | `https://cmdesk.senneris.in/api/redirect_url_kite` |
| Cookie | Secure. Log in again after a host change. |

`SESSION_COOKIE_SECURE` stays `true`, because the public URL is HTTPS.

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
3. Install the certificate and the domain nginx site.

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

The IPv4 nginx site is gone. Changing Kite and `NEXT_PUBLIC_APP_URL` is not enough: nginx has to grow a new server block for that address, with a certificate browsers will accept or a new self-signed certificate you create at the time. `disable-domain-site.sh` refuses to turn off `cmdesk` while it is the only enabled site.

To serve the hostname again after that, repeat the domain steps. `setup-cmdesk-tls.sh` keeps the existing certificate until it is due for renewal (`--keep-until-expiring`).
