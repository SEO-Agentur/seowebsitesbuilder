"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api, exportUrl, previewUrl } from "@/lib/api";
import { isAuthed, currentUser } from "@/lib/auth";
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

type RightPane = "preview" | "code" | "database" | "seo";

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
  const [rightPane, setRightPane] = useState<RightPane>("preview");
  const [chatCollapsed, setChatCollapsed] = useState<boolean>(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState<string>("");
  const [dragHover, setDragHover] = useState<boolean>(false);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
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
      // Chat is now the entire left pane; nothing to switch to.
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

  async function refreshFiles() {
    const { files: refreshed } = await api.listFiles(projectId);
    setFiles(refreshed);
  }

  async function createNewFile() {
    const name = window.prompt("New file path (e.g. styles/extra.css):", "untitled.html");
    if (!name) return;
    try {
      await api.writeFile(projectId, name, "");
      await refreshFiles();
      await openFile(name);
      setRightPane("code");
    } catch (e: any) {
      setErr(e?.message || "Could not create file");
    }
  }

  async function deleteFile(path: string) {
    if (!window.confirm(`Delete ${path}? This can't be undone.`)) return;
    try {
      await api.deleteFile(projectId, path);
      if (activePath === path) {
        setActivePath(null);
        setContent("");
      }
      await refreshFiles();
    } catch (e: any) {
      setErr(e?.message || "Could not delete file");
    }
  }

  function beginRename(path: string) {
    setRenamingPath(path);
    setRenameDraft(path);
  }

  async function commitRename() {
    if (!renamingPath) return;
    const from = renamingPath;
    const to = renameDraft.trim();
    setRenamingPath(null);
    if (!to || to === from) return;
    try {
      await api.renameFile(projectId, from, to);
      if (activePath === from) setActivePath(to);
      await refreshFiles();
    } catch (e: any) {
      setErr(e?.message || "Could not rename file");
    }
  }

  /** Drag-and-drop upload. Reads each File as binary, base64-encodes, sends to
   *  /file with base64:true. Text-detection is a best-effort fast path that
   *  preserves UTF-8 newlines for source files. */
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragHover(false);
    const items = Array.from(e.dataTransfer.files);
    if (items.length === 0) return;
    for (const file of items) {
      const arrayBuf = await file.arrayBuffer();
      const isText = /^(text\/|application\/(json|xml|javascript|x-typescript))/.test(file.type) ||
        /\.(html|css|js|ts|tsx|jsx|json|md|svg|astro|php|txt|yml|yaml|xml)$/i.test(file.name);
      try {
        if (isText) {
          const text = new TextDecoder("utf-8").decode(arrayBuf);
          await api.writeFile(projectId, file.name, text);
        } else {
          const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
          await api.uploadFile(projectId, file.name, b64);
        }
      } catch (err: any) {
        setErr(`Couldn't upload ${file.name}: ${err?.message || err}`);
      }
    }
    await refreshFiles();
  }

  if (busy === "loading" || !project) {
    return <div className="min-h-screen grid place-items-center text-muted">Loading…</div>;
  }

  const showDatabase = project.backend !== "none";

  return (
    <div className="h-screen flex flex-col bg-[#fafafa]">
      {/* TOP NAVIGATION (Slice B) */}
      <header className="h-12 bg-white border-b border-black/5 flex items-center px-3 gap-2 text-sm">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          <span className="inline-grid place-items-center w-7 h-7 rounded-md bg-ink text-white text-xs">S</span>
        </Link>
        {/* Scope switcher (placeholder until teams ship) */}
        <button
          className="px-2 py-1 rounded-md text-muted hover:bg-black/5 flex items-center gap-1"
          title="Workspace (personal — teams coming soon)"
        >
          Personal <span className="text-[10px]">▾</span>
        </button>
        <span className="text-black/20">/</span>
        {/* Project breadcrumb */}
        <Link href="/dashboard" className="px-2 py-1 rounded-md hover:bg-black/5 font-medium truncate max-w-[200px]" title={project.name}>
          {project.name}
        </Link>
        <span className="text-black/20">/</span>
        {/* Chat title (placeholder for now — Slice C wires per-chat naming) */}
        <span className="px-2 py-1 text-muted truncate max-w-[240px]">
          {project.framework}
          {project.backend !== "none" && ` · ${project.backend}`}
        </span>

        <span className={`text-xs px-2 py-0.5 rounded-full ${project.status === "running" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
          {project.status}
        </span>
        <span className="text-xs text-muted hidden sm:inline w-14 text-right">{busy === "saving" ? "Saving…" : "Saved"}</span>

        <div className="ml-auto flex items-center gap-1">
          <FileHistory
            projectId={projectId}
            activePath={activePath}
            onRestored={(c) => setContent(c)}
          />
          <button
            onClick={() => setShowTerminal((v) => !v)}
            className={`px-2 py-1 rounded-md text-xs ${showTerminal ? "bg-ink/5 text-ink" : "text-muted hover:bg-black/5"}`}
            title="Toggle terminal"
          >
            &gt;_
          </button>
          {project.status === "running" ? (
            <button onClick={stop} className="px-2 py-1 rounded-md text-xs text-muted hover:bg-black/5" title="Stop preview container">Stop</button>
          ) : (
            <button onClick={start} disabled={busy === "starting"} className="px-3 py-1 rounded-md text-xs bg-accent text-white disabled:opacity-50">
              {busy === "starting" ? "Starting…" : "Start"}
            </button>
          )}

          <button className="px-2 py-1 rounded-md text-xs text-muted hover:bg-black/5" title="Project settings" disabled>Settings</button>
          <button className="px-2 py-1 rounded-md text-xs text-muted hover:bg-black/5" title="Share project (coming soon)" disabled>Share</button>

          {/* Publish (free plan can publish to *.seosites.app) */}
          <button onClick={() => setShowPublish(true)} className="px-3 py-1 rounded-md text-xs bg-accent text-white" title="Publish to *.seosites.app">
            Publish
          </button>

          {/* Export icon group — single button with dropdown chevron.
              Greyed-out + → /billing when the plan can't export. */}
          {canExport ? (
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen((v) => !v)}
                className="px-2 py-1 rounded-md text-xs border border-black/10 hover:bg-black/5 flex items-center gap-1"
                title="Export / Deploy"
              >
                <span aria-hidden="true">⤴</span> Export <span className="text-[10px]">▾</span>
              </button>
              {exportMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 bg-white border border-black/10 rounded-md shadow-lg py-1 z-30"
                  onMouseLeave={() => setExportMenuOpen(false)}
                >
                  <button onClick={() => { setExportMenuOpen(false); setShowDeploy(true); }} className="block w-full text-left px-3 py-2 hover:bg-black/5 text-xs">Deploy (Vercel/Netlify/CF)</button>
                  <button onClick={() => { setExportMenuOpen(false); setShowGithubExport(true); }} className="block w-full text-left px-3 py-2 hover:bg-black/5 text-xs">Push to GitHub</button>
                  <a href={exportUrl(projectId)} onClick={() => setExportMenuOpen(false)} className="block px-3 py-2 hover:bg-black/5 text-xs">Download .zip</a>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/billing?from=export"
              title="Export / Deploy / GitHub push are on Solo, Pro, and Agency plans. Click to upgrade."
              className="px-2 py-1 rounded-md text-xs border border-black/10 flex items-center gap-1 text-muted opacity-60 hover:opacity-100 hover:border-accent hover:text-accent"
            >
              <span aria-hidden="true">🔒</span> Export
            </Link>
          )}

          {/* Avatar placeholder */}
          <Link href="/dashboard" className="ml-1 w-7 h-7 rounded-full bg-accent/20 text-accent text-xs grid place-items-center font-semibold" title="Account">
            {((currentUser()?.email) || "?").slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </header>

      {err && <div className="bg-red-50 text-red-700 text-sm px-4 py-2">{err}</div>}

      <div className="flex-1 flex min-h-0">
        {/* LEFT — CHAT PANEL (collapsible) */}
        {!chatCollapsed && (
          <aside className="w-[420px] flex-shrink-0 bg-white border-r border-black/5 min-h-0 flex">
            <div className="flex-1 min-w-0">
              <ChatPanel
                projectId={projectId}
                framework={project.framework}
                backend={project.backend}
                files={files}
                readFile={async (p) => (await api.readFile(projectId, p)).content}
                applyEdit={applyEdit}
                initialDraft={pendingPrompt ?? undefined}
              />
            </div>
          </aside>
        )}

        {/* RIGHT — TABBED PANE (Preview / Code / Database / SEO) */}
        <section className="flex-1 min-w-0 flex flex-col bg-white">
          {/* Tab bar */}
          <div className="h-10 border-b border-black/5 flex items-center px-2 gap-1">
            <button
              onClick={() => setChatCollapsed((v) => !v)}
              aria-label="Toggle chat panel"
              title={chatCollapsed ? "Show chat" : "Hide chat"}
              className="px-2 py-1 text-xs text-muted hover:bg-black/5 rounded-md"
            >
              {chatCollapsed ? "»" : "«"}
            </button>
            <div className="w-px h-5 bg-black/10 mx-1" />
            <button
              onClick={() => setRightPane("preview")}
              title="Preview"
              className={`px-2 py-1 rounded-md text-sm ${rightPane === "preview" ? "bg-ink/5 text-ink" : "text-muted hover:bg-black/5"}`}
            >
              👁
            </button>
            <button
              onClick={() => setRightPane("code")}
              title="Code"
              className={`px-2 py-1 rounded-md text-sm font-mono ${rightPane === "code" ? "bg-ink/5 text-ink" : "text-muted hover:bg-black/5"}`}
            >
              &lt;/&gt;
            </button>
            {showDatabase && (
              <button
                onClick={() => setRightPane("database")}
                title="Database"
                className={`px-2 py-1 rounded-md text-sm ${rightPane === "database" ? "bg-ink/5 text-ink" : "text-muted hover:bg-black/5"}`}
              >
                🗄
              </button>
            )}
            <button
              onClick={() => setRightPane("seo")}
              title="SEO score"
              className={`px-2 py-1 rounded-md text-sm ${rightPane === "seo" ? "bg-ink/5 text-ink" : "text-muted hover:bg-black/5"}`}
            >
              📊
            </button>

            {/* Per-tab right-aligned controls */}
            {rightPane === "preview" && (
              <div className="ml-2 flex items-center gap-1 flex-1">
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
                    title="Mobile viewport"
                    className={`px-2 py-1 text-xs border-l border-black/10 ${viewport === "mobile" ? "bg-ink/5 text-ink" : "text-muted hover:bg-black/5"}`}
                  >
                    📱
                  </button>
                </div>
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
                <button
                  onClick={() => setRefreshNonce((n) => n + 1)}
                  aria-label="Reload preview"
                  title="Reload preview"
                  className="px-2 py-1 text-xs text-muted hover:bg-black/5 rounded-md"
                  disabled={project.status !== "running"}
                >
                  ↺
                </button>
                {project.status === "running" && (
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
                )}
              </div>
            )}
            {rightPane === "code" && (
              <div className="ml-2 flex items-center gap-1 flex-1 text-xs text-muted">
                {activePath ? (
                  <span className="font-mono truncate" title={activePath}>{activePath}</span>
                ) : (
                  <span>No file open</span>
                )}
                <button onClick={createNewFile} className="ml-auto px-2 py-1 hover:bg-black/5 rounded-md" title="New file">+ New</button>
              </div>
            )}
          </div>

          {/* Tab body */}
          <div className="flex-1 min-h-0 flex flex-col">
            {rightPane === "preview" && (
              project.status === "running" ? (
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
              )
            )}

            {rightPane === "code" && (
              <div className="flex-1 min-h-0 flex">
                {/* File tree */}
                <div
                  onDragEnter={(e) => { e.preventDefault(); setDragHover(true); }}
                  onDragOver={(e) => { e.preventDefault(); setDragHover(true); }}
                  onDragLeave={() => setDragHover(false)}
                  onDrop={handleDrop}
                  className={`w-56 border-r border-black/5 overflow-y-auto ${dragHover ? "bg-accent/5 ring-2 ring-accent ring-inset" : ""}`}
                >
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted flex items-center">
                    Files
                    <button onClick={createNewFile} className="ml-auto text-muted hover:text-ink" title="New file">+</button>
                  </div>
                  {dragHover && (
                    <div className="px-3 pb-2 text-xs text-accent">Drop to upload</div>
                  )}
                  <ul className="text-sm pb-4">
                    {files.map((f) => (
                      <li key={f} className="group flex items-center pr-2">
                        {renamingPath === f ? (
                          <form
                            onSubmit={(e) => { e.preventDefault(); commitRename(); }}
                            className="w-full px-3 py-1"
                          >
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => { if (e.key === "Escape") setRenamingPath(null); }}
                              className="w-full text-xs font-mono px-1 py-0.5 border border-accent rounded outline-none bg-white"
                            />
                          </form>
                        ) : (
                          <>
                            <button
                              onClick={() => openFile(f)}
                              onDoubleClick={() => beginRename(f)}
                              className={`flex-1 text-left px-3 py-1 hover:bg-black/5 truncate ${activePath === f ? "bg-accent/10 text-accent" : ""}`}
                              title={`${f} — double-click to rename`}
                            >
                              {f}
                            </button>
                            <button
                              onClick={() => deleteFile(f)}
                              className="hidden group-hover:block text-xs text-muted hover:text-red-600 px-1"
                              title={`Delete ${f}`}
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Monaco */}
                <div className="flex-1 min-w-0 flex flex-col">
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
                      <div className="grid place-items-center h-full text-muted text-sm">Select a file to edit, or drag-and-drop one in</div>
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
                </div>
              </div>
            )}

            {rightPane === "database" && showDatabase && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ModelsPanel projectId={projectId} backend={project.backend} />
              </div>
            )}

            {rightPane === "seo" && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                {scoringHtml
                  ? <SeoPanel html={scoringHtml} projectId={projectId} />
                  : <div className="p-4 text-sm text-muted">Open an HTML/Astro/PHP file or start the preview to score.</div>}
              </div>
            )}
          </div>
        </section>
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
