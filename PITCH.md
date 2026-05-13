# Seowebsitesbuilder — investor brief

## One-liner

The Webflow for people who actually need to rank. A no-code website builder that produces hand-crafted, framework-native code (Next.js / Astro / PHP / HTML) with perfect Lighthouse scores out of the box, and zero vendor lock-in.

## Problem

The two existing categories both fail SEO-driven users:

- **No-code platforms (Webflow, Wix, Squarespace, Framer)** ship bloated, JS-heavy output with proprietary runtimes. Median Lighthouse Performance: 40–60. You can't take your site with you.
- **AI code generators (Bolt, v0, Loveable)** produce React-heavy SPAs that render via client JS. Great for prototypes, terrible for organic search. Output isn't optimized for Core Web Vitals; semantic HTML is incidental.

Meanwhile, **organic search remains the cheapest CAC channel** for SMBs, content sites, and indie SaaS. Google's algorithm rewards Core Web Vitals more aggressively every year. The market needs a builder optimized for the constraint that actually drives revenue: ranking.

## Solution

A no-code editor where every output is **framework-native, hand-crafted-quality code** that scores 100 on Lighthouse by default. Built on three pillars:

1. **SEO-as-constraint.** Pages can't save without title, meta, single H1, alt text, schema. Real-time score in the editor. Export blocks publishing if score < 90.
2. **Multi-framework export.** Same project compiles to Astro, Next.js, PHP, or plain HTML. User picks based on their team's stack — we don't pick for them.
3. **Generated, not hosted backends.** Pick Supabase/Postgres/Go, get clean generated code you run yourself. We're an editor, not a runtime. No churn risk from us shutting down.

## Why now

- Google's Core Web Vitals weighting increased materially in 2024 and again in 2026; bloated builders are losing rankings their users depend on.
- AI code generation makes the "generate clean idiomatic code" problem tractable. Two years ago this product would have required hand-built templates for every framework × every layout. Now LLM-assisted generation closes the gap.
- Webflow's IPO push has revealed pricing pressure on the legacy no-code stack. SMBs are looking for alternatives.
- Open-source local-first tools (Bolt → ntegrals/december → others) have validated demand for "I want to own my code" but none specialize in SEO.

## Differentiation

| | Webflow | Wix | Bolt/v0 | **Seowebsitesbuilder** |
|---|---|---|---|---|
| Median Lighthouse | 55 | 45 | 70 | **100** |
| Multi-framework export | No | No | React only | **Astro / Next / PHP / HTML** |
| Vendor lock-in | High | Total | Medium | **None** |
| Live SEO audit | No | No | No | **Yes** |
| Backend choice | Proprietary | Proprietary | Convex | **Supabase / Postgres / Go** |
| Self-hostable | No | No | No | **Yes (MIT)** |

## Business model — BYOK + flat $10/mo

The headline pricing is the wedge: **$10/month, unlimited usage, bring your own LLM key.**

We don't take a margin on tokens. Users plug their own Anthropic / OpenAI key into our hosted editor; their LLM bills go directly to the provider. We charge a flat infrastructure fee for the orchestrator, hosted preview containers, persistent storage, the SEO engine, deploy integrations, and updates.

Why this works:

- **Customer math is obvious.** Bolt charges $20–$50/mo *and* meters tokens. Webflow starts at $14/mo and ships worse SEO. We're cheaper *and* there's no token bill anxiety — power users who'd hit token caps elsewhere just pay their LLM provider directly and stay on our $10 plan forever.
- **Our unit economics get better with scale, not worse.** No token cost-of-goods means gross margin floor stays in 80%+ territory regardless of usage intensity. The compute cost per active user (a Docker container running idle most of the time, sweeped after 30min) is well under $1/mo.
- **Honest about the moat.** We're explicitly *not* a margin-on-AI business. The moat is the SEO-optimized output quality, framework-agnostic export, and no-vendor-lock-in promise — sticky things competitors can't undercut by being cheaper.

| Tier | Price | What it gets |
|---|---|---|
| **Self-host** | Free | Full OSS repo. Run on your own box. |
| **Cloud** | **$10/mo** | Hosted editor at Seowebsitesbuilder.com. BYOK (Anthropic or OpenAI). Unlimited projects. Unlimited LLM usage on your key. Persistent containers. Custom domain. One-click deploy. |
| **Team** | $10/seat/mo | Same as Cloud + real-time collab + role-based access + audit logs. |
| **Agency / White-label** | Custom | White-label, bulk client management, priority support. Likely $500+/mo flat. |

The OSS tier is strategic distribution: every self-hoster is a future Cloud upgrade (people stop wanting to run Docker on their laptop within ~3 months) and a word-of-mouth channel. The flat $10 is so cheap relative to Webflow/Wix/Bolt that the conversion friction effectively disappears.

**Sensitivity check.** At $10 ARPU and ~80% gross margin, breakeven on a $1.5M seed at typical SaaS opex burn is ~12–15k paying users. Achievable in 18 months given the OSS funnel and the SEO-keyword-driven domain (Seowebsitesbuilder.com is itself SEO inventory).

## Traction milestones (proposed)

- M1: OSS launch, 1k GitHub stars (HN front page is realistic given the December-style positioning)
- M3: 10k self-host installs, 1k Cloud signups ($10k MRR)
- M6: 5k paying Cloud users, first Agency contracts, $60k MRR
- M12: 12k paying Cloud users + Agency tier, $150k MRR, hire #2/3 (eng + GTM)

## Team & ask

[Founder/team to fill in.] Seeking $1.5M seed for 18 months of runway: 2 engineers, 1 design/PM, GTM budget, infra.

## Why we win

The category is "websites that rank." Webflow optimizes for visual fidelity, Wix for non-technical onboarding, Bolt for prototyping speed. **No one optimizes for the metric the customer actually buys for: organic traffic.** We do, and the technical moat (framework-agnostic page model + Lighthouse-budget enforcement) is hard to replicate without rebuilding from the constraint up.
