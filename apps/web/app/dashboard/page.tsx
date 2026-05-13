"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearSession, currentUser, isAuthed } from "@/lib/auth";

const TEMPLATES = [
  { id: "html",            framework: "html",   label: "HTML — blank",       note: "Plain semantic HTML, zero JS", emoji: "📄" },
  { id: "astro",           framework: "astro",  label: "Astro — blank",      note: "Static-first, fast",            emoji: "🚀" },
  { id: "nextjs",          framework: "nextjs", label: "Next.js — blank",    note: "App Router, static export",     emoji: "▲" },
  { id: "php",             framework: "php",    label: "PHP — blank",        note: "Runs on any shared host",       emoji: "🐘" },
  { id: "html-lawyer",     framework: "html",   label: "Lawyer / Law Firm",  note: "LegalService schema, practice areas", emoji: "⚖️" },
  { id: "html-plumber",    framework: "html",   label: "Plumber / Trades",   note: "Plumber schema, 24/7 banner",   emoji: "🔧" },
  { id: "html-dentist",    framework: "html",   label: "Dentist / Clinic",   note: "Dentist schema, hours, pricing", emoji: "🦷" },
  { id: "html-restaurant", framework: "html",   label: "Restaurant / Bar",   note: "Restaurant schema, menu",       emoji: "🍝" },
];

const BACKENDS = [
  { id: "none", label: "None", note: "Static site only" },
  { id: "supabase", label: "Supabase", note: "Auth + Postgres + Storage" },
  { id: "postgres", label: "Postgres", note: "Direct, with generated client" },
  { id: "go", label: "Go API", note: "Generated chi/echo server" },
];

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("html");
  const [backend, setBackend] = useState("none");
  const framework = TEMPLATES.find((t) => t.id === templateId)?.framework || "html";
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthed()) {
      router.replace("/login");
      return;
    }
    api.listProjects().then(({ projects }) => { setProjects(projects); setLoading(false); }).catch((e) => { setErr(e.message); setLoading(false); });
  }, [router]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const { project } = await api.createProject(name, framework, backend, templateId);
      router.push(`/editor/${project.id}`);
    } catch (e: any) {
      setErr(e.message || "Failed to create project");
    }
  }

  function logout() {
    clearSession();
    router.push("/");
  }

  const user = currentUser();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-black/5 p-6 flex flex-col">
        <Link href="/" className="font-semibold text-lg mb-8">Seowebsitesbuilder</Link>
        <nav className="space-y-1 text-sm flex-1">
          <a className="block px-3 py-2 rounded-md bg-ink/5 font-medium">Projects</a>
          <a className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Templates</a>
          <Link href="/domains" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Domains</Link>
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

      {/* Main */}
      <main className="flex-1 p-10 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Your projects</h1>
          <button
            onClick={() => setCreating((v) => !v)}
            className="bg-ink text-white px-4 py-2 rounded-md font-medium hover:bg-black"
          >
            {creating ? "Cancel" : "New project"}
          </button>
        </div>

        {creating && (
          <form onSubmit={createProject} className="bg-white border border-black/5 rounded-2xl p-6 mb-8 space-y-6">
            <label className="block">
              <span className="text-sm font-medium">Project name</span>
              <input
                required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="My SEO site"
                className="mt-1 w-full max-w-md px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent"
              />
            </label>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Template</span>
                <Link href="/templates" target="_blank" className="text-xs text-accent hover:underline">Browse all →</Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {TEMPLATES.map((t) => (
                  <label key={t.id} className={`cursor-pointer border rounded-lg p-3 ${templateId === t.id ? "border-accent bg-accent/5" : "border-black/10"}`}>
                    <input type="radio" name="templateId" value={t.id} checked={templateId === t.id} onChange={() => setTemplateId(t.id)} className="sr-only" />
                    <div className="flex items-center gap-2 mb-0.5">
                      <span aria-hidden="true">{t.emoji}</span>
                      <span className="font-medium text-sm">{t.label}</span>
                    </div>
                    <div className="text-xs text-muted">{t.note}</div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="text-sm font-medium block mb-2">Backend</span>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {BACKENDS.map((b) => (
                  <label key={b.id} className={`cursor-pointer border rounded-lg p-3 ${backend === b.id ? "border-accent bg-accent/5" : "border-black/10"}`}>
                    <input type="radio" name="backend" value={b.id} checked={backend === b.id} onChange={() => setBackend(b.id)} className="sr-only" />
                    <div className="font-medium">{b.label}</div>
                    <div className="text-xs text-muted">{b.note}</div>
                  </label>
                ))}
              </div>
            </div>

            {err && <p className="text-sm text-red-600">{err}</p>}
            <button className="bg-accent text-white px-5 py-2 rounded-md font-medium">Create</button>
          </form>
        )}

        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="bg-white border border-black/5 rounded-2xl p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
            <p className="text-muted mb-6">Create your first SEO-perfect site in 30 seconds.</p>
            <button onClick={() => setCreating(true)} className="bg-ink text-white px-4 py-2 rounded-md font-medium">
              Create project
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link key={p.id} href={`/editor/${p.id}`} className="bg-white border border-black/5 rounded-xl p-5 hover:border-accent/30 hover:shadow-sm transition">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{p.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "running" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-muted mb-3">/{p.slug}</p>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-accent/10 text-accent rounded">{p.framework}</span>
                  {p.backend !== "none" && <span className="px-2 py-0.5 bg-black/5 rounded">{p.backend}</span>}
                </div>
                <div className="mt-4 text-xs text-muted">SEO score: <strong className="text-ink">{p.seo_score}</strong>/100</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
