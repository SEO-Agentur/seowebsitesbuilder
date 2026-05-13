"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface PublishInfo {
  id: string;
  slug: string;
  status: string;
  url: string;
  lastBuiltAt: string;
  bytesPublished: number | null;
  expiresAt: string | null;
}
interface DomainInfo {
  id: string;
  domain: string;
  status: string;
  verifiedAt: string | null;
  publishId: string;
}

interface Props {
  projectId: string;
  framework: string;
  projectSlug: string;
  onClose: () => void;
}

export function PublishModal({ projectId, framework, projectSlug, onClose }: Props) {
  const [publish, setPublish] = useState<PublishInfo | null>(null);
  const [slug, setSlug] = useState(projectSlug);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [newDomain, setNewDomain] = useState("");

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);
  async function refresh() {
    try {
      const p = await api.getPublish(projectId);
      setPublish(p.publish);
      if (p.publish) setSlug(p.publish.slug);
      const d = await api.listCustomDomains();
      setDomains(d.domains);
    } catch (e: any) { setErr(e.message); }
  }

  async function doPublish() {
    setBusy("publish"); setErr(null); setInfo(null);
    try {
      const r = await api.publish(projectId, slug.trim().toLowerCase());
      setInfo(`Published ${(r.bytesPublished / 1024).toFixed(1)} KB to ${r.url}`);
      await refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  async function doUnpublish() {
    if (!publish) return;
    if (!confirm(`Unpublish ${publish.url}? The site will go offline immediately.`)) return;
    setBusy("unpublish"); setErr(null);
    try { await api.unpublish(projectId); setPublish(null); setInfo("Unpublished."); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  async function addDomain() {
    if (!publish) return;
    const d = newDomain.trim().toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!d) return;
    setBusy("add-domain"); setErr(null); setInfo(null);
    try {
      await api.addCustomDomain(publish.id, d);
      setNewDomain("");
      setInfo(`${d} verified. TLS provisions on first visit.`);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(null); }
  }

  async function recheckDomain(id: string) {
    setBusy(`recheck-${id}`); setErr(null); setInfo(null);
    try { await api.recheckCustomDomain(id); await refresh(); setInfo("Re-checked."); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  async function removeDomain(id: string, domain: string) {
    if (!confirm(`Remove ${domain}?`)) return;
    setBusy(`del-${id}`); setErr(null);
    try { await api.deleteCustomDomain(id); await refresh(); setInfo("Removed."); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  }

  const projectDomains = domains.filter((d) => publish && d.publishId === publish.id);

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-black/5 flex items-center">
          <h2 className="text-lg font-semibold tracking-tight">Publish</h2>
          <button onClick={onClose} className="ml-auto text-sm text-muted hover:text-ink">Close</button>
        </header>

        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-muted mb-5">
            Publish your project to a free subdomain on <code className="px-1 bg-black/5 rounded">seosites.app</code>. Static site only — Astro and Next.js are built inside your container first.
          </p>

          {/* Slug picker */}
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Subdomain</span>
              {publish && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">{publish.status}</span>}
            </div>
            <div className="flex items-center gap-1">
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="my-cool-site"
                pattern="[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?"
                className="flex-1 px-3 py-2 border border-black/10 rounded-l-md outline-none focus:border-accent text-sm font-mono"
              />
              <span className="px-3 py-2 bg-black/5 border border-l-0 border-black/10 rounded-r-md text-sm text-muted font-mono">.seosites.app</span>
            </div>
            <p className="text-xs text-muted mt-1">Lowercase letters, digits, dashes. 3–60 chars.</p>
            <div className="flex gap-2 mt-3">
              <button onClick={doPublish} disabled={busy === "publish" || !slug.trim()} className="bg-accent text-white text-sm px-4 py-2 rounded-md font-medium disabled:opacity-50">
                {busy === "publish" ? (publish ? "Republishing…" : "Publishing…") : (publish ? (publish.slug === slug ? "Republish" : "Move to new slug") : "Publish")}
              </button>
              {publish && (
                <a href={publish.url} target="_blank" rel="noreferrer" className="text-sm px-4 py-2 border border-black/10 rounded-md hover:bg-black/5">View site ↗</a>
              )}
              {publish && (
                <button onClick={doUnpublish} disabled={busy === "unpublish"} className="text-sm px-4 py-2 border border-red-200 text-red-700 rounded-md hover:bg-red-50">
                  Unpublish
                </button>
              )}
            </div>
            {publish && (
              <p className="text-xs text-muted mt-2">
                Live at <a className="text-accent underline" href={publish.url} target="_blank" rel="noreferrer">{publish.url}</a> · last built {new Date(publish.lastBuiltAt).toLocaleString()} · {publish.bytesPublished ? `${(publish.bytesPublished / 1024).toFixed(1)} KB` : "—"}
              </p>
            )}
            {publish?.expiresAt && (() => {
              const days = Math.max(0, Math.ceil((new Date(publish.expiresAt).getTime() - Date.now()) / 86_400_000));
              return (
                <div className="mt-3 bg-yellow-50 border border-yellow-100 rounded px-3 py-2 text-xs text-yellow-800">
                  <strong>Expires in {days} day{days === 1 ? "" : "s"}</strong> ({new Date(publish.expiresAt).toLocaleDateString()}) — free-tier publishes go offline after 7 days.
                  {" "}<a href="/billing" className="underline">Upgrade to Solo or higher</a> to keep it live indefinitely.
                </div>
              );
            })()}
            {framework === "nextjs" && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-100 rounded px-2 py-1 mt-2">
                Next.js publish requires <code className="bg-black/5 px-1 rounded">output: &apos;export&apos;</code> in <code className="bg-black/5 px-1 rounded">next.config.js</code> so <code className="bg-black/5 px-1 rounded">pnpm build</code> produces a static <code className="bg-black/5 px-1 rounded">out/</code> directory.
              </p>
            )}
            {framework === "php" && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1 mt-2">
                PHP sites can&apos;t be published on <code>seosites.app</code> (we serve static files only). Deploy via cPanel/SFTP instead.
              </p>
            )}
          </section>

          {/* Custom domains */}
          {publish && (
            <section className="border-t border-black/5 pt-6">
              <h3 className="text-sm font-medium mb-2">Custom domains</h3>
              <p className="text-xs text-muted mb-3 leading-relaxed">
                Point your own domain at this site. Add an <strong>A record</strong> for the domain (and <code>www</code>) to our server&apos;s IP — we&apos;ll verify and provision TLS automatically.
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="mybusiness.com"
                  className="flex-1 px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent text-sm"
                />
                <button onClick={addDomain} disabled={busy === "add-domain" || !newDomain.trim()} className="bg-ink text-white text-sm px-4 py-2 rounded-md font-medium disabled:opacity-50">
                  {busy === "add-domain" ? "Verifying…" : "Add"}
                </button>
              </div>
              {projectDomains.length > 0 && (
                <ul className="space-y-1 mb-2">
                  {projectDomains.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-sm border border-black/5 rounded px-3 py-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${d.status === "verified" || d.status === "active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>{d.status}</span>
                      <a href={`https://${d.domain}`} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline truncate flex-1">{d.domain}</a>
                      {d.status !== "verified" && d.status !== "active" && (
                        <button onClick={() => recheckDomain(d.id)} disabled={busy === `recheck-${d.id}`} className="text-xs text-muted hover:text-ink">re-check</button>
                      )}
                      <button onClick={() => removeDomain(d.id, d.domain)} disabled={busy === `del-${d.id}`} className="text-xs text-muted hover:text-red-600">remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {err && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mt-4">{err}</div>}
          {info && <div className="bg-green-50 text-green-800 text-sm px-3 py-2 rounded mt-4">{info}</div>}
        </div>
      </div>
    </div>
  );
}
