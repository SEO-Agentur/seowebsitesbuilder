# Seowebsitesbuilder

> The no-code platform for SEO-perfect websites. Build with Next.js, Astro, PHP, or plain HTML — pick any backend (Supabase, Postgres, Go) — own your code, no vendor lock-in.

Inspired by [ntegrals/december](https://github.com/ntegrals/december) (a local Loveable/Replit/Bolt alternative) but specialized for one job: **shipping websites that rank**. Every output is hand-crafted, semantic, framework-native code. No proprietary runtime. No tracking pixels. No "powered by" links.

## What this is

A self-hostable orchestrator that:

1. **Authenticates** users (JWT + Postgres, Supabase-compatible)
2. **Spawns** an isolated Docker container per project (Next.js, Astro, PHP, or static HTML)
3. **Streams** a live preview into the browser via a reverse proxy
4. **Scores SEO in real time** as you edit — title length, meta, H1 uniqueness, image alts, schema.org, Core Web Vitals budget
5. **Exports** a clean project zip you can deploy anywhere — Vercel, Netlify, Cloudflare Pages, GitHub Pages, your own cPanel

The user always owns the artifact. The platform is an editor, not a runtime.

## Architecture

```
┌─────────────────────┐      ┌──────────────────────┐
│   Next.js frontend  │ ───► │   Orchestrator API   │
│   (Seowebsitesbuilder.com) │  (Node + Express)    │
│   - Auth UI         │      │  - JWT auth          │
│   - Project gallery │      │  - Project CRUD      │
│   - Monaco editor   │      │  - Docker SDK        │
│   - Live preview    │      │  - WS terminal       │
│   - SEO panel       │      │  - Preview proxy     │
└─────────────────────┘      └──────────┬───────────┘
                                        │
                  ┌─────────────────────┼─────────────────────┐
                  ▼                     ▼                     ▼
          ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
          │  Postgres    │      │  Per-project │      │  LLM gateway │
          │  (users,     │      │  Docker      │      │  (BYOK:      │
          │   projects,  │      │  containers  │      │   Anthropic, │
          │   files)     │      │  (next/astro/│      │   OpenAI)    │
          │              │      │   php/html)  │      │              │
          └──────────────┘      └──────────────┘      └──────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the deep-dive.

## Quick start (local dev — recommended)

Run Postgres in Docker, but the orchestrator and web natively. This avoids the docker-in-docker bind-mount issue (see Caveats).

Requirements: Docker, Node 20+, pnpm.

```bash
git clone https://github.com/yourname/seowebsitesbuilder.git
cd seowebsitesbuilder
pnpm install

cp .env.example .env
# Set JWT_SECRET (openssl rand -base64 48), ANTHROPIC_API_KEY or OPENAI_API_KEY

# 1. Postgres only via compose
docker-compose up -d postgres

# 2. Orchestrator (terminal 1)
cd apps/orchestrator
DATABASE_URL=postgres://seo:seo_dev_password@localhost:5432/seobuilder \
  PROJECT_VOLUMES_DIR=$(pwd)/../../.data/projects \
  TEMPLATES_DIR=$(pwd)/../../packages/templates \
  pnpm dev

# 3. Web (terminal 2)
cd apps/web && pnpm dev

# 4. Open
open http://localhost:3000
```

First-run flow: sign up → dashboard → "New project" → pick a template → editor opens with a live preview at `http://localhost:4000/preview/<projectId>` → edit, score, export.

## Caveats (read before deploying)

- **Docker-in-Docker bind mounts.** When the orchestrator runs *inside* a Docker container (the all-in-one `docker-compose up`) and spawns sibling project containers via the host's docker socket, the siblings need *host* paths for `-v` mounts, not the orchestrator's container-view paths. Two production fixes: (a) deploy the orchestrator on a host with native Docker access (a small VM), or (b) use docker-in-docker (`dind`) with a fully isolated daemon. The local-dev quick start above avoids the issue by running the orchestrator natively.
- **Auth in preview proxy.** `/preview/:projectId/*` is currently unauthenticated to allow iframe embedding. Before going live, swap to a short-lived signed-URL pattern.
- **Container resource limits.** `Memory: 512MB`, `CpuQuota: 50%` per project. Tune for your workload.

First-run flow: sign up → dashboard → "New project" → pick a template (HTML / Astro / Next / PHP) → editor opens with a live preview at `http://localhost:4000/preview/<projectId>` → edit, score, export.

## Repo layout

```
seowebsitesbuilder/
├── apps/
│   ├── web/            Next.js frontend (Seowebsitesbuilder.com)
│   └── orchestrator/   Node.js API: auth, projects, Docker, proxy
├── packages/
│   ├── seo-engine/     Pure-TS SEO scoring (used by frontend + API)
│   └── templates/      Starter projects (html, astro, nextjs, php)
├── db/
│   └── schema.sql      Postgres schema (users, projects, files)
├── docker-compose.yml  Postgres + orchestrator + frontend
├── ARCHITECTURE.md     Tech deep-dive
├── PITCH.md            Investor brief
└── README.md
```

## What's built vs what's stubbed

This repo is a **working scaffold**, not a finished product. Here's the honest state:

| Surface | State |
| --- | --- |
| Auth (signup/login, JWT, Postgres) | Built |
| Postgres schema + migrations | Built |
| Orchestrator REST API (projects, files) | Built |
| Docker SDK integration (spawn/stop containers) | Built |
| Preview reverse proxy | Built |
| SEO scoring engine | Built |
| Frontend landing page | Built |
| Frontend dashboard | Built |
| Frontend Monaco editor + live preview | Built (basic) |
| 4 starter templates (HTML, Astro, Next, PHP) | Built (minimal) |
| LLM-assisted page generation | Stubbed (interface ready, BYOK wired) |
| Multi-framework export to zip | Built |
| One-click deploy (Vercel/Netlify/cPanel) | Stubbed (CLI snippets only) |
| Domain management, billing, team accounts | Not started |

## License

MIT. Take it, fork it, run it. That's the point.
