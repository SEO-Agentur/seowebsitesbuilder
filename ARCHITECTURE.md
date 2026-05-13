# Architecture

## Design principles

1. **The user owns the output.** Everything generated is plain framework-native code that reads like a senior dev wrote it. No runtime dependency on our platform after export.
2. **SEO is enforced at the model level, not as a feature.** Pages can't be saved without a title, meta description, single H1, and image alts. We ship Lighthouse-budget defaults: zero client JS unless explicitly requested, critical CSS inlined, fonts subset.
3. **Frameworks are output adapters, not coupling.** The same project model compiles to Astro, Next.js, PHP, or plain HTML. Switching frameworks is a re-export, not a rewrite.
4. **Backend is generated code, not a hosted service.** Pick Supabase → we generate `.env` + a typed client + RLS-friendly queries. Pick Postgres+Go → we scaffold a Go API server. We never run the backend for you.

## Services

### `apps/web` — Next.js 14 (App Router)

Public marketing pages (landing, pricing, docs) served at the root. Authenticated app at `/dashboard`, `/editor/[projectId]`. Uses Server Components for the marketing pages (perfect Lighthouse on our own site, eat the dog food). Client components for the editor where interactivity is needed.

Key routes:

- `/` — landing
- `/login`, `/signup` — auth
- `/dashboard` — project gallery, template picker
- `/editor/[projectId]` — Monaco + preview iframe + SEO panel
- `/api/auth/*` — proxied to orchestrator
- `/api/projects/*` — proxied to orchestrator

### `apps/orchestrator` — Node.js + Express + ws

The brain. Owns:

- **Auth** (`POST /auth/signup`, `POST /auth/login`) — bcrypt + JWT
- **Projects** (`GET/POST/DELETE /projects`) — CRUD against Postgres
- **Files** (`GET/PUT /projects/:id/files`) — read/write into a per-project Docker volume
- **Container lifecycle** (`POST /projects/:id/start|stop`) — Docker SDK via dockerode
- **Preview proxy** (`GET /preview/:id/*`) — http-proxy to the per-project container's exposed port
- **WebSocket terminal** (`WS /ws/terminal/:id`) — pipes a shell inside the project container to xterm.js
- **LLM** (`POST /llm/chat`) — BYOK proxy to Anthropic/OpenAI (never logs prompts server-side)

### `packages/seo-engine`

Pure TypeScript, zero deps. Exports a `score(html: string, opts) → SeoReport` function used by both the frontend (live scoring as user edits) and the orchestrator (CI-style export validation). See `packages/seo-engine/src/index.ts` for the rubric.

### `packages/templates`

Starter projects we copy into a new container's volume on project creation. Minimal but production-shaped:

- `html/` — single `index.html` with semantic structure, served by `serve` on port 3000
- `astro/` — Astro 4 with content collections + sitemap + RSS
- `nextjs/` — Next 14 App Router with `generateMetadata` wired to project SEO model
- `php/` — vanilla PHP with PDO, served by `php -S 0.0.0.0:3000`

## Data model (`db/schema.sql`)

```sql
users (id, email, password_hash, created_at)
projects (id, owner_id, name, slug, framework, backend, container_id, status, created_at, updated_at)
files (id, project_id, path, content, updated_at)  -- mirror; container volume is source of truth
deploys (id, project_id, target, url, status, created_at)
```

Files are mirrored to Postgres on save so we can rehydrate a container if it dies. The container volume is the working source; Postgres is the durable backup.

## Container lifecycle

1. User clicks "New project (Astro)" in dashboard.
2. Orchestrator creates Postgres row, copies `packages/templates/astro/` into a new named Docker volume.
3. Orchestrator starts a container from `node:20-alpine`, mounts the volume at `/app`, runs `pnpm install && pnpm dev --host 0.0.0.0 --port 3000`.
4. Orchestrator stores the container ID and the dynamically allocated host port.
5. Frontend renders preview iframe pointed at `http://orchestrator/preview/<projectId>/`.
6. Reverse proxy in orchestrator forwards to the container.

PHP is similar but uses `php:8.3-cli` and `php -S 0.0.0.0:3000 -t .`. Static HTML uses `node:20-alpine` + `npx serve -l 3000`.

Idle containers auto-stop after 30 min via a sweeper job. Restart on next file write.

## SEO scoring rubric

`packages/seo-engine` parses the rendered HTML and returns:

```ts
{
  score: 0..100,
  passed: SeoCheck[],
  failed: SeoCheck[],
  warnings: SeoCheck[],
}
```

Checks (weights in parens):

- Title present and 30–60 chars (15)
- Meta description 120–160 chars (15)
- Exactly one `<h1>` (10)
- All `<img>` have non-empty `alt` (10)
- Has `<html lang="...">` (5)
- Has canonical link (5)
- Has Open Graph tags (5)
- Has schema.org JSON-LD (10)
- Has viewport meta (5)
- No more than one render-blocking script (10)
- Total page weight < 100KB gzipped (10)

The frontend runs this on the iframe's serialized DOM every 500ms (debounced). The orchestrator runs the same code on export so a "100 score" guarantee actually holds at deploy time.

## No-vendor-lock-in guarantee

Three concrete commitments:

1. **Export produces idiomatic code.** No platform-specific imports, no runtime hooks, no obfuscation. A `next build && next export` of the exported project produces deployable static output.
2. **Backend code is generated, not called.** When user picks Supabase, we write a `lib/supabase.ts` and migrations. They run those against their own Supabase project. We never proxy.
3. **Open data formats.** The project model is JSON. The full project ZIP includes the JSON model so the user can re-import into a future version (or a competing tool that supports the format).

## Roadmap to production

- Multi-tenant deploy of orchestrator (Kubernetes, one orchestrator per region)
- Container snapshotting for cold-start <500ms
- Real-time collaboration (CRDT on the project model)
- Custom domain management with auto-issued SSL
- Stripe billing
- LLM-assisted "describe a page, get blocks" mode (the December-style chat-to-build flow)
- A11y scoring alongside SEO
- One-click deploy integrations (Vercel/Netlify/Cloudflare Pages REST APIs)
