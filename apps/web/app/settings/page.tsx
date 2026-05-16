"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearSession, currentUser, isAuthed } from "@/lib/auth";

interface KeyInfo {
  provider: string;
  baseUrl: string | null;
  defaultModel: string;
  label: string | null;
  masked: string;
  updatedAt: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  defaultModel: string;
  keyDocsUrl: string;
  presets?: { name: string; baseUrl: string; defaultModel?: string }[];
}

export default function SettingsPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthed()) { router.replace("/login"); return; }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const r = await api.listAiKeys();
      setKeys(r.keys);
      setProviders(r.available);
      setErr(null);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  function logout() { clearSession(); router.push("/"); }
  const user = currentUser();

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r border-black/5 p-6 flex flex-col">
        <Link href="/" className="font-semibold text-lg mb-8">Seowebsitesbuilder</Link>
        <nav className="space-y-1 text-sm flex-1">
          <Link href="/dashboard" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Projects</Link>
          <Link href="/templates" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Templates</Link>
          <Link href="/domains" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Domains</Link>
          <Link href="/billing" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Billing</Link>
          <a className="block px-3 py-2 rounded-md bg-ink/5 font-medium">AI keys</a>
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
        <h1 className="text-3xl font-semibold tracking-tight mb-2">AI keys</h1>
        <p className="text-muted mb-8">
          Bring your own key — every chat request is forwarded to the provider on your key. We never log prompts or token usage, and we charge zero token markup.
        </p>

        {err && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded mb-6">{err}</div>}

        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <div className="space-y-6">
            {providers.map((p) => {
              const existing = keys.find((k) => k.provider === p.id);
              return (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  existing={existing}
                  onChanged={refresh}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function ProviderCard({
  provider,
  existing,
  onChanged,
}: {
  provider: ProviderInfo;
  existing?: KeyInfo;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(!existing);
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");
  const [model, setModel] = useState(existing?.defaultModel ?? provider.defaultModel);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setTestResult(null);
    try {
      await api.putAiKey(provider.id, {
        key: key.trim(),
        baseUrl: baseUrl.trim() || undefined,
        defaultModel: model.trim() || undefined,
      });
      setKey(""); setShowForm(false);
      onChanged();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function test() {
    setTestResult(null); setBusy(true);
    try {
      const r = await api.testAiKey(provider.id);
      setTestResult({ ok: r.ok, msg: r.ok ? `OK — model ${r.model || ""}` : (r.error || "Test failed") });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message });
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm(`Remove your ${provider.name} key?`)) return;
    setBusy(true);
    try { await api.deleteAiKey(provider.id); setShowForm(true); setKey(""); onChanged(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <article className="bg-white border border-black/5 rounded-2xl p-6">
      <header className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-semibold tracking-tight">{provider.name}</h2>
          <p className="text-xs text-muted mt-1">
            Get a key: <a className="text-accent underline" target="_blank" rel="noreferrer" href={provider.keyDocsUrl}>{new URL(provider.keyDocsUrl).host}</a>
          </p>
        </div>
        {existing && (
          <div className="text-right">
            <div className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full inline-block">configured</div>
            <p className="text-xs text-muted mt-1 font-mono">{existing.masked}</p>
          </div>
        )}
      </header>

      {existing && !showForm && (
        <>
          <dl className="text-sm grid grid-cols-[120px_1fr] gap-y-1 mb-4">
            <dt className="text-muted">Model</dt><dd>{existing.defaultModel}</dd>
            {existing.baseUrl && (<><dt className="text-muted">Base URL</dt><dd className="break-all">{existing.baseUrl}</dd></>)}
            <dt className="text-muted">Updated</dt><dd>{new Date(existing.updatedAt).toLocaleString()}</dd>
          </dl>
          <div className="flex gap-2">
            <button onClick={test} disabled={busy} className="text-sm px-3 py-1.5 border border-black/10 rounded-md hover:bg-black/5">Test</button>
            <button onClick={() => setShowForm(true)} className="text-sm px-3 py-1.5 border border-black/10 rounded-md hover:bg-black/5">Replace</button>
            <button onClick={remove} disabled={busy} className="text-sm px-3 py-1.5 border border-red-200 text-red-700 rounded-md hover:bg-red-50">Remove</button>
          </div>
          {testResult && (
            <div className={`mt-3 text-sm px-3 py-2 rounded ${testResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
              {testResult.msg}
            </div>
          )}
        </>
      )}

      {showForm && (
        <form onSubmit={save} className="space-y-3">
          {provider.id === "openai_compat" && provider.presets && (
            <div>
              <label className="text-sm font-medium">Preset</label>
              <select
                onChange={(e) => {
                  const p = provider.presets!.find((x) => x.baseUrl === e.target.value);
                  if (p) { setBaseUrl(p.baseUrl); if (p.defaultModel) setModel(p.defaultModel); }
                }}
                className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md text-sm bg-white"
                defaultValue=""
              >
                <option value="" disabled>Pick a provider (or fill the fields below manually)…</option>
                {provider.presets.map((p) => <option key={p.baseUrl} value={p.baseUrl}>{p.name}</option>)}
              </select>
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium">API key <span className="text-red-600">*</span></span>
            <input
              type="password" required value={key} onChange={(e) => setKey(e.target.value)}
              placeholder={provider.id === "anthropic" ? "sk-ant-..." : provider.id === "google" ? "AIza..." : "sk-..."}
              className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent text-sm font-mono"
              autoComplete="off"
            />
          </label>

          {provider.id === "openai_compat" && (
            <label className="block">
              <span className="text-sm font-medium">Base URL <span className="text-red-600">*</span></span>
              <input
                type="url" required value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://openrouter.ai/api/v1"
                className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent text-sm"
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm font-medium">Default model{provider.id === "openai_compat" && <span className="text-red-600"> *</span>}</span>
            <input
              type="text" required={provider.id === "openai_compat"} value={model} onChange={(e) => setModel(e.target.value)}
              placeholder={provider.defaultModel || "anthropic/claude-sonnet-4-6"}
              className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent text-sm font-mono"
            />
            <span className="text-xs text-muted">{provider.defaultModel ? `Default: ${provider.defaultModel}` : ""}</span>
          </label>

          {err && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded">{err}</div>}

          <div className="flex gap-2">
            <button type="submit" disabled={busy || !key.trim()} className="bg-accent text-white text-sm px-4 py-2 rounded-md font-medium disabled:opacity-50">
              {busy ? "Saving…" : existing ? "Replace key" : "Save key"}
            </button>
            {existing && (
              <button type="button" onClick={() => { setShowForm(false); setKey(""); setErr(null); }} className="text-sm px-4 py-2 border border-black/10 rounded-md hover:bg-black/5">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </article>
  );
}
