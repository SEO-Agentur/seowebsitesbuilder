import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AuditForm } from "@/components/audit-form";

interface AuditResult {
  id: string;
  url: string;
  finalUrl: string;
  status: number;
  score: number;
  fetchedAt: string;
  report: {
    score: number;
    checks: { id: string; label: string; weight: number; passed: boolean; detail?: string }[];
  };
}

const ORCH = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "https://seowebsitesbuilder.com";

async function load(id: string): Promise<AuditResult | null> {
  try {
    const r = await fetch(`${ORCH}/api/audit/${id}`, { cache: "no-store" });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const a = await load(params.id);
  if (!a) return { title: { absolute: "Audit not found — Seowebsitesbuilder" } };
  const host = (() => { try { return new URL(a.url).host; } catch { return a.url; } })();
  const title = `${host} scored ${a.score}/100 — SEO Audit`;
  const description = `Free 12-check SEO audit of ${a.url}. Score: ${a.score}/100. ${a.report.checks.filter((c) => !c.passed).length} issues found. Get the full breakdown.`;
  return {
    title: { absolute: title.length <= 60 ? title : title.slice(0, 57) + "…" },
    description: description.length <= 160 ? description : description.slice(0, 157) + "…",
    alternates: { canonical: `https://seowebsitesbuilder.com/audit/${a.id}` },
    openGraph: { title, description, url: `https://seowebsitesbuilder.com/audit/${a.id}`, type: "article" },
  };
}

export default async function AuditResultPage({ params }: { params: { id: string } }) {
  const a = await load(params.id);
  if (!a) notFound();

  const host = (() => { try { return new URL(a.url).host; } catch { return a.url; } })();
  const failed = a.report.checks.filter((c) => !c.passed);
  const passed = a.report.checks.filter((c) => c.passed);
  const color = a.score >= 90 ? "text-green-600" : a.score >= 70 ? "text-yellow-600" : "text-red-600";
  const ring  = a.score >= 90 ? "ring-green-500/30" : a.score >= 70 ? "ring-yellow-500/30" : "ring-red-500/30";

  const BREADCRUMB_LD = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://seowebsitesbuilder.com/" },
      { "@type": "ListItem", position: 2, name: "Audit", item: "https://seowebsitesbuilder.com/audit" },
      { "@type": "ListItem", position: 3, name: host,    item: `https://seowebsitesbuilder.com/audit/${a.id}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-accent text-sm font-medium tracking-wide mb-3">SEO AUDIT</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2 leading-tight break-words">
          {host}
        </h1>
        <p className="text-sm text-muted mb-1">
          <a href={a.url} className="hover:text-ink underline break-all" target="_blank" rel="noreferrer nofollow">{a.url}</a>
        </p>
        <p className="text-xs text-muted mb-10">Fetched {new Date(a.fetchedAt).toLocaleString()} · HTTP {a.status}</p>

        <section className={`bg-white border border-black/5 rounded-2xl p-8 mb-12 ring-2 ${ring}`}>
          <div className="flex items-baseline gap-4 mb-2">
            <div className={`text-7xl font-semibold ${color}`}>{a.score}</div>
            <div className="text-muted text-lg">/ 100</div>
          </div>
          <p className="text-muted">
            {a.score >= 90 ? "Excellent. This page is ranking-ready."
              : a.score >= 70 ? "Decent baseline. A few easy fixes will get you to 90+."
              : "Significant gaps. Multiple essential signals are missing or wrong."}
          </p>
        </section>

        {failed.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold tracking-tight mb-4">Issues to fix ({failed.length})</h2>
            <ul className="space-y-2">
              {failed.map((c) => (
                <li key={c.id} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg p-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-ink">{c.label}</div>
                    {c.detail && <div className="text-sm text-muted mt-0.5">{c.detail}</div>}
                  </div>
                  <span className="text-xs text-muted whitespace-nowrap">−{c.weight} pts</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {passed.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold tracking-tight mb-4">Passing ({passed.length})</h2>
            <ul className="space-y-2">
              {passed.map((c) => (
                <li key={c.id} className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-lg p-3">
                  <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-ink">{c.label}</div>
                    {c.detail && <div className="text-sm text-muted mt-0.5">{c.detail}</div>}
                  </div>
                  <span className="text-xs text-muted whitespace-nowrap">+{c.weight} pts</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-accent/5 border border-accent/20 rounded-xl p-6 mb-10">
          <h2 className="text-xl font-semibold tracking-tight mb-2">Build a site that scores 100/100.</h2>
          <p className="text-sm text-muted mb-4">
            Our editor enforces every one of these checks while you write, so your output ranks by default.
            Bring your own AI key, no token markup.
          </p>
          <Link href="/signup" className="inline-block bg-ink text-white text-sm font-medium px-5 py-2.5 rounded-md">
            Sign up free
          </Link>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted mb-3 font-medium">Audit another URL</h2>
          <AuditForm />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
