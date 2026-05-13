"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Field { key: string; label: string; placeholder?: string; required?: boolean; secret?: boolean; help?: string }
interface Target {
  id: "vercel" | "netlify" | "cloudflare" | "github" | "cpanel";
  name: string;
  blurb: string;
  fields: Field[];
  worksFor: string[];
}

const TARGETS: Target[] = [
  {
    id: "vercel",
    name: "Vercel",
    blurb: "Best for Next.js & Astro. Free tier, automatic SSL, global CDN.",
    worksFor: ["nextjs", "astro", "html"],
    fields: [
      { key: "token", label: "Vercel token", placeholder: "vercel_xxx", secret: true, required: true, help: "Create at vercel.com/account/tokens" },
      { key: "teamId", label: "Team ID (optional)", placeholder: "team_xxx" },
    ],
  },
  {
    id: "netlify",
    name: "Netlify",
    blurb: "Static-site CDN with instant atomic deploys. We'll create the site if you don't pass a siteId.",
    worksFor: ["html", "astro", "nextjs"],
    fields: [
      { key: "token", label: "Netlify token", placeholder: "nfp_xxx", secret: true, required: true, help: "Create at app.netlify.com/user/applications" },
      { key: "siteId", label: "Site ID (optional)", placeholder: "Existing site to update" },
    ],
  },
  {
    id: "cloudflare",
    name: "Cloudflare Pages",
    blurb: "Cheapest unlimited static hosting. Requires a pre-created Pages project.",
    worksFor: ["html", "astro", "nextjs"],
    fields: [
      { key: "token", label: "API token", placeholder: "Cloudflare token (Pages: Edit)", secret: true, required: true },
      { key: "accountId", label: "Account ID", placeholder: "Found in dashboard URL", required: true },
      { key: "projectName", label: "Pages project name", placeholder: "Create the project first in CF dashboard", required: true },
    ],
  },
  {
    id: "github",
    name: "GitHub Pages",
    blurb: "Free static hosting on a repo's gh-pages branch. Public repos only on free GitHub.",
    worksFor: ["html", "astro", "nextjs"],
    fields: [
      { key: "token", label: "GitHub PAT", placeholder: "ghp_xxx (repo scope)", secret: true, required: true },
      { key: "owner", label: "Owner", placeholder: "yourname or org", required: true },
      { key: "repo", label: "Repository", placeholder: "Must already exist", required: true },
      { key: "branch", label: "Branch (defaults to gh-pages)" },
    ],
  },
  {
    id: "cpanel",
    name: "cPanel / shared hosting",
    blurb: "PHP-friendly. SFTP upload to public_html. Works with any host that allows SFTP.",
    worksFor: ["html", "php"],
    fields: [
      { key: "host", label: "Host", placeholder: "ftp.yoursite.com", required: true },
      { key: "username", label: "Username", required: true },
      { key: "password", label: "Password", secret: true },
      { key: "remotePath", label: "Remote path", placeholder: "/home/user/public_html" },
      { key: "publicUrl", label: "Public URL", placeholder: "https://yoursite.com", required: true },
    ],
  },
];

interface Props {
  projectId: string;
  framework: string;
  onClose: () => void;
}

export function DeployModal({ projectId, framework, onClose }: Props) {
  const [target, setTarget] = useState<Target["id"]>("vercel");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const cur = TARGETS.find((t) => t.id === target)!;
  const incompatible = !cur.worksFor.includes(framework);

  useEffect(() => {
    api.listDeploys(projectId).then(({ deploys }) => setHistory(deploys)).catch(() => undefined);
  }, [projectId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setResult(null); setBusy(true);
    try {
      const { deploy } = await api.deployProject(projectId, target, creds);
      setResult(deploy);
      const { deploys } = await api.listDeploys(projectId).catch(() => ({ deploys: [] as any[] }));
      setHistory(deploys);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-black/5 flex items-center">
          <h2 className="text-lg font-semibold tracking-tight">Deploy</h2>
          <button onClick={onClose} className="ml-auto text-muted hover:text-ink text-sm">Close</button>
        </header>

        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-muted mb-4">
            Pick where to publish. Your code stays on your account — we forward credentials to the provider on this request only.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
            {TARGETS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTarget(t.id); setCreds({}); setResult(null); setError(null); }}
                className={`text-left border rounded-lg p-3 ${target === t.id ? "border-accent bg-accent/5" : "border-black/10 hover:bg-black/5"}`}
              >
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-muted">{t.blurb}</div>
              </button>
            ))}
          </div>

          {incompatible && (
            <div className="bg-yellow-50 text-yellow-800 text-sm px-3 py-2 rounded mb-4">
              {cur.name} doesn't support the <strong>{framework}</strong> framework. Pick a different target.
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {cur.fields.map((f) => (
              <label key={f.key} className="block">
                <span className="text-sm font-medium">{f.label}{f.required && <span className="text-red-600"> *</span>}</span>
                <input
                  type={f.secret ? "password" : "text"}
                  value={creds[f.key] || ""}
                  required={f.required}
                  placeholder={f.placeholder}
                  onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent text-sm"
                />
                {f.help && <span className="text-xs text-muted">{f.help}</span>}
              </label>
            ))}

            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded">{error}</div>}
            {result && (
              <div className="bg-green-50 text-green-800 text-sm px-3 py-2 rounded">
                <div>Status: <strong>{result.status}</strong></div>
                {result.url && <div>URL: <a className="underline" target="_blank" rel="noreferrer" href={result.url}>{result.url}</a></div>}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-black/10 hover:bg-black/5">Cancel</button>
              <button type="submit" disabled={busy || incompatible} className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium disabled:opacity-50">
                {busy ? "Deploying…" : `Deploy to ${cur.name}`}
              </button>
            </div>
          </form>

          {history.length > 0 && (
            <section className="mt-8 border-t border-black/5 pt-6">
              <h3 className="text-sm font-medium mb-3">Recent deploys</h3>
              <ul className="space-y-2 text-sm">
                {history.slice(0, 5).map((d: any) => (
                  <li key={d.id} className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      d.status === "success" ? "bg-green-100 text-green-800" :
                      d.status === "building" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                    }`}>{d.status}</span>
                    <span className="text-xs text-muted w-16">{d.target}</span>
                    {d.url
                      ? <a href={d.url} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate">{d.url}</a>
                      : <span className="text-muted">—</span>}
                    <span className="ml-auto text-xs text-muted">{new Date(d.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
