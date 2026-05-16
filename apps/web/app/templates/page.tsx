import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TemplateCard } from "./template-card";

const TITLE = "Templates — SEO-Perfect Starters for Any Niche";
const DESCRIPTION =
  "8 starter templates scoring 100/100 on Lighthouse out of the box. HTML, Astro, Next.js, PHP. Plus niches: lawyer, plumber, dentist, restaurant.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://seowebsitesbuilder.com/templates" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "https://seowebsitesbuilder.com/templates", type: "website" },
};

interface Template {
  id: string;
  name: string;
  category: "framework" | "niche";
  framework: "html" | "astro" | "nextjs" | "php";
  blurb: string;
  thumb: { bg: string; emoji: string };
}

const TEMPLATES: Template[] = [
  { id: "html",   name: "HTML",   category: "framework", framework: "html",   blurb: "Plain semantic HTML. Zero JavaScript. Fastest TTFB. Perfect blank slate.", thumb: { bg: "#fafafa", emoji: "📄" } },
  { id: "astro",  name: "Astro",  category: "framework", framework: "astro",  blurb: "Static-first with optional islands. Content collections, MDX support.",   thumb: { bg: "#ff5d01", emoji: "🚀" } },
  { id: "nextjs", name: "Next.js",category: "framework", framework: "nextjs", blurb: "App Router with static export. Full metadata API. Best for React shops.",   thumb: { bg: "#000",    emoji: "▲" } },
  { id: "php",    name: "PHP",    category: "framework", framework: "php",    blurb: "Runs on any shared host. Best when the deploy target is a $3/mo cPanel.",   thumb: { bg: "#777bb3", emoji: "🐘" } },
  { id: "html-lawyer",     name: "Lawyer / Law Firm",  category: "niche", framework: "html", blurb: "Family + business law firm. LegalService schema, practice areas, free consultation CTA.",  thumb: { bg: "#0e3c5b", emoji: "⚖️" } },
  { id: "html-plumber",    name: "Plumber / Trades",    category: "niche", framework: "html", blurb: "24/7 emergency plumber. Plumber schema, service area, sticky emergency phone bar.",     thumb: { bg: "#0c63d6", emoji: "🔧" } },
  { id: "html-dentist",    name: "Dentist / Clinic",    category: "niche", framework: "html", blurb: "Family dental. Dentist schema, hours, transparent pricing, kid-friendly tone.",          thumb: { bg: "#1a8a8a", emoji: "🦷" } },
  { id: "html-restaurant", name: "Restaurant / Bar",    category: "niche", framework: "html", blurb: "Neighborhood Italian. Restaurant schema, full menu with prices, hours, reservations.",   thumb: { bg: "#a23618", emoji: "🍝" } },
];

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://seowebsitesbuilder.com/" },
    { "@type": "ListItem", position: 2, name: "Templates", item: "https://seowebsitesbuilder.com/templates" },
  ],
};

export default function TemplatesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 py-16">
        <p className="text-accent text-sm font-medium tracking-wide mb-4">TEMPLATES</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 leading-tight">Starters that score 100/100 out of the box.</h1>
        <p className="text-lg text-muted mb-12 max-w-2xl">
          Pick a framework starter for a blank slate, or a niche template that comes pre-loaded with the schema.org markup and copy structure Google rewards for that vertical.
        </p>

        <section className="mb-16">
          <h2 className="text-xs uppercase tracking-wider text-muted mb-4 font-medium">Framework starters</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TEMPLATES.filter((t) => t.category === "framework").map((t) => <TemplateCard key={t.id} t={t} />)}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-xs uppercase tracking-wider text-muted mb-4 font-medium">Niche starters — local business</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TEMPLATES.filter((t) => t.category === "niche").map((t) => <TemplateCard key={t.id} t={t} />)}
          </div>
        </section>

        <section className="text-center bg-white border border-black/5 rounded-2xl p-10 max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold tracking-tight mb-2">Need a template that isn't here?</h2>
          <p className="text-muted mb-6">Sign up and ask the AI assistant to build it for you. It produces 100/100 markup by default and accepts your BYOK key — no extra cost beyond what your provider charges.</p>
          <Link href="/signup" className="bg-ink text-white px-6 py-3 rounded-lg font-medium hover:bg-black">
            Start building
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

