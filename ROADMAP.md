# Roadmap: optimization, monetization, hosting the built sites

Three sections. Read them in order — each enables the next.

---

## Part 1 — What to optimize

### Tier 1 — blockers to paid signups

These are the things a first-time user will hit and bounce off. Fix before any marketing push.

1. **Onboarding has a dead-end.** Signup → empty dashboard. Should be: signup → pick one of 6 starter templates → land in the editor with code already loaded, container started, score ≥ 95. The dashboard's empty-state already gestures at this; make the templates real (see point 4) and auto-create on first signup.
2. **Schema/model editor UI doesn't exist.** Backend generators ([packages/generators](packages/generators)) are called with `models: []` ([projects.ts:96](apps/orchestrator/src/projects.ts:96)). Users picking the Postgres/Go/Supabase backend get an empty migration. Build a simple "Data" tab in the editor: add model → add fields → re-run generator → diff into project. This is a half-day build that unlocks the whole backend story.
3. **No auto-stop on idle containers.** A user clicks Start, leaves the tab, and we keep paying for a 512 MB container forever. On a 7.8 GB VPS that's at most ~8 concurrent before we OOM. Add a `last_request_at` column on `projects`, update it whenever the preview proxy or terminal touches a project, and run a cron every 5 min that stops anything idle ≥15 min. Three-file change, maybe 60 lines.
4. **Template gallery is 4 starters with no preview thumbnails.** Build a `/templates` page that shows screenshots + live demo links + categories (SaaS / agency / blog / e-comm / portfolio / local-business). Each template is just another project tree under `packages/templates/`. Niche SEO templates (lawyer, dentist, plumber, restaurant, real-estate, fitness) are pure conversion bait — and they're also the templates you'll later sell in a marketplace (Part 2).
5. **Preview proxy is unauthenticated.** Anyone who knows a project UUID can hit `/preview/<id>/` ([proxy.ts](apps/orchestrator/src/proxy.ts)). For private projects you must add either: (a) JWT check on the route, with a short-lived signed query token for iframe embedding, or (b) make every preview live on `*.preview.seowebsitesbuilder.com` with HTTPS-only cookies. Option (a) is faster; do it before public signup.
6. **Cold starts are 15–30 seconds** on Astro/Next because the container does `pnpm install` on every start. Pre-build template Docker images that bake in `node_modules` — `seo/template-nextjs:latest`, `seo/template-astro:latest`. Start time drops to <2 s. The orchestrator already chooses the image per framework ([docker.ts:28](apps/orchestrator/src/docker.ts:28)) — just point each framework at the prebuilt image.

### Tier 2 — quality of the editor

