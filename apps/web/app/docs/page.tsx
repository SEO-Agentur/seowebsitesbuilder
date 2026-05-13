import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const TITLE = "Documentation — How to Build SEO-Perfect Sites";
const DESCRIPTION =
  "Complete guide to Seowebsitesbuilder: the editor, real-time SEO scoring, framework choice (Next.js, Astro, PHP, HTML), backends, AI, and deploys.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://seowebsitesbuilder.com/docs" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://seowebsitesbuilder.com/docs",
    type: "article",
  },
};

const SECTIONS = [
  { id: "quick-start", title: "Quick start" },
  { id: "editor", title: "The editor" },
  { id: "seo-engine", title: "SEO scoring engine" },
  { id: "frameworks", title: "Frameworks" },
  { id: "backends", title: "Backends" },
  { id: "ai-assistant", title: "AI assistant" },
  { id: "deploy", title: "Deployment" },
  { id: "publish", title: "Publishing on seosites.app" },
  { id: "custom-domains", title: "Custom domains" },
  { id: "github-export", title: "Export to GitHub" },
  { id: "account", title: "Account & billing" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

const ARTICLE_LD = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: TITLE,
  description: DESCRIPTION,
  url: "https://seowebsitesbuilder.com/docs",
  author: { "@type": "Organization", name: "Seowebsitesbuilder" },
  datePublished: "2026-05-04",
  dateModified: "2026-05-11",
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://seowebsitesbuilder.com/" },
    { "@type": "ListItem", position: 2, name: "Documentation", item: "https://seowebsitesbuilder.com/docs" },
  ],
};

