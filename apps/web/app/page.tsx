import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroPrompt } from "@/components/hero-prompt";

const FRAMEWORKS = [
  { id: "html", name: "HTML", note: "Plain semantic HTML, zero JS." },
  { id: "astro", name: "Astro", note: "Static-first, content-collection ready." },
  { id: "nextjs", name: "Next.js", note: "Static export, App Router, full metadata." },
  { id: "php", name: "PHP", note: "Runs on any shared host." },
];

const FEATURES = [
  {
    title: "Real-time SEO scoring",
    body: "Every keystroke is graded against title length, meta, single-H1, alt text, schema.org, and Core Web Vitals budget. Won't let you publish under 90.",
  },
  {
    title: "Multi-framework export",
    body: "One project model compiles to Next.js, Astro, PHP, or plain HTML. Switch framework with one click — code stays clean and idiomatic.",
  },
  {
    title: "No vendor lock-in",
    body: "Export produces hand-crafted-quality code with zero proprietary runtime. Backends (Supabase, Postgres, Go) are generated, not hosted by us.",
  },
  {
    title: "Live container per project",
    body: "Each project runs in an isolated Docker container with a real dev server. Edit, see changes instantly. Same setup that ships in production.",
  },
  {
    title: "BYOK LLM, honest pricing",
    body: "Bring your own Anthropic or OpenAI key. From $19/mo for unlimited usage — you pay your provider directly. No token markup, ever.",
  },
  {
    title: "One-click deploy",
    body: "Vercel, Netlify, Cloudflare Pages, GitHub Pages, or SFTP to cPanel. Pick one — keys are forwarded once, never stored.",
  },
];

const STEPS = [
  { n: "1", title: "Pick a framework", body: "HTML, Astro, Next.js, or PHP. Each starter scores 100/100 out of the box." },
  { n: "2", title: "Edit visually", body: "Monaco editor, live preview iframe, AI chat panel — and an SEO score that updates on every keystroke." },
  { n: "3", title: "Ship", body: "Export a zip, push to GitHub Pages, or one-click deploy to Vercel/Netlify/Cloudflare. Code is yours forever." },
];

const FAQ = [
  {
    q: "How is this different from Wix or Webflow?",
    a: "Their output is bloated proprietary HTML behind a runtime you can't leave. Ours is hand-crafted-quality code in your chosen framework — Lighthouse 100 by default, and you can export the entire site at any time.",
  },
  {
    q: "How does the BYOK pricing actually work?",
    a: "You drop your own Anthropic or OpenAI key into the editor. The orchestrator forwards your prompts to that provider — your token spend is whatever your provider charges. Our plans (from $19/mo) cover the editor and the per-project containers, with unlimited LLM usage on your key.",
  },
  {
    q: "What if I need a backend?",
    a: "Pick Supabase, Postgres, or a Go API at project creation. We generate idiomatic, edit-freely scaffolding — schema, client, types, repositories — and the connection details point at your account, not ours.",
  },
  {
    q: "Is this December for SEO?",
    a: "December inspired the local-Docker-per-project pattern. We took that and added a real-time SEO scoring engine, framework choice, backend codegen, and one-click deploys — all built around producing sites that rank.",
  },
];