7. **Chat panel only does full-file replacements.** Add a "patch mode" where the model emits unified diffs and the apply button uses [jsdiff](https://github.com/kpdecker/jsdiff) to apply them. Big files become editable without context bloat.
8. **No undo across save boundaries.** Monaco's local undo dies on file switch. Snapshot every saved version into the `files` table (it already has the column) and add a "history" sidebar with restore.
9. **SEO engine only scores static HTML.** For Next/Astro projects it scores the dev-server HTML, which can differ from the prod build. Add an "Audit production build" button that triggers `pnpm build` inside the container and scores `out/index.html` instead.
10. **No image optimization in the export.** Generated sites often have unoptimized images. Add an export-time pass that converts PNG/JPG → WebP/AVIF using `sharp`, generates `srcset`, and rewrites references. This is also a marketable feature ("Lighthouse 100 even with your real photos").
11. **The terminal drops history on reload.** Pipe each container's stdout/stderr to a ring buffer in Postgres (last 500 lines per project) so reconnects replay.

### Tier 3 — operational defenses

12. **No error tracking.** Wire up Sentry (free tier handles ~5k errors/month). The orchestrator has clean error paths; one line of init code.
13. **No metrics.** Add `prom-client` to the orchestrator, expose `/metrics`, scrape with a tiny Prometheus + Grafana container. You need this to know container density before adding paying users.
14. **No automated DB backups.** Cron `pg_dump | gzip > /backup/$(date).sql.gz` daily, with a 7-day retention. Bonus: push to Backblaze B2 ($6/TB/month).
15. **Compile generators to JS.** Currently the orchestrator imports `@seo/generators` via `tsx` runtime resolution. Add a build step so production can run plain `node dist/index.js`, half the memory, faster boot.
16. **No CI.** GitHub Actions workflow: `typecheck` + `next build` + run the SEO engine against templates + a 1-shot end-to-end test (signup, create project, check files exist). Catches regressions on every push.

---

## Part 2 — How to monetize better

Pricing has been moved to a paid-only model (no free self-host tier). The BYOK promise — bring your own Anthropic/OpenAI key, no token markup, unlimited LLM usage on your subscription — stays as the core trust signal. Here's a five-step revenue plan that compounds from there.

### Step 1 — Replace flat $10/mo with three tiers

| Tier | $/mo | Projects | Custom domains | Seats | Pitch |
|---|---|---|---|---|---|
| **Solo** | $19 | 3 | 3 | 1 | Build a site that ranks |
| **Pro** | $49 | 10 | 10 | 3 (rigid) | Run a side income from rankable sites |
| **Agency** | $129 | unlimited | unlimited | 8 + $10/extra seat | Build & manage SEO sites for clients |

Same BYOK-LLM promise across all tiers — you've already taken the moral high ground there, keep it. Pro/Agency tiers earn through the count limits and the things below.

**Pricing logic worth keeping in mind:**
- **We charge for custom domains, not project count.** A Docker container is a Docker container — limiting projects is theatre. Custom domains are the real cost driver (cert issuance, DNS lookups, support burden) so that's what the tiers gate. 10 *real* sites at Pro ≫ 25 *throwaway* sites.
- **Pro seats are rigid; Agency seats expand.** Pro = 3 seats, jump to Agency for more. That gives "needs 4+ seats" a clean upgrade signal. Agency includes 8 then $10/extra — a 15-seat agency pays $199/mo, a 30-seat champion pays $349/mo. **2.7× the LTV** vs. a flat $129 cap.
- **$19 and not $10 for Solo:** at $10 there's zero margin once you add hosting bandwidth + storage costs (Step 2). $19 anchors the product as "real software" rather than "indie hobby tier," leaves you ~$7 of infra headroom per user, and gives promo runway you can't get from $10 ("$10 first month," "annual at $190/yr"). Comparable benchmarks: Carrd Pro $19, Framer Mini $15, Webflow CMS $23 — you're already cheaper because of BYOK.

**Why this works:** anyone who would have paid $10 still does (no one bounces at $19 if they were willing at $10). The 5% who want to run an SEO portfolio (Pro) and the 1% running an agency (Agency) suddenly have somewhere to land. Same support load.

### Step 2 — Charge for hosting the sites users build

This is the single biggest lever and **Part 3** explains the architecture. Once you can host `<slug>.seosites.app` (and later `<slug>.com` custom domains) from the same VPS:

| Tier | $/mo | What it gets |
|---|---|---|
| **Free hosting** | 0 | `*.seosites.app` subdomain, behind shared CDN, 10 GB/mo bandwidth |
| **Pro hosting** | $5 / site | Custom domain, 100 GB/mo, edge cache, analytics |
| **Business** | $19 / site | + dedicated IP, basic auth gate, A/B testing hooks |

If you have 200 active builders and 30% of them publish on a custom domain at $5–19, that's **another $300–1140/mo on top of the editor subscription**. Same VPS until traffic gets serious.

### Step 3 — Sell ad-hoc SEO audits (no signup required)

The scoring engine ([packages/seo-engine](packages/seo-engine)) takes any URL and returns a 0–100 score with detailed checks. Wrap it in a public endpoint at `/audit?url=...`, monetize:

- **Free:** the 12-check score (already runs in the editor)
- **$19 one-shot:** add Lighthouse run, Core Web Vitals, mobile-friendly audit, schema validation report (HTML + PDF)
- **$49/mo:** monitor up to 20 URLs, weekly re-audit, email diff alerts

This is **SEO-influencer fuel**. Affiliate marketers will link to free audits all day. The free audit is a top-of-funnel ad for the builder.

### Step 4 — Template marketplace

You already have 4 starter templates. Each niche template can sell for $19–149:

- "Local plumber SEO template" — $29
- "SaaS pricing-page bundle (5 layouts)" — $49
- "Multilingual blog with hreflang done right" — $79
- "Dentist clinic with appointment booking + LocalBusiness schema" — $99

Pay creators 70%. You earn the 30% cut plus the subscription pull (you must be Pro+ to use marketplace templates).

Start by creating 10 templates yourself, list them at $19–49 to seed the gallery, open up to community creators 3 months later.

### Step 5 — Channel: agencies and affiliates

- **Affiliate program**: Rewardful or FirstPromoter, 30% recurring for 12 months. SEO YouTubers and bloggers convert at 5–10x normal rates because the product matches their content.
- **Agency partner deal**: $129/seat Agency tier, but discounted to $99 if they commit to 5+ seats. They love it because white-label means their clients see the agency's brand, not yours.
- **Lifetime deal on AppSumo / PitchGround**: $79 one-time for Solo-lifetime, capped at 1000 buyers. Brings in ~$60k cash and ~10k reviews/social proof in one month. Don't lifetime your top tier; only the entry one.

### What NOT to do

- **Don't add token markup.** Every BYOK SaaS that abandoned that principle got eaten by the next one that didn't. Your honesty here is a moat.
- **Don't sell "AI credits."** Same reason. People hate credit systems.
- **Don't free-tier the editor forever.** A 14-day trial of Pro converts much better than a forever-free Solo. People treat free as worthless.

---

## Part 3 — Hosting the sites users build

Right now users export to Vercel/Netlify/Cloudflare/etc. The bigger play is **also** offering "publish to `<slug>.seosites.app` in one click." Here's the architecture, smallest-viable-version first.

### Step A — Reserve a hosting domain

Buy a short separate domain for the user sites. **Do not host user sites under `seowebsitesbuilder.com`** — keeps your marketing-domain SEO clean and avoids cookie scope confusion. Options:

- `seosites.app` (recommend — `.app` is HSTS-forced HTTPS, free TLS-by-default vibe)
- `seo.sh`, `ranks.app`, `getseo.site`

Set DNS:

```
seosites.app           A      187.77.74.66
*.seosites.app         A      187.77.74.66
```

Wildcard means every subdomain hits your VPS without manual DNS work per user.

### Step B — Publish workflow in the orchestrator

Add a new "publish" action distinct from "deploy" (which still ships to external providers).

1. **Schema:** add `publishes` table.
   ```sql
   CREATE TABLE publishes (
     id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     slug          TEXT UNIQUE NOT NULL,           -- 'my-cool-site' → my-cool-site.seosites.app
     custom_domain TEXT UNIQUE,                    -- optional, paid tier
     status        TEXT NOT NULL DEFAULT 'pending',
     last_built_at TIMESTAMPTZ,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```

2. **Build inside the project container**, copy output to a publish dir on the host:
   - `html` / `php` → copy project files verbatim to `/var/seosites/<slug>/`
   - `astro` → `pnpm build` inside container → copy `dist/` to `/var/seosites/<slug>/`
   - `nextjs` → if static export: `pnpm build && pnpm next export` → copy `out/` to `/var/seosites/<slug>/`. If SSR-needed, fall through to runtime (Step E).

3. **Audit gate**: re-run the SEO engine on the built output. Refuse publish if score < 90 (we eat our own dog food).

4. **POST /projects/:id/publish** route: body `{slug, customDomain?}`. Validates slug uniqueness, kicks off build, returns status.

### Step C — Serve sites from the same VPS

For static sites, Caddy alone handles this. Add a second site block in `/etc/caddy/Caddyfile`:

```
*.seosites.app {
  @hassite {
    not path /healthz
    file {
      root /var/seosites/{labels.2}    # {labels.2} = the subdomain
      try_files /index.html =404
    }
  }
  root * /var/seosites/{labels.2}
  encode zstd gzip
  file_server
  header {
    Cache-Control "public, max-age=300, s-maxage=86400"
    X-Robots-Tag "all"
  }

  # Auto-TLS for the wildcard. Needs DNS-01 challenge — see Step D.
  tls {
    dns cloudflare {env.CLOUDFLARE_API_TOKEN}
  }
}
```

Reload Caddy, done. Visiting `my-cool-site.seosites.app` reads from `/var/seosites/my-cool-site/index.html`.

### Step D — TLS for the wildcard

HTTP-01 challenges can't validate a wildcard — Let's Encrypt requires DNS-01. Two ways:

**(i) Cloudflare DNS API** — easiest. Move `seosites.app`'s DNS to Cloudflare (free), create an API token scoped to `Zone:DNS:Edit` for that zone only, install Caddy's Cloudflare DNS plugin:

```bash
# On the VPS — Caddy needs to be rebuilt with the plugin
caddy add-package github.com/caddy-dns/cloudflare
echo 'CLOUDFLARE_API_TOKEN=cf_xxx' >> /etc/caddy/Caddyfile.env
systemctl restart caddy
```

Then the `tls { dns cloudflare ... }` block above just works. Wildcard cert auto-issued and auto-renewed.

**(ii) On-demand TLS instead of wildcard** — Caddy will provision a per-subdomain cert on first request, with no wildcard needed:

```
*.seosites.app {
  tls {
    on_demand
  }
  ...
}
on_demand_tls {
  ask https://seowebsitesbuilder.com/internal/can-publish
}
```

Add a `/internal/can-publish?domain=foo.seosites.app` route to the orchestrator that returns 200 if a `publishes` row exists for that subdomain, 404 otherwise. Caddy uses this to prevent random bots from triggering cert issuance for nonexistent subdomains.

**Recommend (ii)** — no Cloudflare DNS dependency, no manual API token, and it works equally well for custom domains (Step F).

### Step E — Dynamic / SSR sites (Next, Go, PHP)

Static export covers most marketing/SEO sites — that's the 80%. For the 20% that need server-rendered or dynamic logic:

- **Don't run them in the publish container.** Run a "production" container per published-dynamic-site, behind Caddy. Resource cost is real (RAM per site), so charge for it: this is the Business tier in Part 2.
- **PHP** is the simplest: a single `php:8.3-fpm` container per site, Caddy talks FastCGI.
- **Next SSR**: same image we already use for the editor preview, but persistent. Easy.

Architecturally, this is just "the editor's per-project container but it never stops and is fronted by Caddy on a public domain." Code-wise it's mostly route plumbing.

### Step F — Custom domains (the upsell)

For paid users, let them point `myrealdomain.com` at us:

1. UI in the editor: "Custom domain" field on a published project. They enter `myrealdomain.com`.
2. We tell them to add either:
   - `A myrealdomain.com → 187.77.74.66` and `A www.myrealdomain.com → 187.77.74.66`, or
   - `CNAME myrealdomain.com → cname.seosites.app` (you'll set up `cname.seosites.app` to point to the VPS IP)
3. On their next visit to the editor, we run `dig myrealdomain.com` and confirm it resolves to us. Mark `custom_domain` valid.
4. Caddy is already on-demand-TLS configured (Step D). First request to `myrealdomain.com` provisions a cert via HTTP-01 (works because we own ports 80/443). Caddy's `ask` endpoint validates via the orchestrator.

That's it. No DNS-mucking, no extra moving parts beyond the `ask` endpoint already needed for `*.seosites.app`.

### Step G — Add a CDN once you get real traffic

For a single VPS, Caddy alone handles a few thousand RPS of static content. Past that, **Cloudflare in front is the cheapest 100x scale-up you can buy**:

1. Move `seosites.app` DNS to Cloudflare.
2. Orange-cloud the wildcard A record (CF proxy on).
3. SSL/TLS mode: **Full (strict)**. Generate a Cloudflare Origin Certificate (free, 15-year), install it on Caddy, set Caddy to serve the origin cert. Done.
4. Cache rules: everything except `/api*` and `/internal*` is cacheable; HTML default-TTL 5 min, assets 30 days.

This gives free DDoS protection, global edge caching, image optimization (Polish/Mirage), and bot protection — all on Cloudflare's free tier until you do real volume.

For **custom domains** (Step F), you can't proxy through Cloudflare unless each user moves their DNS there. Alternative: BunnyCDN with pull origin + custom-domain support — $1/100 GB and they handle the CNAME-to-CDN dance. Worth the $0.01/GB for paid-tier customers.

### What this unlocks

You go from "another website builder that exports zip files" to **"a hosting platform you can stay inside forever"**. That's the difference between:

- Wix-like recurring revenue (good)
- Wix-like recurring revenue + "I hosted 6 ranking sites on it for 2 years" testimonials (great)
- Plus, every published site is a backlink-ready demo of what the platform produces — SEO compounds for *you* as your users rank.

---

## Order of operations

If I were building this out, the rough Q-by-Q would be:

**Q1** — Tier 1 polish (1-6), the three-tier pricing change, ad-hoc audit endpoint, GitHub repo + CI. Goal: enable confident first paid signups.

**Q2** — Hosting on `*.seosites.app` (Part 3 A-D). Custom domain (F). Bump pricing: hosting becomes a Pro/Business feature. Template marketplace seed (10 self-made templates).

**Q3** — Tier 2 editor improvements (7-11). Open the marketplace to creators. Launch affiliate program. AppSumo deal for the Solo tier.

**Q4** — Operational (12-16). Agency tier white-label launch. Dynamic-site hosting (Part 3 E). First $10k MRR target.

Each quarter compounds. The hosting unlock (Q2) is the single biggest revenue lever — prioritize getting there.
