"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearSession, currentUser, isAuthed } from "@/lib/auth";

interface Domain {
  id: string;
  domain: string;
  status: string;
  verifiedAt: string | null;
  slug: string;
  publishId: string;
}

interface Publish {
  id: string;
  slug: string;
  url: string;
  project: { id: string; name: string; framework: string };
}

interface PlanInfo {
  plan: "free" | "solo" | "pro" | "agency";
  limits: { maxCustomDomains: number | null };
}

const VPS_IP = "187.77.74.66";

export default function DomainsPage() {
  const router = useRouter();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [publishes, setPublishes] = useState<Publish[]>([]);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [selectedPublishId, setSelectedPublishId] = useState("");

  useEffect(() => {
    if (!isAuthed()) { router.replace("/login"); return; }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const [d, p, b] = await Promise.all([
        api.listCustomDomains(),
        api.listPublishes(),
        api.billingMe(),
      ]);
      setDomains(d.domains);
      setPublishes(p.publishes);
      setPlanInfo({ plan: b.plan, limits: { maxCustomDomains: b.limits.maxCustomDomains } });
      if (!selectedPublishId && p.publishes.length > 0) setSelectedPublishId(p.publishes[0].id);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPublishId) return;
    const cleaned = newDomain.trim().toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^www\./, "");
    if (!cleaned) return;
    setBusy("add"); setErr(null); setInfo(null);
    try {
      await api.addCustomDomain(selectedPublishId, cleaned);
      setInfo(`${cleaned} verified. TLS provisions on first visit.`);
      setNewDomain("");
      setShowAdd(false);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(null); }
  }

  async function recheck(id: string) {
    setBusy(`recheck-${id}`); setErr(null); setInfo(null);
    try { await api.recheckCustomDomain(id); await refresh(); setInfo("Re-checked."); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  async function remove(id: string, domain: string) {
    if (!confirm(`Remove ${domain}? Visitors will get a TLS error until DNS is repointed.`)) return;
    setBusy(`del-${id}`); setErr(null); setInfo(null);
    try { await api.deleteCustomDomain(id); await refresh(); setInfo(`${domain} removed.`); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  function logout() { clearSession(); router.push("/"); }
  const user = currentUser();

  const max = planInfo?.limits.maxCustomDomains ?? null;
  const overLimit = max !== null && domains.length >= max;

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r border-black/5 p-6 flex flex-col">
        <Link href="/" className="font-semibold text-lg mb-8">Seowebsitesbuilder</Link>
        <nav className="space-y-1 text-sm flex-1">
          <Link href="/dashboard" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Projects</Link>
          <a className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Templates</a>
          <a className="block px-3 py-2 rounded-md bg-ink/5 font-medium">Domains</a>
          <Link href="/billing" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Billing</Link>
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

      <main className="flex-1 p-10 max-w-5xl">
        <div className="flex items-baseline justify-between mb-2 gap-4 flex-wrap">
          <h1 className="text-3xl font-semibold tracking-tight">Custom domains</h1>
          {planInfo && (
            <div className="text-sm text-muted">
              <strong className="text-ink">{domains.length}</strong> / {max ?? "∞"} used · {planInfo.plan} plan
              {overLimit && <Link href="/billing" className="ml-2 text-accent">Upgrade →</Link>}
            </div>
          )}
        </div>
        <p className="text-muted mb-8">All custom domains across your published projects. Point your domain at our server, click Add, and we&apos;ll provision TLS on the first visit.</p>

        {/* DNS instructions */}
        <section className="bg-white border border-black/5 rounded-2xl p-6 mb-8">
          <h2 className="text-sm uppercase tracking-wider text-muted mb-3 font-medium">DNS setup (one-time per domain)</h2>
          <ol className="text-sm space-y-2.5 list-decimal pl-5">
            <li>At your registrar (Namecheap, Cloudflare, etc.), add an <strong>A record</strong>:
              <div className="mt-1 inline-block">
                <code className="bg-black/5 px-2 py-1 rounded font-mono text-xs">@</code>{" "}→{" "}
                <code className="bg-black/5 px-2 py-1 rounded font-mono text-xs">{VPS_IP}</code>
              </div>
              <div className="mt-1 text-xs text-muted">Add another A record for <code className="bg-black/5 px-1 rounded">www</code> with the same IP to handle the www→apex case.</div>
            </li>
            <li>Wait 1–5 minutes for DNS to propagate (or longer if your TTL is high).</li>
            <li>Click <strong>Add domain</strong> below. We&apos;ll verify the DNS resolves to us before activating.</li>
            <li>First visit to <code className="bg-black/5 px-1 rounded">https://yourdomain.com</code> provisions a Let&apos;s Encrypt TLS certificate automatically (~5 sec).</li>
          </ol>
          {publishes.length > 0 && (
            <p className="text-xs text-muted mt-4 pt-4 border-t border-black/5">
              <strong>Important:</strong> if your domain is behind Cloudflare or another proxy, the A record must point to <code className="bg-black/5 px-1 rounded">{VPS_IP}</code> (grey-cloud / DNS-only). A proxied A record will fail verification.
            </p>
          )}
        </section>

        {err && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded mb-4">{err}</div>}
        {info && <div className="bg-green-50 text-green-800 text-sm px-4 py-2 rounded mb-4">{info}</div>}

        {/* Domains table */}
        <section className="bg-white border border-black/5 rounded-2xl overflow-hidden">
          <header className="flex items-center justify-between px-6 py-4 border-b border-black/5">
            <h2 className="font-semibold tracking-tight">Domains</h2>
            {publishes.length > 0 && !overLimit && (
              <button
                onClick={() => setShowAdd(true)}
                className="bg-accent text-white text-sm px-4 py-2 rounded-md font-medium hover:bg-blue-700"
              >
                Add domain
              </button>
            )}
          </header>

          {showAdd && publishes.length > 0 && (
            <form onSubmit={addDomain} className="px-6 py-4 border-b border-black/5 bg-accent/5 space-y-3">
              <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-muted">Domain</span>
                  <input
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="mybusiness.com"
                    required
                    className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent text-sm bg-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-muted">Points at</span>
                  <select
                    value={selectedPublishId}
                    onChange={(e) => setSelectedPublishId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent text-sm bg-white"
                  >
                    {publishes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project.name} → {p.slug}.seosites.app
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end gap-2">
                  <button type="submit" disabled={busy === "add"} className="bg-ink text-white text-sm px-4 py-2 rounded-md font-medium disabled:opacity-50">
                    {busy === "add" ? "Verifying…" : "Add"}
                  </button>
                  <button type="button" onClick={() => { setShowAdd(false); setNewDomain(""); setErr(null); }} className="text-sm px-3 py-2 text-muted hover:text-ink">
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          {loading ? (
            <div className="px-6 py-8 text-muted text-sm">Loading…</div>
          ) : publishes.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-muted mb-3">No published projects yet.</p>
              <p className="text-sm text-muted mb-6">Publish a project to <code className="bg-black/5 px-1 rounded">*.seosites.app</code> first, then attach a custom domain.</p>
              <Link href="/dashboard" className="bg-ink text-white text-sm px-4 py-2 rounded-md font-medium">Go to projects</Link>
            </div>
          ) : domains.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-muted mb-3">No custom domains yet.</p>
              <p className="text-sm text-muted mb-6">Add one to serve a published project on your own domain.</p>
              {!showAdd && !overLimit && (
                <button onClick={() => setShowAdd(true)} className="bg-accent text-white text-sm px-4 py-2 rounded-md font-medium">
                  Add your first domain
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-black/[0.02] text-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left font-medium px-6 py-3">Domain</th>
                  <th className="text-left font-medium px-2 py-3">Status</th>
                  <th className="text-left font-medium px-2 py-3">Project</th>
                  <th className="text-left font-medium px-2 py-3">Serves</th>
                  <th className="text-left font-medium px-2 py-3">Added</th>
                  <th className="text-right font-medium px-6 py-3 w-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => {
                  const pub = publishes.find((p) => p.id === d.publishId);
                  return (
                    <tr key={d.id} className="border-t border-black/5">
                      <td className="px-6 py-3">
                        <a href={`https://${d.domain}`} target="_blank" rel="noreferrer" className="text-accent hover:underline font-mono">{d.domain}</a>
                      </td>
                      <td className="px-2 py-3">
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          d.status === "verified" || d.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-2 py-3">{pub?.project.name ?? "—"}</td>
                      <td className="px-2 py-3 font-mono text-xs text-muted">{d.slug}.seosites.app</td>
                      <td className="px-2 py-3 text-muted text-xs">{d.verifiedAt ? new Date(d.verifiedAt).toLocaleDateString() : "pending"}</td>
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        <button onClick={() => recheck(d.id)} disabled={busy === `recheck-${d.id}`} className="text-xs text-muted hover:text-ink mr-3">
                          {busy === `recheck-${d.id}` ? "checking…" : "re-check"}
                        </button>
                        <button onClick={() => remove(d.id, d.domain)} disabled={busy === `del-${d.id}`} className="text-xs text-muted hover:text-red-600">
                          remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {publishes.length > 0 && (
          <p className="text-xs text-muted mt-4">
            Tip: you can also add custom domains from the <strong>Publish</strong> modal in the editor, one project at a time.
          </p>
        )}
      </main>
    </div>
  );
}
