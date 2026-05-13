# CLAUDE.md — context for Claude Code

This file is the handoff brief. Read it first.

## Project at a glance

**Seowebsitesbuilder** — a self-hostable no-code platform for SEO-perfect websites. Hosted version lives at Seowebsitesbuilder.com. Inspired by ntegrals/december (local Replit/Bolt alternative) but specialized: every output is hand-crafted-quality, framework-native code (Next.js / Astro / PHP / plain HTML) with perfect Lighthouse scores. No vendor lock-in.

**Pricing model (locked):** BYOK + flat $10/mo for unlimited usage. Users plug their own Anthropic/OpenAI key into our hosted editor; LLM bills go directly to provider. We charge flat infra fee. No token markup.

## Read these first, in order

1. `README.md` — what it is, how to run locally, repo layout, what's built vs stubbed
2. `ARCHITECTURE.md` — services, data model, container lifecycle, SEO rubric, no-lock-in commitments
3. `PITCH.md` — investor brief, BYOK $10/mo math, traction milestones

## Repo layout

```
seowebsitesbuilder/
├── apps/
│   ├── web/               Next.js 14 frontend (landing, auth, dashboard, editor)
│   └── orchestrator/      Node + Express + ws: auth, projects, Docker, preview proxy, LLM gateway
├── packages/
│   ├── seo-engine/        Pure-TS scoring (12 weighted checks)
│   ├── generators/        Backend code generators (supabase, postgres, go) — IN PROGRESS
│   └── templates/         Starter projects (html, astro, nextjs, php) — minimal but score 100/100
├── db/schema.sql          Postgres: users, projects, files, deploys
├── docker-compose.yml     Postgres + orchestrator + web
├── package.json           pnpm workspaces root
└── ...
```

## What is fully built and verified

- **Auth**: signup/login/me, bcrypt + JWT, Postgres-backed (`apps/orchestrator/src/auth.ts`)
- **Project CRUD**: list/create/get/start/stop/delete (`apps/orchestrator/src/projects.ts`)
- **File API**: list/read/write/delete + path-traversal protection (`apps/orchestrator/src/files.ts`)
- **Docker SDK integration**: per-project sibling containers, framework-specific commands (`apps/orchestrator/src/docker.ts`)
- **Preview reverse proxy**: `/preview/:id/*` → container's host port (`apps/orchestrator/src/proxy.ts`)
- **WebSocket terminal**: orchestrator side wired (`apps/orchestrator/src/index.ts` upgrade handler)
- **LLM gateway**: SSE streaming for Anthropic + OpenAI BYOK (`apps/orchestrator/src/llm.ts`)
- **Real .zip export** via archiver streamed from `/projects/:id/export`
- **SEO scoring engine**: 12 weighted checks, runs in browser + Node, verified — html/astro/php templates all score 100/100, broken page scores 15/100
- **Frontend**: landing, signup, login, dashboard (with project gallery + create flow), editor (Monaco + iframe preview + SEO panel)
- **4 starter templates** that score 100/100 out of the box

## Recently built (May 2026)

