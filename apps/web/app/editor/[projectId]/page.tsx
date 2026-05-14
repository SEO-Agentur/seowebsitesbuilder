"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api, exportUrl, previewUrl } from "@/lib/api";
import { isAuthed } from "@/lib/auth";
import { SeoPanel } from "@/components/seo-panel";
import { ChatPanel } from "@/components/chat-panel";
import { Terminal } from "@/components/terminal";
import { DeployModal } from "@/components/deploy-modal";
import { GithubExportModal } from "@/components/github-export-modal";
import { PublishModal } from "@/components/publish-modal";
import { ModelsPanel } from "@/components/models-panel";
import { FileHistory } from "@/components/file-history";

const Monaco = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false });

const MAIN_FILE: Record<string, string> = {
  html: "index.html",
  astro: "src/pages/index.astro",
  nextjs: "app/page.tsx",
  php: "index.php",
};

type RightTab = "seo" | "chat" | "models";

export default function EditorPage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<any>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [busy, setBusy] = useState<"loading" | "starting" | "saving" | "idle">("loading");
  const [err, setErr] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("seo");
  const [showTerminal, setShowTerminal] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showGithubExport, setShowGithubExport] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [previewTok, setPreviewTok] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [canExport, setCanExport] = useState<boolean>(true);  // optimistic until /billing/me resolves
  // Preview-pane controls (Slice A toolbar polish)
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewPath, setPreviewPath] = useState<string>("/");
  const [previewPathDraft, setPreviewPathDraft] = useState<string>("/");
  const [refreshNonce, setRefreshNonce] = useState<number>(0);
  const saveTimer = useRef<any>(null);

  /** Compose a preview URL that puts the user-typed path BEFORE the auth
   *  query-string. previewUrl() returns either `${base}/` or `${base}/?_t=tok`. */
  function previewUrlWithPath(path: string): string {
    const base = previewUrl(projectId, previewTok ?? undefined);
    const [origin, query = ""] = base.split("?");
    const cleanPath = path.replace(/^\/+/, "");
    const stem = origin.endsWith("/") ? origin.slice(0, -1) : origin;
    return `${stem}/${cleanPath}${query ? `?${query}` : ""}`;
  }

  useEffect(() => {
    if (!isAuthed()) return;
    api.billingMe().then((r) => setCanExport(r.limits.canExport)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isAuthed()) { router.replace("/login"); return; }
    // Picked up from the landing-page hero or onboarding. One-shot: read,
    // hand off to ChatPanel via state, then drop from localStorage.
    const key = `seo_pending_prompt_${projectId}`;
    const draft = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (draft) {
      setPendingPrompt(draft);
      setRightTab("chat");           // auto-open the AI tab so the user sees their prompt
      localStorage.removeItem(key);
    }
    (async () => {
      try {
        const { project } = await api.getProject(projectId);
        setProject(project);
        const { files } = await api.listFiles(projectId);
        setFiles(files);
        const initial = MAIN_FILE[project.framework] || files[0];
        if (initial && files.includes(initial)) {
          await openFile(initial);
        }
        setBusy("idle");
      } catch (e: any) { setErr(e.message); setBusy("idle"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch a fresh preview token whenever the container goes live. Tokens last 1h.
  useEffect(() => {
    if (project?.status !== "running") { setPreviewTok(null); return; }
    let alive = true;
    api.previewToken(projectId)
      .then((r) => { if (alive) setPreviewTok(r.token); })
      .catch(() => { /* show normal preview-not-running state */ });
    return () => { alive = false; };
  }, [projectId, project?.status]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (project?.status !== "running" || !previewTok) return;
      try {
        const r = await fetch(previewUrl(projectId, previewTok));
        const txt = await r.text();
        if (alive) setPreviewHtml(txt);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [projectId, project?.status, previewTok]);

  const scoringHtml = previewHtml || (
    activePath?.endsWith(".html") || activePath?.endsWith(".astro") || activePath?.endsWith(".php")
      ? content
      : ""
  );

  async function openFile(path: string) {
    setActivePath(path);
    const { content } = await api.readFile(projectId, path);
    setContent(content);
  }

  function onChange(v: string | undefined) {
    const next = v || "";
    setContent(next);
    if (!activePath) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setBusy("saving");
      try { await api.writeFile(projectId, activePath, next); } finally { setBusy("idle"); }
    }, 600);
  }

  async function start() {
    setBusy("starting");
    try {
      await api.startProject(projectId);
      const { project } = await api.getProject(projectId);
      setProject(project);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy("idle"); }
  }

  async function stop() {
    await api.stopProject(projectId);
    const { project } = await api.getProject(projectId);
    setProject(project);
  }

  async function applyEdit(path: string, newContent: string) {
    await api.writeFile(projectId, path, newContent);
    const { files: refreshed } = await api.listFiles(projectId);
    setFiles(refreshed);
    if (activePath === path) setContent(newContent);
  }

  if (busy === "loading" || !project) {
    return <div className="min-h-screen grid place-items-center text-muted">Loading…</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-[#fafafa]">
      <header className="h-14 bg-white border-b border-black/5 flex items-center px-4 gap-3">
        <Link href="/dashboard" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
        <div className="font-semibold tracking-tight">{project.name}</div>
        <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded">{project.framework}</span>
        {project.backend !== "none" && <span className="text-xs px-2 py-0.5 bg-black/5 rounded">{project.backend}</span>}
        <span className={`text-xs px-2 py-0.5 rounded-full ${project.status === "running" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
          {project.status}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted w-14 text-right">{busy === "saving" ? "Saving…" : "Saved"}</span>
          <FileHistory
            projectId={projectId}
            activePath={activePath}
            onRestored={(c) => setContent(c)}
          />
          <button
            onClick={() => setShowTerminal((v) => !v)}
            className={`text-sm px-3 py-1.5 border rounded-md ${showTerminal ? "border-accent text-accent bg-accent/5" : "border-black/10 hover:bg-black/5"}`}
          >
            Terminal
          </button>
          {project.status === "running" ? (
            <button onClick={stop} className="text-sm px-3 py-1.5 border border-black/10 rounded-md hover:bg-black/5">Stop</button>
          ) : (
            <button onClick={start} disabled={busy === "starting"} className="text-sm px-3 py-1.5 bg-accent text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {busy === "starting" ? "Starting…" : "Start preview"}
            </button>
          )}
          <button onClick={() => setShowPublish(true)} className="text-sm px-3 py-1.5 bg-accent text-white rounded-md hover:bg-blue-700">
            Publish
          </button>
          {canExport ? (
            <>
              <button onClick={() => setShowDeploy(true)} className="text-sm px-3 py-1.5 border border-black/10 rounded-md hover:bg-black/5">
                Deploy
              </button>
              <button onClick={() => setShowGithubExport(true)} className="text-sm px-3 py-1.5 border border-black/10 rounded-md hover:bg-black/5">
                GitHub
              </button>
              <a href={exportUrl(projectId)} className="text-sm px-3 py-1.5 bg-ink text-white rounded-md hover:bg-black">Export .zip</a>
            </>
          ) : (
            <Link
              href="/billing?from=export"
              title="Exporting, deploying, and Git push are on Solo and higher. Free plan stays on *.seosites.app."
              className="text-sm px-3 py-1.5 border border-accent text-accent rounded-md hover:bg-accent/5 flex items-center gap-1.5"
            >
              <span aria-hidden="true">🔒</span>
              Upgrade to export
            </Link>
          )}
        </div>
      </header>

      {err && <div className="bg-red-50 text-red-700 text-sm px-4 py-2">{err}</div>}

      <div className="flex-1 flex min-h-0">
        <aside className="w-52 bg-white border-r border-black/5 overflow-y-auto">
          <div className="px-3 py-2 text-xs uppercase tracking-wider text-muted">Files</div>
          <ul className="text-sm pb-4">
            {files.map((f) => (
              <li key={f}>
                <button
                  onClick={() => openFile(f)}
                  className={`w-full text-left px-3 py-1 hover:bg-black/5 truncate ${activePath === f ? "bg-accent/10 text-accent" : ""}`}
                >
                  {f}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex-1 min-w-0 border-r border-black/5 flex flex-col">
          <div className="flex-1 min-h-0">
            {activePath ? (
              <Monaco
                height="100%"
                path={activePath}
                value={content}
                onChange={onChange}
                theme="light"
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                }}
              />
            ) : (
              <div className="grid place-items-center h-full text-muted text-sm">Select a file to edit</div>
            )}
          </div>
          {showTerminal && (
            <div className="h-64 border-t border-black/10 flex flex-col">
              <div className="h-7 flex items-center px-3 bg-[#111] text-gray-300 text-xs">
                <span>Terminal</span>
                <button onClick={() => setShowTerminal(false)} className="ml-auto hover:text-white">close</button>
              </div>
              <div className="flex-1 min-h-0">
                <Terminal projectId={projectId} containerRunning={project.status === "running"} />
              </div>
            </div>
          )}
        </section>

        <section className="flex-1 min-w-0 flex flex-col border-r border-black/5">
          {/* Preview toolbar — Slice A */}
          <div className="h-10 flex items-center px-2 border-b border-black/5 gap-1 bg-white">
            {/* Viewport toggle */}
            <div className="flex items-center border border-black/10 rounded-md overflow-hidden">
              <button
                onClick={() => setViewport("desktop")}
                aria-label="Desktop viewport"
                title="Desktop viewport"
                className={`px-2 py-1 text-xs ${viewport === "desktop" ? "bg-ink/5 text-ink" : "text-muted hover:bg-black/5"}`}
              >
                💻
              </button>
              <button
                onClick={() => setViewport("mobile")}
                aria-label="Mobile viewport"
                title="Mobile viewport (375 × auto)"
                className={`px-2 py-1 text-xs border-l border-black/10 ${viewport === "mobile" ? "bg-ink/5 text-ink" : "text-muted hover:bg-black/5"}`}
              >
                📱
              </button>
            </div>

            {/* Path input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const next = previewPathDraft.startsWith("/") ? previewPathDraft : `/${previewPathDraft}`;
                setPreviewPath(next);
                setRefreshNonce((n) => n + 1);
              }}
              className="flex-1 mx-1"
            >
              <input
                value={previewPathDraft}
                onChange={(e) => setPreviewPathDraft(e.target.value)}
                onBlur={() => {
                  const next = previewPathDraft.startsWith("/") ? previewPathDraft : `/${previewPathDraft}`;
                  setPreviewPath(next);
                  setRefreshNonce((n) => n + 1);
                }}
                placeholder="/"
                spellCheck={false}
                aria-label="Preview path"
                className="w-full text-xs font-mono px-2 py-1 border border-black/10 rounded-md outline-none focus:border-accent bg-white"
              />
            </form>

            {/* Refresh */}
            <button
              onClick={() => setRefreshNonce((n) => n + 1)}
              aria-label="Reload preview"
              title="Reload preview"
              className="px-2 py-1 text-xs text-muted hover:bg-black/5 rounded-md"
              disabled={project.status !== "running"}
            >
              ↺
            </button>

            {/* External link */}
            {project.status === "running" ? (
              <a
                href={previewUrlWithPath(previewPath)}
                target="_blank"
                rel="noreferrer"
                aria-label="Open preview in new tab"
                title="Open preview in new tab"
                className="px-2 py-1 text-xs text-muted hover:bg-black/5 rounded-md"
              >
                ↗
              </a>
            ) : (
              <span className="text-xs text-muted px-2">Not running</span>
            )}
          </div>

          {project.status === "running" ? (
            <div className={`flex-1 min-h-0 ${viewport === "mobile" ? "flex justify-center bg-gray-100 p-3 overflow-auto" : ""}`}>
              <iframe
                key={refreshNonce}
                src={previewUrlWithPath(previewPath)}
                className={
                  viewport === "mobile"
                    ? "bg-white rounded-2xl shadow-md w-[375px] h-[667px] flex-shrink-0"
                    : "flex-1 bg-white w-full h-full"
                }
                title="Live preview"
              />
            </div>
          ) : (
            <div className="flex-1 grid place-items-center bg-gray-50">
              <div className="text-center">
                <p className="text-muted mb-3">Container is stopped</p>
                <button onClick={start} className="bg-accent text-white px-4 py-2 rounded-md font-medium">Start preview</button>
              </div>
            </div>
          )}
        </section>

        <aside className="w-80 bg-white border-l border-black/5 flex flex-col min-h-0">
          <div className="flex border-b border-black/5">
            <button onClick={() => setRightTab("seo")} className={`flex-1 text-xs uppercase tracking-wider py-2.5 ${rightTab === "seo" ? "border-b-2 border-accent text-ink font-medium" : "text-muted hover:text-ink"}`}>SEO</button>
            <button onClick={() => setRightTab("chat")} className={`flex-1 text-xs uppercase tracking-wider py-2.5 ${rightTab === "chat" ? "border-b-2 border-accent text-ink font-medium" : "text-muted hover:text-ink"}`}>AI</button>
            {project.backend !== "none" && (
              <button onClick={() => setRightTab("models")} className={`flex-1 text-xs uppercase tracking-wider py-2.5 ${rightTab === "models" ? "border-b-2 border-accent text-ink font-medium" : "text-muted hover:text-ink"}`}>Data</button>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightTab === "seo" && (
              <div className="h-full overflow-y-auto">
                {scoringHtml
                  ? <SeoPanel html={scoringHtml} projectId={projectId} />
                  : <div className="p-4 text-sm text-muted">Open an HTML/Astro/PHP file or start the preview to score.</div>}
              </div>
            )}
            {rightTab === "chat" && (
              <ChatPanel
                projectId={projectId}
                framework={project.framework}
                backend={project.backend}
                files={files}
                readFile={async (p) => (await api.readFile(projectId, p)).content}
                applyEdit={applyEdit}
                initialDraft={pendingPrompt ?? undefined}
              />
            )}
            {rightTab === "models" && (
              <ModelsPanel projectId={projectId} backend={project.backend} />
            )}
          </div>
        </aside>
      </div>

      {showDeploy && (
        <DeployModal
          projectId={projectId}
          framework={project.framework}
          onClose={() => setShowDeploy(false)}
        />
      )}

      {showGithubExport && (
        <GithubExportModal
          projectId={projectId}
          defaultRepoName={project.slug || "my-seo-site"}
          onClose={() => setShowGithubExport(false)}
        />
      )}

      {showPublish && (
        <PublishModal
          projectId={projectId}
          framework={project.framework}
          projectSlug={project.slug || "my-site"}
          onClose={() => setShowPublish(false)}
        />
      )}
    </div>
  );
}