const COMPARE = [
  { name: "Wix", score: 45 },
  { name: "Webflow", score: 55 },
  { name: "Bolt / v0", score: 70 },
  { name: "Seowebsitesbuilder", score: 100, ours: true },
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function LandingPage() {
  return (
    <>
      {/* FAQ JSON-LD lives on this page only — sitewide schema is in layout.tsx. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <p className="text-accent text-sm font-medium mb-4 tracking-wide">FROM $19/MO · BYOK · LIGHTHOUSE 100</p>
              <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] mb-6">
                Build websites that <span className="text-accent">actually rank</span>.
              </h1>
              <p className="text-xl text-muted leading-relaxed mb-8 max-w-2xl">
                The no-code platform for SEO-perfect sites. Visual editor with real-time
                scoring. Export to Next.js, Astro, PHP, or plain HTML. Plug in
                Supabase, Postgres, or Go for a backend. Own your code.
              </p>
              <HeroPrompt />
              <div className="mt-4 flex gap-3 flex-wrap text-sm">
                <Link href="/signup" className="text-muted hover:text-ink">Sign in →</Link>
                <span className="text-black/20">·</span>
                <Link href="/audit" className="text-muted hover:text-ink">Audit an existing URL</Link>
              </div>
              <div className="mt-10 flex gap-6 flex-wrap">
                {FRAMEWORKS.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true" className="w-2 h-2 rounded-full bg-accent" />
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted">— {f.note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SEO-score showcase */}
            <div className="lg:col-span-5">
              <ScoreCard />
            </div>
          </div>
        </section>

        {/* Lighthouse compare strip */}
        <section className="max-w-6xl mx-auto px-6 mb-24">
          <div className="bg-white border border-black/5 rounded-2xl p-8">
            <h2 className="text-sm uppercase tracking-wider text-muted mb-6">Median Lighthouse Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {COMPARE.map((c) => (
                <div key={c.name} className={c.ours ? "border-l-4 border-accent pl-4" : "pl-4 border-l-4 border-transparent"}>
                  <div className={"text-3xl font-semibold " + (c.ours ? "text-accent" : "")}>{c.score}</div>
                  <div className="text-sm text-muted">{c.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="max-w-6xl mx-auto px-6 mb-24">
          <h2 className="text-3xl font-semibold tracking-tight mb-3">How it works</h2>
          <p className="text-muted mb-12 max-w-2xl">Three steps, no config files, no marketplace plugins.</p>
          <ol className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <li key={s.n} className="bg-white border border-black/5 rounded-2xl p-6">
                <div className="w-9 h-9 rounded-full bg-accent text-white grid place-items-center font-semibold mb-4">{s.n}</div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section id="features" className="max-w-6xl mx-auto px-6 mb-24">
          <h2 className="text-3xl font-semibold tracking-tight mb-3">Why this works</h2>
          <p className="text-muted mb-12 max-w-2xl">No magic. Just sane defaults that line up with what Google actually rewards.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <article key={f.title} className="bg-white border border-black/5 rounded-xl p-6">
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="max-w-6xl mx-auto px-6 mb-24">
          <h2 className="text-3xl font-semibold tracking-tight mb-3">Simple, honest pricing</h2>
          <p className="text-muted mb-12">No token meters. No surprise bills. No "AI credits" hostage.</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl">
            <article className="bg-white border border-black/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-1">Solo</h3>
              <p className="text-muted text-sm mb-4">Build a site that ranks</p>
              <p className="text-3xl font-semibold mb-1">$19<span className="text-base text-muted font-normal">/mo</span></p>
              <p className="text-xs text-muted mb-6">+ your own LLM key (Anthropic or OpenAI)</p>
              <ul className="text-sm space-y-2 text-muted mb-5">
                <li>· 3 projects, 3 custom domains</li>
                <li>· <strong className="text-ink">Unlimited LLM usage</strong> on your key</li>
                <li>· All deploy targets (Vercel, Netlify, GitHub Pages, cPanel)</li>
                <li>· Real-time SEO scoring + audit on export</li>
              </ul>
              <Link href="/billing?plan=solo" className="block text-center w-full text-sm border border-black/10 rounded-md py-2 font-medium hover:bg-black/5">Get Solo</Link>
            </article>
            <article className="bg-white border-2 border-accent rounded-2xl p-6 relative">
              <span className="absolute top-4 right-4 bg-accent text-white text-xs font-medium px-2 py-1 rounded">Most popular</span>
              <h3 className="font-semibold mb-1">Pro</h3>
              <p className="text-muted text-sm mb-4">Run a side income from rankable sites</p>
              <p className="text-3xl font-semibold mb-1">$49<span className="text-base text-muted font-normal">/mo</span></p>
              <p className="text-xs text-muted mb-6">+ your own LLM key</p>
              <ul className="text-sm space-y-2 text-muted mb-5">
                <li>· 10 projects, 10 custom domains</li>
                <li>· 3 collaborators</li>
                <li>· Priority builds + persistent containers</li>
                <li>· One-click publish to <strong className="text-ink">*.seosites.app</strong></li>
              </ul>
              <Link href="/billing?plan=pro" className="block text-center w-full text-sm bg-accent text-white rounded-md py-2 font-medium hover:bg-blue-700">Get Pro</Link>
            </article>
            <article className="bg-white border border-black/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-1">Agency</h3>
              <p className="text-muted text-sm mb-4">Multi-seat + white-label</p>
              <p className="text-3xl font-semibold mb-1">$129<span className="text-base text-muted font-normal">/mo</span></p>
              <p className="text-xs text-muted mb-6">8 seats included · +$10/seat extra</p>
              <ul className="text-sm space-y-2 text-muted mb-5">
                <li>· Unlimited projects + custom domains</li>
                <li>· Role-based access, audit logs</li>
                <li>· White-label client deliverables</li>
                <li>· Dedicated support</li>
              </ul>
              <Link href="/billing?plan=agency" className="block text-center w-full text-sm border border-black/10 rounded-md py-2 font-medium hover:bg-black/5">Get Agency</Link>
            </article>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-3xl mx-auto px-6 mb-24">
          <h2 className="text-3xl font-semibold tracking-tight mb-3">Questions, answered</h2>
          <p className="text-muted mb-10">If it isn't here, open a GitHub issue and we'll add it.</p>
          <ul className="space-y-3">
            {FAQ.map((f) => (
              <li key={f.q}>
                <details className="bg-white border border-black/5 rounded-xl p-5 group">
                  <summary className="font-medium cursor-pointer list-none flex justify-between items-center">
                    <span>{f.q}</span>
                    <span className="text-muted group-open:rotate-180 transition" aria-hidden="true">⌄</span>
                  </summary>
                  <p className="text-muted text-sm leading-relaxed mt-3">{f.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>

        {/* Final CTA */}
        <section className="max-w-3xl mx-auto px-6 mb-24 text-center">
          <h2 className="text-3xl font-semibold tracking-tight mb-3">Ship a site that ranks. Today.</h2>
          <p className="text-muted mb-8">Sign up takes 30 seconds. First Lighthouse 100 takes 2 minutes.</p>
          <Link href="/signup" className="inline-block bg-ink text-white px-6 py-3 rounded-lg font-medium hover:bg-black">
            Start building free
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function ScoreCard() {
  // Static score visual — designed to feel like the real SEO panel.
  const checks = [
    { label: "Title 30–60 chars", ok: true },
    { label: "Meta description", ok: true },
    { label: "Single H1", ok: true },
    { label: "Schema.org JSON-LD", ok: true },
    { label: "Open Graph tags", ok: true },
    { label: "Image alt text", ok: true },
    { label: "html lang attribute", ok: true },
    { label: "Canonical link", ok: true },
    { label: "Viewport meta", ok: true },
    { label: "≤1 render-blocking script", ok: true },
    { label: "Page weight < 100 KB", ok: true },
  ];
  return (
    <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-black/5 flex items-center text-xs uppercase tracking-wider text-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-accent mr-2" />
        Seowebsitesbuilder · SEO panel
        <span className="ml-auto text-[10px] normal-case tracking-normal">live preview</span>
      </div>
      <div className="px-6 py-6">
        <div className="flex items-end gap-3 mb-1">
          <span className="text-6xl font-semibold text-green-600 leading-none">100</span>
          <span className="text-muted mb-1">/ 100</span>
        </div>
        <p className="text-xs text-green-700 font-medium mb-5">Ready to publish</p>
        <ul className="space-y-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-ink">{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="px-6 py-3 bg-accent/5 border-t border-black/5 text-xs text-muted">
        Updates on every keystroke. Won't let you publish under 90.
      </div>
    </div>
  );
}
