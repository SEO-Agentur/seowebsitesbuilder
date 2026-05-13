import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const TITLE = "Terms of Service — Seowebsitesbuilder";
const DESCRIPTION =
  "Terms of service for Seowebsitesbuilder: subscription plans, BYOK responsibilities, acceptable use, IP ownership, liability, and German governing law.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://seowebsitesbuilder.com/terms" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://seowebsitesbuilder.com/terms",
    type: "article",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://seowebsitesbuilder.com/" },
    { "@type": "ListItem", position: 2, name: "Terms", item: "https://seowebsitesbuilder.com/terms" },
  ],
};

export default function TermsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-accent text-sm font-medium tracking-wide mb-4">TERMS</p>
        <h1 className="text-4xl font-semibold tracking-tight mb-2 leading-tight">Terms of service</h1>
        <p className="text-muted mb-8">Last updated: 4 May 2026 · By using Seowebsitesbuilder you accept these terms.</p>

        <article className="prose-content space-y-8 text-ink leading-relaxed">
          <Section title="1. Acceptance">
            <p>By creating an account or using the service at <strong>seowebsitesbuilder.com</strong> (the &quot;Service&quot;), you agree to these Terms. If you do not agree, do not use the Service. These Terms form a binding contract between you and Seowebsitesbuilder (the &quot;Provider&quot;).</p>
          </Section>

          <Section title="2. The service">
            <p>Seowebsitesbuilder is a hosted no-code platform for building SEO-optimized websites. It includes a visual editor, real-time SEO scoring, per-project Docker containers, code generators, deployment adapters, and optional hosting on the <code>seosites.app</code> domain.</p>
          </Section>

          <Section title="3. Your account">
            <p>You must be at least 18 years old (or the age of majority in your jurisdiction) to use the Service. You are responsible for keeping your credentials secure and for all activity under your account. Notify us immediately at <a className="text-accent underline" href="mailto:security@seowebsitesbuilder.com">security@seowebsitesbuilder.com</a> if you suspect unauthorized access.</p>
          </Section>

          <Section title="4. Acceptable use">
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Host content that is illegal under the laws of the European Union, Germany, or your own jurisdiction.</li>
              <li>Distribute malware, phishing pages, or content that infringes third-party intellectual property.</li>
              <li>Send unsolicited bulk email, run open mail relays, or use generated sites for spam.</li>
              <li>Consume disproportionate compute resources (e.g. cryptocurrency mining, indefinite long-running processes that aren&apos;t serving real user traffic).</li>
              <li>Attempt to bypass authentication, the SEO publish gate, rate limits, or quota enforcement.</li>
              <li>Resell the Service or sublicense access to it without an active Agency-tier subscription.</li>
            </ul>
            <p>We may suspend or terminate accounts that violate these rules, with or without prior notice depending on severity.</p>
          </Section>

          <Section title="5. Subscriptions and payment">
            <p>Plan tiers and pricing are listed at <a className="text-accent underline" href="/#pricing">/#pricing</a>. Subscriptions auto-renew at the end of each billing period unless cancelled. Cancellations take effect at the end of the current period — no proration for partial months.</p>
            <p><strong>Refunds:</strong> we offer a 14-day full refund on first-time subscriptions. After that, refunds are not provided except where required by applicable law.</p>
            <p><strong>Price changes:</strong> we will give 30 days&apos; email notice before increasing the price of your plan. You may cancel before the change takes effect.</p>
          </Section>

          <Section title="6. Bring-your-own-key (BYOK) AI">
            <p>The AI assistant requires you to provide your own Anthropic or OpenAI API key. You are responsible for all charges your AI provider bills you. We do not mark up tokens, but we also do not subsidize or refund AI-provider charges resulting from your use, abuse, or compromised credentials. Keep your keys secret.</p>
          </Section>

          <Section title="7. Your content, your code">
            <p>You retain all rights to the source code, content, and other materials you create using the Service (collectively, &quot;Your Content&quot;). You grant us a non-exclusive, royalty-free license to host, copy, transmit, and modify Your Content solely to provide the Service to you (e.g. running containers, applying generator output, serving published sites).</p>
            <p>You represent that you have all necessary rights to upload Your Content and that it does not infringe third-party rights.</p>
          </Section>

          <Section title="8. Our platform, our code">
            <p>The Service software, branding, documentation, and underlying infrastructure are owned by the Provider. Nothing in these Terms grants you any right in the platform itself.</p>
          </Section>

          <Section title="9. Service availability">
            <p>We aim for 99.5% monthly uptime but do not offer a contractual SLA on Solo and Pro plans. Agency plans include a 99.9% uptime commitment with service credits — contact us for the SLA addendum.</p>
            <p>We may take the Service offline for maintenance with reasonable notice (typically posted at least 24 hours in advance, exclusive of emergencies).</p>
          </Section>

          <Section title="10. Termination">
            <p>You may cancel any time from your account settings. We may terminate or suspend your account for material breach of these Terms (notably section 4), non-payment, or if required by law. On termination, you have 30 days to export Your Content (via the <code>.zip</code> export or GitHub export); after that, your data is permanently deleted.</p>
          </Section>

          <Section title="11. Limitation of liability">
            <p>To the maximum extent permitted by law: (i) the Service is provided &quot;as is&quot; without warranties of any kind; (ii) the Provider is not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits or lost data; (iii) the Provider&apos;s aggregate liability arising out of these Terms is limited to the amount you paid for the Service in the 12 months preceding the claim.</p>
            <p>Nothing in this section limits liability for gross negligence, willful misconduct, or anything that cannot be excluded under applicable consumer-protection or product-liability law.</p>
          </Section>

          <Section title="12. Indemnification">
            <p>You agree to indemnify and hold the Provider harmless from claims arising out of your use of the Service in violation of these Terms or applicable law, including but not limited to claims that Your Content infringes third-party rights.</p>
          </Section>

          <Section title="13. Governing law and venue">
            <p>These Terms are governed by the laws of the Federal Republic of Germany, excluding its conflict-of-laws rules and the UN Convention on Contracts for the International Sale of Goods. Exclusive venue for any dispute is the courts of Berlin, Germany, unless mandatory consumer-protection rules require otherwise.</p>
          </Section>

          <Section title="14. Changes to these terms">
            <p>We may update these Terms from time to time. Material changes will be notified to account holders by email at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance.</p>
          </Section>

          <Section title="15. Contact">
            <p>Questions about these Terms: <a className="text-accent underline" href="mailto:legal@seowebsitesbuilder.com">legal@seowebsitesbuilder.com</a>.</p>
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
