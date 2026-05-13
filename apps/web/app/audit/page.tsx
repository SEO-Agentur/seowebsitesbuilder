import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AuditForm } from "@/components/audit-form";

const TITLE = "Free SEO Audit — Score Any URL in 5 Seconds";
const DESCRIPTION =
  "Paste any URL and get a 100-point SEO audit in 5 seconds. 12 weighted checks for title, meta, schema.org, OG tags, alt text, scripts, page weight. Free, no signup.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://seowebsitesbuilder.com/audit" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://seowebsitesbuilder.com/audit",
    type: "website",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://seowebsitesbuilder.com/" },
    { "@type": "ListItem", position: 2, name: "Audit", item: "https://seowebsitesbuilder.com/audit" },
  ],
};

const SERVICE_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Seowebsitesbuilder SEO Audit",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: "https://seowebsitesbuilder.com/audit",
  description: DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function AuditPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([BREADCRUMB_LD, SERVICE_LD]) }} />
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-accent text-sm font-medium tracking-wide mb-4">FREE TOOL</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 leading-tight">
          Score any URL against Google&apos;s actual quality signals.
        </h1>
        <p className="text-lg text-muted mb-10 max-w-2xl">
          Paste a URL. We fetch the page, run 12 weighted checks (title length, meta description, single H1,
          schema.org, OG tags, alt text, render-blocking scripts, page weight…), and give you a 0–100 score with a
          checklist of what to fix.
        </p>

        <AuditForm />

        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-wider text-muted mb-3 font-medium">What we check</h2>
          <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <li>· Title tag length (30–60 chars)</li>
            <li>· Meta description (120–160 chars)</li>
            <li>· Exactly one &lt;h1&gt;</li>
            <li>· Supporting &lt;h2&gt; sections</li>
            <li>· Image alt text coverage</li>
            <li>· &lt;html lang&gt; attribute</li>
            <li>· Canonical link</li>
            <li>· Open Graph meta (≥3 tags)</li>
            <li>· Schema.org JSON-LD</li>
            <li>· Viewport meta</li>
            <li>· ≤1 render-blocking script</li>
            <li>· Page HTML &lt; 100 KB</li>
          </ul>
        </section>

        <section className="mt-16 bg-accent/5 border border-accent/20 rounded-xl p-6">
          <h2 className="text-xl font-semibold tracking-tight mb-2">Want more depth?</h2>
          <p className="text-sm text-muted mb-4">
            The free audit covers the on-page basics. The paid <strong>Deep Audit</strong> (coming soon, $19 one-shot)
            adds Lighthouse Core Web Vitals, mobile-friendliness, structured-data validation, and a downloadable PDF
            report. Or sign up for the editor and audit every change in real time.
          </p>
          <a href="/signup" className="inline-block bg-ink text-white text-sm px-4 py-2 rounded-md font-medium">Sign up free</a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
