# Hostinger VPS deploy — operator notes

Live at **https://seowebsitesbuilder.com**. This is what's on the box and how to operate it.

## Server layout

| What | Where | Port (internal) | Public via |
|---|---|---|---|
| Caddy (TLS + reverse proxy) | systemd service | 80, 443 | direct |
| Next.js web (`seo-web`) | `pm2` → `apps/web/node_modules/.bin/next start` | 3000 (127.0.0.1) | Caddy `/` |
| Orchestrator (`seo-orchestrator`) | `pm2` → `tsx apps/orchestrator/src/index.ts` | 4000 (127.0.0.1) | Caddy `/auth /projects /llm /preview /ws /healthz` |
| Postgres 16 | docker compose service | 5432 (127.0.0.1) | — |
| Per-project containers | spawned by orchestrator via `/var/run/docker.sock` | dynamic | Caddy `/preview/:id` → orchestrator → container |
| openclaw (Hostinger-managed) | docker (pre-existing) | 64586 | direct |

Project source: `/opt/seowebsitesbuilder` (rsynced; not a git checkout yet).
User project volumes: `/var/seobuilder/projects/<projectId>` (bind-mounted into per-project containers).
Secrets: `/opt/seowebsitesbuilder/.env` (mode 600, root). Contains the Postgres password and JWT secret.

## Common operations

```bash
# Tail logs
pm2 logs seo-orchestrator
pm2 logs seo-web

# Restart after editing .env or pulling code
cd /opt/seowebsitesbuilder
pm2 restart all --update-env

# Rebuild the web app after frontend changes
cd /opt/seowebsitesbuilder/apps/web
NEXT_PUBLIC_ORCHESTRATOR_URL=https://seowebsitesbuilder.com pnpm build
pm2 restart seo-web

# Postgres console
docker compose -f /opt/seowebsitesbuilder/docker-compose.yml exec postgres psql -U seo -d seobuilder

# Reload Caddy after editing /etc/caddy/Caddyfile
systemctl reload caddy
```

## Enabling AI chat

The orchestrator is **BYOK** — every user brings their own Anthropic / OpenAI / Google Gemini / OpenAI-compatible key via the `/settings` page in the editor. No server-side keys to set; this is automatic.

## Enabling OAuth (GitHub + Google)

The login/signup pages auto-hide OAuth buttons when no provider is configured. To turn them on:

### GitHub

1. github.com/settings/developers → **New OAuth App**
   - Homepage URL: `https://seowebsitesbuilder.com`
   - Authorization callback URL: `https://seowebsitesbuilder.com/api/oauth/github/callback`
2. Click "Generate a new client secret", copy both the **Client ID** and **Client secret**.

### Google

1. console.cloud.google.com → APIs & Services → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: Web application
   - Authorized JavaScript origins: `https://seowebsitesbuilder.com`
   - Authorized redirect URIs: `https://seowebsitesbuilder.com/api/oauth/google/callback`
2. Copy the **Client ID** and **Client secret**.

### Add to env and restart

```bash
nano /opt/seowebsitesbuilder/.env       # paste the four values:
#   GITHUB_CLIENT_ID=…
#   GITHUB_CLIENT_SECRET=…
#   GOOGLE_CLIENT_ID=…
#   GOOGLE_CLIENT_SECRET=…
#   OAUTH_REDIRECT_BASE=https://seowebsitesbuilder.com   # optional, defaults to this
```

Then add them to the orchestrator's `env` block in `ecosystem.config.cjs` (same pattern as `KEY_ENCRYPTION_SECRET` / `STRIPE_SECRET_KEY`), and:

```bash
pm2 delete all && pm2 start ecosystem.config.cjs && pm2 save
```

The buttons appear on `/login` and `/signup` within seconds. New OAuth users get the same auto-starter project as email signups.

**Linking behavior**: if a user later signs in with GitHub using the same email they registered with via password (or vice versa), the OAuth account is linked to the existing user automatically.

## Enabling Stripe billing

The `/billing` endpoints work in stub mode out of the box — `GET /api/billing/me` returns plan info, `POST /api/billing/checkout-session` returns `503 Billing not configured`. To flip the switch:

1. **Create the products in Stripe** (one per tier). For each: a monthly recurring price.
   - Solo  — $19/mo → copy the price ID (`price_…`)
   - Pro   — $49/mo → copy
   - Agency — $129/mo → copy

2. **Add to `/opt/seowebsitesbuilder/.env`:**
   ```
   STRIPE_SECRET_KEY=sk_live_…   # or sk_test_…
   STRIPE_WEBHOOK_SECRET=whsec_…
   STRIPE_PRICE_SOLO=price_…
   STRIPE_PRICE_PRO=price_…
   STRIPE_PRICE_AGENCY=price_…
   BILLING_RETURN_URL=https://seowebsitesbuilder.com/billing
   ```