export default function DocsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([ARTICLE_LD, BREADCRUMB_LD]) }} />
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-[220px_1fr] gap-12">
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <nav aria-label="Documentation sections" className="text-sm">
              <p className="text-xs uppercase tracking-wider text-muted mb-3">On this page</p>
              <ul className="space-y-2">
                {SECTIONS.map((s) => (
                  <li key={s.id}><a href={`#${s.id}`} className="text-muted hover:text-ink">{s.title}</a></li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="prose-content max-w-3xl">
            <p className="text-accent text-sm font-medium tracking-wide mb-4">DOCUMENTATION</p>
            <h1 className="text-4xl font-semibold tracking-tight mb-4 leading-tight">Build a site that ranks, end to end.</h1>
            <p className="text-lg text-muted leading-relaxed mb-12">
              This is the complete reference for Seowebsitesbuilder. Read top-to-bottom for a tour, or jump to the section you need.
            </p>

            <Section id="quick-start" title="Quick start">
              <p>Sign up at <Link href="/signup" className="text-accent underline">/signup</Link>. You&apos;ll land on the dashboard. Click <strong>New project</strong>, give it a name, pick a framework (HTML for the fastest start), and click Create.</p>
              <p>The editor opens with your starter template already scoring 100/100 on the SEO panel. Edit the title, the meta description, the headline — watch the score update on every keystroke. When you&apos;re ready, click <strong>Start preview</strong> to see your site in a live container, then <strong>Deploy</strong> to push it to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or any cPanel host.</p>
              <p>Total time to your first Lighthouse 100 site: about three minutes.</p>
            </Section>

            <Section id="editor" title="The editor">
              <p>The editor has five regions:</p>
              <ul>
                <li><strong>Header</strong> — project name, framework + backend badges, container status, Start/Stop, Terminal toggle, Deploy, Export .zip, GitHub export.</li>
                <li><strong>File tree</strong> — all files in the project (excluding node_modules, .next, dist). Click to open.</li>
                <li><strong>Monaco editor</strong> — same engine as VS Code. Autosaves on every change, 600ms debounce.</li>
                <li><strong>Preview</strong> — live iframe of your running container. Auto-refreshes; click Open in tab for full-page view.</li>
                <li><strong>Right tabbed pane</strong> — switch between the SEO panel (live scoring on the rendered preview) and the AI assistant (chat-to-build).</li>
              </ul>
              <p>The terminal lives in a collapsible drawer below the Monaco editor. Toggle it from the header. It opens a real shell inside your project&apos;s container, useful for installing dependencies or running build scripts.</p>
            </Section>

            <Section id="seo-engine" title="SEO scoring engine">
              <p>Every project is graded against 12 weighted checks. Reaching the 90-point publish threshold means your page has the basics Google rewards:</p>
              <ul>
                <li><strong>Title tag length 30–60 characters</strong> (15 points)</li>
                <li><strong>Meta description 120–160 characters</strong> (15 points)</li>
                <li>Exactly one <code>&lt;h1&gt;</code> on the page (10 points)</li>
                <li>At least one supporting <code>&lt;h2&gt;</code> (5 points)</li>
                <li>All images have meaningful <code>alt</code> text (10 points)</li>
                <li><code>&lt;html lang&gt;</code> attribute set (5 points)</li>
                <li>Canonical link present (5 points)</li>
                <li>At least three Open Graph meta tags (5 points)</li>
                <li>Schema.org JSON-LD block present (10 points)</li>
                <li>Viewport meta for mobile-friendliness (5 points)</li>
                <li>At most one external render-blocking script (10 points)</li>
                <li>Page HTML under 100 KB (5 points)</li>
              </ul>
              <p>The score updates within ~300ms of every edit. Export is blocked under 90 — you can&apos;t accidentally ship a site that won&apos;t rank.</p>
            </Section>

            <Section id="frameworks" title="Frameworks">
              <p>Pick one framework per project. The starter you get out of the box already scores 100/100.</p>
              <ul>
                <li><strong>HTML</strong> — plain semantic HTML, zero JavaScript. Fastest TTFB. Best for landing pages, lead magnets, simple content sites.</li>
                <li><strong>Astro</strong> — static-first with optional islands. Content collections, MDX support. Best for blogs and content-heavy sites.</li>
                <li><strong>Next.js</strong> — App Router with static export. Full metadata API. Best when you need React components or server rendering.</li>
                <li><strong>PHP</strong> — runs on any shared host (cPanel, A2, SiteGround). Best when the deploy target is a $3/mo shared hosting plan.</li>
              </ul>
              <p>Switching frameworks mid-project means regenerating from the starter — your custom content needs to be ported manually. Pick at creation time when possible.</p>
            </Section>

            <Section id="backends" title="Backends">
              <p>Optional. Pick None for a pure static site. Otherwise, one of three database/API patterns will be code-generated into your project at create time:</p>
              <ul>
                <li><strong>Supabase</strong> — auth + Postgres + storage via the official SDK. Migration file, typed client, RLS-friendly query helpers. Connect to your own Supabase project; we never proxy.</li>
                <li><strong>Postgres</strong> — direct connection via <code>pg</code> (Node) or PDO (PHP). Migration file, typed repositories, docker-compose for local dev. Point <code>DATABASE_URL</code> at Neon, Supabase, RDS, Fly Postgres, or self-hosted.</li>
                <li><strong>Go</strong> — idiomatic chi+pgx HTTP API. Multi-stage Dockerfile, distroless runtime image, typed handlers per model.</li>
              </ul>
              <p>All generated code is hand-crafted quality with zero dependency on Seowebsitesbuilder runtime. Edit freely.</p>
            </Section>

            <Section id="ai-assistant" title="AI assistant (chat-to-build)">
              <p>Open the AI tab in the right pane. The assistant has full project context — file list, framework, backend — and can edit any file by emitting fenced code blocks tagged with paths.</p>
              <p>Pricing model: <strong>bring your own key</strong>. Drop an Anthropic or OpenAI API key into your account settings and pay your provider directly. We charge zero token markup. Your token spend is whatever Anthropic or OpenAI bills you.</p>
              <p>The assistant&apos;s system prompt enforces SEO best practices on every edit: single <code>&lt;h1&gt;</code>, title 30–60 chars, meta description 120–160, schema.org JSON-LD, OG tags, alt text on images, ≤1 external script. Sites it produces score 90+ by default.</p>
              <p>Apply edits with the &quot;Apply all&quot; button after each response. You can undo by reverting the saved file from the file tree or via terminal git operations.</p>
            </Section>

            <Section id="deploy" title="Deployment">
              <p>Five built-in deploy targets. Pick from the Deploy modal in the editor header:</p>
              <ul>
                <li><strong>Vercel</strong> — best for Next.js and Astro. Pass a Vercel API token, optionally a teamId. Vercel runs the build itself.</li>
                <li><strong>Netlify</strong> — static-site CDN with atomic deploys. Pass a Netlify token; we create the site if you don&apos;t pass a siteId.</li>
                <li><strong>Cloudflare Pages</strong> — cheapest unlimited static hosting. Pre-create the Pages project in Cloudflare, then pass token + accountId + projectName.</li>
                <li><strong>GitHub Pages</strong> — free static hosting on a <code>gh-pages</code> branch. Public repos only on free GitHub.</li>
                <li><strong>cPanel / shared hosting</strong> — SFTP upload to <code>public_html</code>. Best for PHP. Pass host + username + password (or private key) + the public URL.</li>
              </ul>
              <p>Credentials are forwarded to the provider once per deploy. We don&apos;t store them.</p>
            </Section>

            <Section id="publish" title="Publishing on seosites.app">
              <p>Click <strong>Publish</strong> to push your project to <code>&lt;slug&gt;.seosites.app</code> behind Cloudflare&apos;s CDN. No external account needed; hosting is included on Pro and Agency plans.</p>
              <p>For static frameworks (HTML, Astro static, Next.js static export), publish copies your built output to the hosting layer. For PHP and dynamic Next.js, a per-project production container runs persistently (Business add-on).</p>
            </Section>

            <Section id="custom-domains" title="Custom domains">
              <p>Available on Pro and Agency. Map any domain you own — point its A record at our hosting IP, or CNAME it at <code>cname.seosites.app</code>. TLS is provisioned automatically via on-demand Let&apos;s Encrypt.</p>
              <p>Solo includes 3 custom domains, Pro 10, Agency unlimited.</p>
            </Section>

            <Section id="github-export" title="Export to GitHub">
              <p>Export the full source of any project directly to a GitHub repository you own. From the editor header, click <strong>GitHub</strong>, paste a personal access token (the <code>repo</code> scope is required), and pick a repo name. We&apos;ll create the repo if it doesn&apos;t exist and push your project to <code>main</code> as a single commit.</p>
              <p>Use this for backups, CI integrations, or to hand off code to a developer outside the platform. Your token is forwarded to GitHub once per export and never stored.</p>
            </Section>

            <Section id="account" title="Account &amp; billing">
              <p>One account, one organization, with three plan tiers:</p>
              <ul>
                <li><strong>Solo $19/mo</strong> — 3 projects, 3 custom domains, 1 seat. For freelancers and side projects.</li>
                <li><strong>Pro $49/mo</strong> — 10 projects, 10 custom domains, 3 seats, priority builds, free publishing on <code>*.seosites.app</code>. For SEO operators running a portfolio.</li>
                <li><strong>Agency $129/mo</strong> — unlimited projects and domains, 8 seats included + $10/extra seat, white-label client deliverables. For SEO agencies and consultancies.</li>
              </ul>
              <p>All plans include unlimited LLM usage on your own API key. Cancel anytime; your projects remain accessible for 30 days after cancellation.</p>
            </Section>

            <Section id="troubleshooting" title="Troubleshooting">
              <ul>
                <li><strong>Container won&apos;t start</strong> — check the terminal for errors. Most common cause: <code>pnpm install</code> failing on a syntax error in <code>package.json</code>.</li>
                <li><strong>SEO score stuck below 90</strong> — open the SEO panel, look at which checks are red, fix each. Hover the score for the publish threshold.</li>
                <li><strong>Preview shows 404</strong> — the container probably stopped. Containers auto-stop after 15 minutes of inactivity to keep capacity available; click Start preview again.</li>
                <li><strong>AI chat returns &quot;No provider configured&quot;</strong> — add your Anthropic or OpenAI API key in account settings, then refresh.</li>
                <li><strong>Deploy fails with auth error</strong> — your token expired or lacks scopes. Regenerate with the scopes documented in the Deploy modal.</li>
              </ul>
            </Section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight mb-4">{title}</h2>
      <div className="space-y-4 text-ink leading-relaxed [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_code]:px-1 [&_code]:py-0.5 [&_code]:bg-black/5 [&_code]:rounded [&_code]:text-sm">
        {children}
      </div>
    </section>
  );
}