- **Backend generators package**: `postgres.ts` and `go.ts` are now implemented. `generateBackend(cfg)` dispatches on `cfg.backend`. Project creation in `apps/orchestrator/src/projects.ts` calls `scaffoldProjectDir` + `generateBackend` synchronously so the file tree is populated before the editor opens.
- **AI chat panel** (`apps/web/components/chat-panel.tsx`): consumes `/llm/chat` SSE, parses fenced ` ```lang path="..." ` blocks out of the assistant reply, and shows an "Apply all" button that calls `api.writeFile` for each.
- **xterm.js terminal** (`apps/web/components/terminal.tsx`): wraps the orchestrator's `/ws/terminal/:id` WS. Lazy-loads xterm + fit addon to keep the editor's initial bundle small. Hidden by default; toggled from the header.
- **Editor layout** rewritten: header → file tree → Monaco (with collapsible terminal drawer) → live preview → tabbed right pane (SEO | AI chat).
- **Deploy adapters**: vercel, netlify, cloudflare, github, cpanel — all under `apps/orchestrator/src/deploys/` with one dispatcher routed at `POST /projects/:id/deploy`. Frontend `apps/web/components/deploy-modal.tsx` provides target selection + credentials form + recent-deploy history.
- **Landing page** rewritten for 100/100 SEO: title 49 chars, description 148 chars, JSON-LD (Organization + SoftwareApplication + FAQPage), 6 OG tags, viewport via Next 14 `viewport` export. Verified offline against the engine's regex parser.

## Still stubbed (not yet built)

- **Stripe billing**: absent. Add `apps/orchestrator/src/billing.ts` (checkout session + webhook), `apps/web/app/billing/page.tsx`, subscription gate middleware.
- **Custom domain management**: sidebar item exists but no implementation. Add domain table to schema, DNS verification flow, orchestrator routes.
- **Tests**: zero exist. Start with `packages/seo-engine/src/index.test.ts` using vitest — the engine is the most testable surface.
- **Lint/format/CI**: no eslint, prettier, or GitHub Actions configs yet.

## Conventions to follow

- **TypeScript strict** everywhere. `noImplicitAny`, `strictNullChecks`.
- **Zod for input validation** at every API boundary. See `auth.ts` and `projects.ts` for the pattern.
- **No comments unless they explain *why***. The code is read more than it's written; favor obvious naming over commentary.
- **Error responses** are `{ error: string, detail?: any }` JSON — match this everywhere.
- **Tailwind utility classes** in the frontend. Custom colors live in `tailwind.config.ts` (`ink`, `accent`, `muted`).
- **Server components by default** in Next 14 App Router. Client components (`"use client"`) only where state/effects are needed.
- **Docker socket** path is `/var/run/docker.sock` — already mounted in `docker-compose.yml`.

## Known caveats (read before deploying)

- **Docker-in-Docker bind mounts**: when the orchestrator runs *inside* Docker, sibling containers spawned via the host socket need *host* paths, not container-view paths. Local dev sidesteps by running the orchestrator natively. See README "Caveats" section for the production fix.
- **Preview proxy is unauthenticated** to allow iframe embedding. Replace with short-lived signed-URL pattern before production.
- **`@seo/seo-engine`** package's `main` field points to `src/index.ts`. Next.js handles this via `transpilePackages: ["@seo/seo-engine"]`. The orchestrator does not currently consume it — when wiring export-time validation, either pre-build the package or import it relatively.
- **`@seo/generators` is consumed by the orchestrator** but the orchestrator's tsc has `rootDir: src`. To keep typecheck happy without forcing a build step, there's a thin module shim at `apps/orchestrator/src/types/generators.d.ts` that re-declares the public surface. Runtime resolution goes through pnpm's workspace symlink (tsx in dev). When you change the generator's exported types, update the shim too.
- **`ssh2-sftp-client`** is an `optionalDependencies` of the orchestrator. The cPanel deploy adapter imports it lazily and fails fast with a clear error if it's missing; the rest of the orchestrator boots without it.

## Verification commands

```bash
# Engine works against templates? (already passes)
node /tmp/seo-test.mjs   # see chat history for the test script

# DB schema valid?
docker-compose up -d postgres
docker-compose exec postgres psql -U seo -d seobuilder -c "\dt"

# Orchestrator typechecks?
cd apps/orchestrator && pnpm typecheck

# Web typechecks?
cd apps/web && pnpm typecheck

# Boot end-to-end (requires Docker, Node, pnpm):
pnpm install
docker-compose up -d postgres
(cd apps/orchestrator && DATABASE_URL=postgres://seo:seo_dev_password@localhost:5432/seobuilder PROJECT_VOLUMES_DIR=$(pwd)/../../.data/projects TEMPLATES_DIR=$(pwd)/../../packages/templates pnpm dev) &
(cd apps/web && pnpm dev) &
open http://localhost:3000
```

## Suggested order of work (next)

1. Add Stripe billing (`apps/orchestrator/src/billing.ts` + checkout + webhook + subscription gate middleware).
2. Add `packages/seo-engine/src/index.test.ts` with vitest. Next: integration tests for the deploy adapters with mock fetch.
3. Add custom domain management.
4. Add eslint + prettier + a GitHub Actions CI workflow.
5. Build the schema/model editor UI so generators see real `models` (currently called with `models: []`).

## Domain decision

Use **Seowebsitesbuilder.com** (not the .net or hyphenated variants). Reasoning in chat history: .com trust signal, plural reads naturally, no hyphens, single-keyword brand value.