3. **Wire them into pm2's env** in `ecosystem.config.cjs` (orchestrator's `env` block), same pattern as `KEY_ENCRYPTION_SECRET`. Then:
   ```bash
   pm2 delete all && pm2 start ecosystem.config.cjs && pm2 save
   ```

4. **Configure the Stripe webhook** in the Stripe dashboard:
   - URL: `https://seowebsitesbuilder.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Reveal the signing secret and put that into `STRIPE_WEBHOOK_SECRET` above.

5. **Test mode first.** Use `sk_test_` keys and Stripe's `4242 4242 4242 4242` card. Verify the full loop:
   - Sign up → land on /dashboard
   - Visit /billing → click "Get Pro" → completes checkout → returns to /billing → plan now shows "pro"
   - Try to create an 11th project → blocked with a 402 message linking to /billing

6. **Switch to live** by replacing `sk_test_` with `sk_live_` and the test webhook secret with the live one. Pm2 restart.

**Plan limits enforced today:** project count is the only quota gated. Custom domains aren't built yet so that limit is informational only.

## Adding more apps on the same box (openclaw / paperclip.ing)

The pattern is one Caddyfile block per public domain. Caddy auto-provisions TLS on first request.

```
# Add to /etc/caddy/Caddyfile then `systemctl reload caddy`

paperclip.ing, www.paperclip.ing {
  reverse_proxy 127.0.0.1:PAPERCLIP_PORT
}
```

Port budget on this box: web=3000, orch=4000, postgres=5432, openclaw=64586. Use 3001/3002/… for additional services. Don't bind new services to `0.0.0.0`; bind to `127.0.0.1` and let Caddy be the only public-facing thing.

For openclaw: it currently listens on `0.0.0.0:64586` and is accessed directly by IP+port. If you want it on a domain, give it a hostname (e.g. `openclaw.seowebsitesbuilder.com`), add a Caddy block proxying to `localhost:64586`, and then `ufw delete allow 64586/tcp` to lock it behind Caddy too.

## Hardening checklist (do these next)

1. **Rotate the root password** that was shared in chat. `passwd root` on the VPS. The deploy SSH key (`~/.ssh/seowebsitesbuilder_vps` on the operator machine) keeps working independently.
2. **Disable password SSH** once you've confirmed key auth works for the people who need access:
   ```
   sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
   sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
   systemctl restart ssh
   ```
3. **Push the local source to the GitHub repo** ([SEO-Agentur/seowebsitebuilder](https://github.com/SEO-Agentur/seowebsitebuilder)). Right now the VPS has an rsync'd copy; redeploys are easier from a git remote. The schema fix in [db/schema.sql](db/schema.sql) and the proxy fix in [apps/orchestrator/src/proxy.ts](apps/orchestrator/src/proxy.ts) are only on the VPS until you push them.
4. **Bind project containers to internal hosts only**. The orchestrator currently maps each user container's port to `0.0.0.0:dynamic`, then proxies to `127.0.0.1` ([apps/orchestrator/src/proxy.ts:46](apps/orchestrator/src/proxy.ts:46)). External access to those ports is firewalled off (we only allow 22/80/443/64586) — good — but a more defensive Docker config would bind containers to `127.0.0.1` too. Edit [apps/orchestrator/src/docker.ts:111](apps/orchestrator/src/docker.ts:111): `HostPort` → `{HostIp: "127.0.0.1", HostPort: ""}`.
5. **Sign preview URLs**. Anyone who knows a project ID can hit `https://seowebsitesbuilder.com/preview/<id>/`. Add a short-lived signed token check in [apps/orchestrator/src/proxy.ts](apps/orchestrator/src/proxy.ts) before opening signups beyond yourself.
6. **Backups**. Postgres volume is `seowebsitesbuilder_pgdata`. Schedule a daily `pg_dump` to off-box storage:
   ```
   docker compose exec -T postgres pg_dump -U seo seobuilder | gzip > /backup/$(date +%F).sql.gz
   ```

## Capacity

- RAM: 7.8 GB total, ~2.8 GB used by openclaw + system, ~700 MB by our stack → ~4.3 GB free → **~8 concurrent user project containers** at the 512 MB cap (`apps/orchestrator/src/docker.ts:113`).
- Disk: 96 GB total, ~13 GB used → plenty for the Postgres volume + user projects. Watch `df -h` once you get real traffic.

## Verifying the deploy is healthy

```bash
curl -fs https://seowebsitesbuilder.com/healthz                # {"ok":true}
curl -fsI https://seowebsitesbuilder.com/ | head -1            # HTTP/2 200
pm2 list                                                       # both online
docker compose -f /opt/seowebsitesbuilder/docker-compose.yml ps  # postgres healthy
```
