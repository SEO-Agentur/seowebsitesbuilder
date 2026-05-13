"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthed, clearSession, currentUser } from "@/lib/auth";

interface Cfg {
  provider: string; model: string;
  maxInputTokens: number; maxOutputTokens: number;
  dailyUsdCap: number; maxPerUser: number; enabled: boolean;
}

interface Usage {
  today: { promptCount: number; uniqueUsers: number; spendUsd: number; capUsd: number; capRemainingUsd: number };
  sevenDays: { day: string; promptCount: number; spendUsd: number }[];
  topUsers: { userId: string; email: string; calls: number; spendUsd: number }[];
}

export default function TrialAIAdmin() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [draft, setDraft] = useState<Cfg | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [keyConfigured, setKeyConfigured] = useState<boolean>(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!isAuthed()) { router.replace("/login"); return; }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    try {
      const [c, u] = await Promise.all([api.adminTrialConfig(), api.adminTrialUsage()]);
      setCfg(c.config); setDraft(c.config); setModels(c.supportedModels); setKeyConfigured(c.keyConfigured);
      setUsage(u);
    } catch (e: any) {
      if (/403/.test(e.message)) setForbidden(true);
      else setErr(e.message);
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true); setErr(null); setInfo(null);
    try {
      const r = await api.adminUpdateTrialConfig(draft);
      setCfg(r.config); setInfo("Saved.");
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  function logout() { clearSession(); router.push("/"); }
  const user = currentUser();

  if (forbidden) {
    return (
      <main className="min-h-screen grid place-items-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold mb-2">Admin access required</h1>
          <p className="text-sm text-muted mb-6">Your account isn&apos;t an admin.</p>
          <Link href="/dashboard" className="bg-ink text-white px-4 py-2 rounded-md text-sm font-medium">Back to dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r border-black/5 p-6 flex flex-col">
        <Link href="/" className="font-semibold text-lg mb-8">Seowebsitesbuilder</Link>
        <nav className="space-y-1 text-sm flex-1">
          <Link href="/dashboard" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Projects</Link>
          <Link href="/domains" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Domains</Link>
          <Link href="/billing" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Billing</Link>
          <Link href="/settings" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">AI keys</Link>
          <div className="pt-2 mt-2 border-t border-black/5">
            <Link href="/admin" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Admin</Link>
            <a className="block px-3 py-2 rounded-md bg-ink/5 font-medium ml-3">Trial AI pool</a>
          </div>
        </nav>
        <div className="text-sm">
          <p className="text-muted mb-2">{user?.email}</p>
          <button onClick={logout} className="text-muted hover:text-ink">Log out</button>
        </div>
      </aside>

      <main className="flex-1 p-10 max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Trial AI pool</h1>
        <p className="text-muted mb-8">Configures the &ldquo;free prompts on our key&rdquo; experience for users who haven&apos;t added their own AI key yet. Changes take effect on the next request — no restart needed.</p>

        {!keyConfigured && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-md mb-6">
            <strong>TRIAL_ANTHROPIC_API_KEY is not set on the orchestrator.</strong> Trial requests will fail with &ldquo;Trial pool not configured&rdquo; until it&apos;s added to <code className="bg-white/50 px-1 rounded">/opt/seowebsitesbuilder/.env</code> and pm2 is reloaded.
          </div>
        )}

        {err && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded mb-4">{err}</div>}
        {info && <div className="bg-green-50 text-green-800 text-sm px-4 py-2 rounded mb-4">{info}</div>}

        {/* Today's usage */}
        {usage && (
          <section className="bg-white border border-black/5 rounded-2xl p-6 mb-8">
            <h2 className="text-xs uppercase tracking-wider text-muted mb-4 font-medium">Today (rolling 24h)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div>
                <div className="text-2xl font-semibold">${usage.today.spendUsd.toFixed(2)}</div>
                <div className="text-xs text-muted">spent of ${usage.today.capUsd.toFixed(2)} cap</div>
                <div className="h-1.5 bg-black/5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${Math.min(100, (usage.today.spendUsd / Math.max(0.01, usage.today.capUsd)) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{usage.today.promptCount}</div>
                <div className="text-xs text-muted">prompts</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{usage.today.uniqueUsers}</div>
                <div className="text-xs text-muted">unique users</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">${usage.today.capRemainingUsd.toFixed(2)}</div>
                <div className="text-xs text-muted">cap remaining</div>
              </div>
            </div>
          </section>
        )}

        {/* Config form */}
        {draft && (
          <section className="bg-white border border-black/5 rounded-2xl p-6 mb-8">
            <h2 className="font-semibold tracking-tight mb-4">Configuration</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium">Enabled</span>
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium ${draft.enabled ? "bg-green-100 text-green-800" : "bg-black/5 text-muted"}`}
                  >
                    {draft.enabled ? "Trial pool: ON" : "Trial pool: OFF"}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Model</span>
                <select
                  value={draft.model}
                  onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md text-sm bg-white"
                >
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Max input tokens</span>
                <input
                  type="number" min={100} max={200000}
                  value={draft.maxInputTokens}
                  onChange={(e) => setDraft({ ...draft, maxInputTokens: parseInt(e.target.value || "0", 10) || 0 })}
                  className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Max output tokens</span>
                <input
                  type="number" min={100} max={64000}
                  value={draft.maxOutputTokens}
                  onChange={(e) => setDraft({ ...draft, maxOutputTokens: parseInt(e.target.value || "0", 10) || 0 })}
                  className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Daily $ cap</span>
                <input
                  type="number" step="0.01" min={0} max={10000}
                  value={draft.dailyUsdCap}
                  onChange={(e) => setDraft({ ...draft, dailyUsdCap: parseFloat(e.target.value || "0") || 0 })}
                  className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md text-sm"
                />
                <span className="text-xs text-muted">When 24-hour spend exceeds this, the trial dries up; users fall back to &quot;add your own key.&quot;</span>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Max prompts per user (lifetime)</span>
                <input
                  type="number" min={0} max={1000}
                  value={draft.maxPerUser}
                  onChange={(e) => setDraft({ ...draft, maxPerUser: parseInt(e.target.value || "0", 10) || 0 })}
                  className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md text-sm"
                />
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={save}
                disabled={saving}
                className="bg-ink text-white text-sm px-5 py-2 rounded-md font-medium disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setDraft(cfg); setInfo(null); setErr(null); }}
                className="text-sm px-4 py-2 border border-black/10 rounded-md hover:bg-black/5"
              >
                Reset
              </button>
            </div>
          </section>
        )}

        {/* Top users today */}
        {usage && usage.topUsers.length > 0 && (
          <section className="bg-white border border-black/5 rounded-2xl overflow-hidden mb-8">
            <header className="px-6 py-4 border-b border-black/5">
              <h2 className="font-semibold tracking-tight">Top users (last 24h)</h2>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-black/[0.02] text-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left font-medium px-6 py-3">Email</th>
                  <th className="text-right font-medium px-2 py-3">Calls</th>
                  <th className="text-right font-medium px-6 py-3">Spend</th>
                </tr>
              </thead>
              <tbody>
                {usage.topUsers.map((u) => (
                  <tr key={u.userId} className="border-t border-black/5">
                    <td className="px-6 py-3 font-mono text-xs">{u.email}</td>
                    <td className="px-2 py-3 text-right">{u.calls}</td>
                    <td className="px-6 py-3 text-right">${u.spendUsd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Last 7 days */}
        {usage && usage.sevenDays.length > 0 && (
          <section className="bg-white border border-black/5 rounded-2xl overflow-hidden">
            <header className="px-6 py-4 border-b border-black/5">
              <h2 className="font-semibold tracking-tight">Last 7 days</h2>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-black/[0.02] text-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left font-medium px-6 py-3">Day</th>
                  <th className="text-right font-medium px-2 py-3">Calls</th>
                  <th className="text-right font-medium px-6 py-3">Spend</th>
                </tr>
              </thead>
              <tbody>
                {usage.sevenDays.map((d) => (
                  <tr key={d.day} className="border-t border-black/5">
                    <td className="px-6 py-3 font-mono text-xs">{d.day}</td>
                    <td className="px-2 py-3 text-right">{d.promptCount}</td>
                    <td className="px-6 py-3 text-right">${d.spendUsd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
