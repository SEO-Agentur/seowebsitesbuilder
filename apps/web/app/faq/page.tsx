import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const TITLE = "FAQ — Seowebsitesbuilder Questions Answered";
const DESCRIPTION =
  "Answers about Seowebsitesbuilder: pricing, the BYOK AI model, backends, custom domains, exports, refunds, GDPR, and Wix/Webflow comparison.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://seowebsitesbuilder.com/faq" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://seowebsitesbuilder.com/faq",
    type: "article",
  },
};

const QA = [
  {
    q: "How is Seowebsitesbuilder different from Wix or Webflow?",
    a: "Wix and Webflow generate proprietary HTML behind a runtime you can't leave — even great-looking sites are slow and hard to migrate. Our editor produces hand-crafted-quality code in your chosen framework (HTML, Astro, Next.js, or PHP) that scores Lighthouse 100 by default, and the entire site is exportable to a .zip or directly to a GitHub repo you own. You're never locked in.",
  },
  {
    q: "How does the BYOK pricing actually work?",
    a: "Bring Your Own Key. You add an Anthropic or OpenAI API key in account settings; we forward your AI chat requests to your chosen provider in real time. You pay the AI provider whatever tokens you consume — we charge zero markup. Our subscription ($19/mo Solo, $49/mo Pro, $129/mo Agency) covers the editor, the per-project containers, hosting, and unlimited usage on your key.",
  },
  {
    q: "What plan should I start on?",
    a: "Most people start on Solo at $19/mo — 3 projects and 3 custom domains is plenty for a freelancer or someone running a personal site. Move to Pro at $49/mo once you're running 4+ ranked sites or need free hosting on *.seosites.app. Agency at $129/mo is for SEO consultancies that need to white-label client deliverables.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your account settings in two clicks. Your projects stay accessible for 30 days after cancellation so you can export them as .zip or push them to GitHub.",
  },
  {
    q: "Do you offer refunds?",
    a: "14-day no-questions-asked refund on your first subscription. After that, refunds are only provided where required by law (EU consumer-protection statutes apply).",
  },
  {
    q: "What if I need a backend for my site?",
    a: "Pick Supabase, Postgres, or Go at project creation. We code-generate the schema, typed client or repository, and migrations — all running against your own database (Neon, Supabase, RDS, Fly Postgres, or self-hosted). No vendor lock-in; the generated code has zero dependency on Seowebsitesbuilder.",
  },
  {
    q: "Can I use a custom domain?",
    a: "Yes. Solo includes 3 custom domains, Pro 10, Agency unlimited. Point your domain's A record at our hosting IP (or CNAME it at cname.seosites.app), and we provision Let's Encrypt TLS automatically.",
  },
  {
    q: "How fast are sites built on Seowebsitesbuilder?",
    a: "The 4 starter templates ship at Lighthouse 100. The editor's real-time SEO panel won't let you publish below a score of 90. Hosted sites are served from /var/seosites/<slug>/ behind Cloudflare's CDN — typical TTFB is 30–80 ms globally.",
  },
  {
    q: "Where is my data stored?",
    a: "On encrypted disk in a single EU-located VPS. Postgres binds to localhost only; the database is never reachable from the public internet. Backups are encrypted with a separate key. See our Privacy Policy for full detail.",
  },
  {
    q: "Are you GDPR compliant?",
    a: "Yes — we operate in the EU and our processing is built around GDPR principles. You have rights to access, rectification, erasure, portability, objection, and complaint. Email privacy@seowebsitesbuilder.com to exercise any of them; we respond within 30 days.",
  },
  {
    q: "Can I export my site to GitHub?",
    a: "Yes. From the editor header, click GitHub, paste a personal access token with repo scope, and pick a repository name. We create the repo on your account if it doesn't exist and push the full project source to main as a single commit. Useful for backups, CI integrations, or handing off to a dev.",
  },
  {
    q: "What deploy targets are supported?",
    a: "Five built-in: Vercel, Netlify, Cloudflare Pages, GitHub Pages, and cPanel via SFTP. Plus our own hosting on *.seosites.app for Pro and Agency plans. Credentials are forwarded once per deploy and never stored.",
  },
  {
    q: "What AI models can I use?",
    a: "Anthropic Claude (Sonnet 4.6 by default) or OpenAI GPT-4o-mini. The orchestrator forwards your messages to whichever provider's key you've configured. ANTHROPIC_API_KEY takes precedence if both are set.",
  },
  {
    q: "What happens if I exceed my plan's project or domain limit?",
    a: "We block the creation of new projects or the binding of new custom domains until you upgrade or remove one. We never delete your existing work. Limits aren't soft — they're enforced at create time, not run time.",
  },
  {
    q: "What is the SEO scoring engine actually checking?",
    a: "12 weighted checks: title length, meta description length, single H1, supporting H2s, image alt text, html lang, canonical, Open Graph tags, schema.org JSON-LD, viewport meta, render-blocking script budget, and page weight. See the Documentation for the full rubric.",
  },
  {
    q: "Does the AI assistant know my project?",
    a: "Yes. Every chat request includes the project's file tree, framework, and backend choice. When you reference a specific file in your prompt, the editor reads its current content and inlines it for the model. The model is instructed to enforce SEO best practices (single H1, schema.org, alt text, ≤1 external script) on every edit.",
  },
  {
    q: "How do you handle idle containers?",
    a: "Per-project Docker containers auto-stop after 15 minutes of inactivity (no preview requests, no terminal activity). When you come back, click Start preview and the container relaunches in 5–10 seconds. This keeps capacity available for other users on the same VPS.",
  },
  {
    q: "Why do I see *.seosites.app as the hosting domain?",
    a: "We deliberately separate the platform domain (seowebsitesbuilder.com) from the hosting domain (seosites.app). Different eTLD+1 means no cookie scope confusion, no SEO cross-contamination, and a cleaner upgrade path to your own custom domain.",
  },
  {
    q: "Is there an API?",
    a: "Yes. The orchestrator exposes a REST API at https://seowebsitesbuilder.com/auth/*, /projects/*, /llm/chat, and /preview/* — the same API the web editor uses. JWT auth via the Authorization: Bearer header. Useful for CI integrations or custom tooling.",
  },
  {
    q: "What if my question isn't here?",
    a: "Email support@seowebsitesbuilder.com. We answer within one business day on Solo and Pro, and within 4 business hours on Agency.",
  },
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: QA.map((x) => ({
    "@type": "Question",
    name: x.q,
    acceptedAnswer: { "@type": "Answer", text: x.a },
  })),
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://seowebsitesbuilder.com/" },
    { "@type": "ListItem", position: 2, name: "FAQ", item: "https://seowebsitesbuilder.com/faq" },
  ],
};

