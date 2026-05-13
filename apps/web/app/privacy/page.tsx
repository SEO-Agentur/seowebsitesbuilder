import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const TITLE = "Privacy Policy — Seowebsitesbuilder";
const DESCRIPTION =
  "How Seowebsitesbuilder collects, uses, and protects your data. GDPR-aware. BYOK keys and prompt content are forwarded but never logged or stored.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://seowebsitesbuilder.com/privacy" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://seowebsitesbuilder.com/privacy",
    type: "article",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://seowebsitesbuilder.com/" },
    { "@type": "ListItem", position: 2, name: "Privacy", item: "https://seowebsitesbuilder.com/privacy" },
  ],
};

export default function PrivacyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-accent text-sm font-medium tracking-wide mb-4">PRIVACY</p>
        <h1 className="text-4xl font-semibold tracking-tight mb-2 leading-tight">Privacy policy</h1>
        <p className="text-muted mb-8">Last updated: 4 May 2026 · Plain language, GDPR-aware.</p>

        <article className="prose-content space-y-8 text-ink leading-relaxed">
          <Section title="1. Who we are">
            <p>Seowebsitesbuilder is the operator of the website at <strong>seowebsitesbuilder.com</strong> and the hosted editor at the same domain. For data-protection inquiries, contact <a className="text-accent underline" href="mailto:privacy@seowebsitesbuilder.com">privacy@seowebsitesbuilder.com</a>.</p>
          </Section>

          <Section title="2. What we collect">
            <p>The data we hold is the minimum needed to operate the service.</p>
            <ul>
              <li><strong>Account data:</strong> email address, password (stored as a bcrypt hash, never in plain text), display name.</li>
              <li><strong>Project data:</strong> the source code you author or import, project metadata (name, slug, framework choice, status), and a log of file versions for undo.</li>
              <li><strong>Usage telemetry:</strong> last-active timestamps per project (used to auto-stop idle containers), HTTP error logs (no body content), and aggregate page-view counts.</li>
              <li><strong>Payment data:</strong> if you subscribe, we use Stripe to process payments. We see only the last four digits of your card and the billing country — never the full card number, CVC, or expiry. Stripe&apos;s privacy policy applies.</li>
              <li><strong>AI provider keys (BYOK):</strong> encrypted at rest, used only to forward your chat requests to Anthropic or OpenAI in real time. We never log, store, or share the contents of your prompts or the keys themselves outside your account.</li>
            </ul>
          </Section>

          <Section title="3. Why we collect it">
            <p>Strictly to provide the service: authentication, persistence of your projects, running per-project containers, generating SEO scores, billing, and customer support. We do not sell personal data and we do not run third-party advertising trackers on the editor.</p>
          </Section>

          <Section title="4. How we store and protect it">
            <p>Data is held on encrypted disk in a single EU-located VPS. Connections are TLS-only. Postgres listens on localhost only and is not reachable from the public internet. Backups are encrypted with a separate key.</p>
          </Section>

          <Section title="5. Third parties we work with">
            <p>The following processors handle data on our behalf:</p>
            <ul>
              <li><strong>Cloudflare</strong> — edge CDN and DDoS protection for <code>seosites.app</code>. May process IP addresses for security purposes.</li>
              <li><strong>Anthropic</strong> or <strong>OpenAI</strong> — when you use the AI assistant with a BYOK key, prompts are forwarded to your chosen provider. Their privacy policies apply to that processing.</li>
              <li><strong>Stripe</strong> — payment processing once billing is enabled.</li>
              <li><strong>Your chosen deploy targets</strong> — when you deploy or export to Vercel, Netlify, Cloudflare Pages, GitHub, or cPanel, the credentials and source you provide are forwarded once per request to that provider.</li>
            </ul>
          </Section>

          <Section title="6. Cookies">
            <p>We use a single first-party cookie containing your authentication token. It is set when you sign in, scoped to <code>seowebsitesbuilder.com</code>, and marked <code>HttpOnly</code> and <code>Secure</code>. We use no analytics cookies, no advertising cookies, and no third-party tracking pixels.</p>
          </Section>

          <Section title="7. Your rights under GDPR">
            <p>If you are in the EU, EEA, or UK, you have the right to:</p>
            <ul>
              <li><strong>Access</strong> — request a copy of your data (Article 15).</li>
              <li><strong>Rectification</strong> — correct inaccurate data (Article 16).</li>
              <li><strong>Erasure</strong> — request deletion of your account and all associated projects (Article 17).</li>
              <li><strong>Portability</strong> — receive your data in a machine-readable format. Your projects are already exportable as .zip or directly to GitHub from the editor (Article 20).</li>
              <li><strong>Object or restrict processing</strong> (Articles 18, 21).</li>
              <li><strong>Lodge a complaint</strong> with your local data-protection authority.</li>
            </ul>
            <p>Email <a className="text-accent underline" href="mailto:privacy@seowebsitesbuilder.com">privacy@seowebsitesbuilder.com</a> to exercise any of these rights. We respond within 30 days.</p>
          </Section>

          <Section title="8. Data retention">
            <p>Active accounts: we hold your data while your account is open. Cancelled accounts: data is preserved for 30 days, then permanently deleted unless legal obligations require longer retention (e.g. invoice records under German tax law: 10 years).</p>
          </Section>

          <Section title="9. Children">
            <p>The service is not directed to children under 16. We do not knowingly collect data from anyone under 16.</p>
          </Section>

          <Section title="10. Changes to this policy">
            <p>If we make material changes, we will email account holders at least 14 days before the change takes effect, and update the &quot;Last updated&quot; date above. Continued use after the effective date constitutes acceptance.</p>
          </Section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="space-y-3 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_code]:px-1 [&_code]:py-0.5 [&_code]:bg-black/5 [&_code]:rounded [&_code]:text-sm">
        {children}
      </div>
    </section>
  );
}
