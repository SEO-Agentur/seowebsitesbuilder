"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearSession, currentUser, isAuthed } from "@/lib/auth";

function readQuery(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

interface BillingInfo {
  plan: "free" | "solo" | "pro" | "agency";
  limits: { maxProjects: number | null; maxCustomDomains: number | null; maxSeats: number; publishOnSeosites: boolean; whiteLabel: boolean };
  usage: { projects: number };
  subscription: { status: string; currentPeriodEnd: string | null };
  stripeReady: boolean;
}

const TIERS = [
  { id: "solo",   name: "Solo",    price: 19,  features: ["3 projects", "3 custom domains", "All deploy targets", "Unlimited LLM usage on your key"] },
  { id: "pro",    name: "Pro",     price: 49,  features: ["10 projects", "10 custom domains", "3 collaborators", "Publish on *.seosites.app", "Priority builds"] },
  { id: "agency", name: "Agency",  price: 129, features: ["Unlimited projects + domains", "8 seats included (+$10/extra)", "White-label client deliverables", "Audit logs"] },
] as const;

export default function BillingPage() {
  const router = useRouter();
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [canceled, setCanceled] = useState<string | null>(null);
  const [planParam, setPlanParam] = useState<string | null>(null);

  useEffect(() => {
    setSuccess(readQuery("success"));
    setCanceled(readQuery("canceled"));
    setPlanParam(readQuery("plan"));
  }, []);

  useEffect(() => {
    if (!isAuthed()) { router.replace("/login"); return; }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the user arrived via a /billing?plan=… link, auto-open checkout once we
  // know they're on free. Only fire once per page load.
  useEffect(() => {
    if (!info || !planParam || busy) return;
    if (info.plan !== "free") return;
    if (planParam !== "solo" && planParam !== "pro" && planParam !== "agency") return;
    upgrade(planParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, planParam]);

  async function refresh() {
    setErr(null);
    try { setInfo(await api.billingMe()); }
    catch (e: any) { setErr(e.message); }
  }

  async function upgrade(plan: "solo" | "pro" | "agency") {
    setBusy(plan); setErr(null);
    try {
      const r = await api.checkoutSession(plan);
      window.location.href = r.url;
    } catch (e: any) {
      setErr(e.message);
      setBusy(null);
    }
  }

  async function manage() {
    setBusy("portal"); setErr(null);
    try {
      const r = await api.billingPortal();
      window.location.href = r.url;
    } catch (e: any) {
      setErr(e.message);
      setBusy(null);
    }
  }

  function logout() { clearSession(); router.push("/"); }
  const user = currentUser();

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r border-black/5 p-6 flex flex-col">
        <Link href="/" className="font-semibold text-lg mb-8">Seowebsitesbuilder</Link>
        <nav className="space-y-1 text-sm flex-1">
          <Link href="/dashboard" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Projects</Link>
          <a className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Templates</a>
          <Link href="/domains" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Domains</Link>
          <a className="block px-3 py-2 rounded-md bg-ink/5 font-medium">Billing</a>
          <Link href="/settings" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">AI keys</Link>
          {user?.is_admin && (
            <Link href="/admin" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Admin</Link>
          )}
        </nav>
        <div className="text-sm">
          <p className="text-muted mb-2">{user?.email}</p>
          <button onClick={logout} className="text-muted hover:text-ink">Log out</button>
        </div>
      </aside>

      <main className="flex-1 p-10 max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Billing</h1>
        <p className="text-muted mb-8">Manage your subscription, see usage, change plans.</p>

        {success === "1" && (
          <div className="bg-green-50 text-green-800 px-4 py-3 rounded mb-6">✓ Checkout complete. Your plan has been activated — give the webhook a few seconds to land, then refresh.</div>
        )}
        {canceled === "1" && (
          <div className="bg-yellow-50 text-yellow-800 px-4 py-3 rounded mb-6">Checkout canceled. Pick a plan below when you're ready.</div>
        )}
        {err && <div className="bg-red-50 text-red-700 px-4 py-3 rounded mb-6">{err}</div>}

        {!info ? <p className="text-muted">Loading…</p> : (
          <>
            <section className="bg-white border border-black/5 rounded-2xl p-6 mb-8">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted mb-1">Current plan</div>
                  <div className="text-2xl font-semibold tracking-tight">{info.plan.charAt(0).toUpperCase() + info.plan.slice(1)}</div>
                  <div className="text-sm text-muted mt-1">
                    {info.usage.projects} / {info.limits.maxProjects ?? "∞"} projects · subscription <code className="px-1 bg-black/5 rounded">{info.subscription.status}</code>
                    {info.subscription.currentPeriodEnd && (
                      <> · renews {new Date(info.subscription.currentPeriodEnd).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
                {info.plan !== "free" && (
                  <button onClick={manage} disabled={busy === "portal"} className="text-sm px-4 py-2 border border-black/10 rounded-md hover:bg-black/5">
                    {busy === "portal" ? "Opening…" : "Manage subscription"}
                  </button>
                )}
              </div>

              {!info.stripeReady && (
                <div className="mt-4 bg-yellow-50 text-yellow-800 text-sm px-3 py-2 rounded">
                  Billing isn&apos;t fully wired yet on this deployment. Checkout will fail until the operator configures Stripe.
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight mb-4">{info.plan === "free" ? "Pick a plan" : "Change plan"}</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {TIERS.map((t) => {
                  const isCurrent = info.plan === t.id;
                  return (
                    <article key={t.id} className={`bg-white rounded-2xl p-6 border ${t.id === "pro" ? "border-accent border-2" : "border-black/5"}`}>
                      {t.id === "pro" && (
                        <div className="text-[10px] uppercase tracking-wider text-accent font-medium mb-1">Most popular</div>
                      )}
                      <h3 className="font-semibold mb-1">{t.name}</h3>
                      <p className="text-2xl font-semibold mb-1">${t.price}<span className="text-sm text-muted font-normal">/mo</span></p>
                      <p className="text-xs text-muted mb-4">+ your own LLM key</p>
                      <ul className="text-xs text-muted space-y-1.5 mb-5">
                        {t.features.map((f) => <li key={f}>· {f}</li>)}
                      </ul>
                      {isCurrent ? (
                        <button disabled className="w-full text-sm border border-black/10 rounded-md py-2 bg-black/5 text-muted">Current plan</button>
                      ) : (
                        <button
                          onClick={() => upgrade(t.id)}
                          disabled={busy === t.id || !info.stripeReady}
                          className="w-full text-sm bg-ink text-white rounded-md py-2 font-medium hover:bg-black disabled:opacity-50"
                        >
                          {busy === t.id ? "Opening checkout…" : info.plan === "free" ? "Subscribe" : "Switch to " + t.name}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              <p className="text-xs text-muted mt-4">14-day full refund on first subscription. Cancel anytime from the Manage subscription button above.</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