export default function FaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([FAQ_LD, BREADCRUMB_LD]) }} />
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-accent text-sm font-medium tracking-wide mb-4">FAQ</p>
        <h1 className="text-4xl font-semibold tracking-tight mb-4 leading-tight">Questions, answered.</h1>
        <p className="text-lg text-muted mb-10">If your question isn&apos;t here, email <a className="text-accent underline" href="mailto:support@seowebsitesbuilder.com">support@seowebsitesbuilder.com</a> — we&apos;ll add it.</p>

        <ul className="space-y-3">
          {QA.map((f) => (
            <li key={f.q}>
              <details className="bg-white border border-black/5 rounded-xl p-5 group">
                <summary className="font-medium cursor-pointer list-none flex justify-between items-center gap-4">
                  <span>{f.q}</span>
                  <span aria-hidden="true" className="text-muted group-open:rotate-180 transition flex-shrink-0">⌄</span>
                </summary>
                <p className="text-muted text-sm leading-relaxed mt-3">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>

        <section className="mt-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight mb-3">Still have questions?</h2>
          <p className="text-muted mb-6">Try the live editor — it&apos;s the fastest way to see if it fits.</p>
          <Link href="/signup" className="inline-block bg-ink text-white px-6 py-3 rounded-lg font-medium hover:bg-black">
            Start building
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
