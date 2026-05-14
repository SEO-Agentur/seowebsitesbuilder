"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, type ChatMeta } from "@/lib/api";
import { applyUnifiedDiff } from "@/lib/diff";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ReplaceEdit { kind: "replace"; path: string; content: string }
interface PatchEdit   { kind: "patch";   path: string; patch: string }
type FileEdit = ReplaceEdit | PatchEdit;

interface Props {
  projectId: string;
  framework: string;
  backend: string;
  /** All files in the project — passed in as context to the model. */
  files: string[];
  /** Read a file's current content (so the model can see real source). */
  readFile: (path: string) => Promise<string>;
  /** Apply a file edit (chat-to-build). Returns when both server + container have it. */
  applyEdit: (path: string, content: string) => Promise<void>;
  onChange?: () => void;
  /** Pre-fill the textarea with this (from the landing-page hero prompt). */
  initialDraft?: string;
}

const FENCE_RE = /```([\w.+-]*)\s*(?:path=)?["']?([^\n"']+?)["']?\n([\s\S]*?)```/g;

function systemPrompt(framework: string, backend: string, files: string[]): string {
  return `You are the build assistant for Seowebsitesbuilder — a no-code platform that produces SEO-perfect websites. Every page you create or edit MUST score 100/100 on our 12-check SEO engine. This is the product's whole promise.

Project: ${framework} framework, ${backend} backend.
File tree (${files.length} files):
${files.slice(0, 80).map((f) => "  " + f).join("\n")}${files.length > 80 ? `\n  ...and ${files.length - 80} more` : ""}

═══════════════════════════════════════════════════════════════════════════════
NON-NEGOTIABLE SEO REQUIREMENTS (apply to every HTML page you produce)
═══════════════════════════════════════════════════════════════════════════════

Every standalone HTML page (or framework <head> equivalent) MUST include:

1. <title> — 30-60 chars, primary keyword near the start, natural phrasing
2. <meta name="description"> — 120-160 chars, action-oriented, includes the keyword
3. <meta name="viewport" content="width=device-width, initial-scale=1">
4. <link rel="canonical" href="..."> — absolute URL of this page
5. <html lang="..."> — correct ISO 639-1 language code
6. Open Graph tags: og:title, og:description, og:type, og:url, og:image (≥4 of 5)
7. Twitter Card tags: twitter:card="summary_large_image", twitter:title, twitter:description
8. schema.org JSON-LD <script type="application/ld+json"> — pick the most-specific @type:
   - Marketing pages → Organization or WebSite
   - Article/blog → Article or BlogPosting
   - Product → Product (with offers, aggregateRating if real)
   - Local business → LocalBusiness or its subtype (LegalService, Plumber, Dentist, Restaurant, etc.)
   - FAQ section → FAQPage
   - Breadcrumbs → BreadcrumbList
9. Exactly ONE <h1>, semantic heading hierarchy (h1 → h2 → h3, never skip levels)
10. Every <img> has descriptive alt= (decorative images: alt="")
11. ≤1 render-blocking external <script> in <head> (use async/defer/type=module otherwise)
12. Page weight ≤ 200 KB transferred (compress images, no jumbo libraries)

When you generate copy: write for humans, optimise for crawlers. Don't keyword-stuff.

═══════════════════════════════════════════════════════════════════════════════
HOW TO EMIT FILE EDITS
═══════════════════════════════════════════════════════════════════════════════

You have TWO formats. Prefer FORMAT 2 (patches) for small changes — saves tokens, lower error surface. Use FORMAT 1 for new files or full rewrites.

FORMAT 1 — full file (always full contents, no placeholders, no "// ..." truncation):
\`\`\`html path="index.html"
<!doctype html>...
\`\`\`

FORMAT 2 — unified diff against the file's current contents:
\`\`\`diff path="index.html"
@@ -10,3 +10,5 @@
 <h1>Build a site that ranks</h1>
-<p class="lead">Old tagline.</p>
+<p class="lead">New tagline.</p>
+<p class="cta">Start free</p>
 <h2>How it works</h2>
\`\`\`
Rules for diffs: hunk headers use real source line numbers; context lines start with a single space and must match the source exactly; removed lines start with "-"; added lines start with "+". Never wrap multiple files in one diff block.

After your code blocks, briefly explain what you changed in plain English. Never invent imports or libraries that aren't already in the project. Edit existing files in place wherever possible.`;
}

function extractEdits(text: string): FileEdit[] {
  const out: FileEdit[] = [];
  let m: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;
  while ((m = FENCE_RE.exec(text))) {
    const lang = (m[1] || "").trim().toLowerCase();
    const path = m[2].trim();
    if (!path || path.includes(" ") || path.length > 300) continue;
    const body = m[3].replace(/\s+$/, "") + "\n";
    if (lang === "diff" || body.trimStart().startsWith("@@ ")) {
      out.push({ kind: "patch", path, patch: body });
    } else {
      out.push({ kind: "replace", path, content: body });
    }
  }
  return out;
}

interface ProviderKey {
  provider: string;
  defaultModel: string;
  masked: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  google: "Gemini",
  openai_compat: "Custom",
};

export function ChatPanel({ projectId, framework, backend, files, readFile, applyEdit, onChange, initialDraft }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialDraft || "");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEdits, setPendingEdits] = useState<FileEdit[]>([]);
  const [applying, setApplying] = useState(false);
  const [availableKeys, setAvailableKeys] = useState<ProviderKey[] | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<ChatMeta | null>(null);
  const [trialExhausted, setTrialExhausted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  useEffect(() => {
    api.listAiKeys()
      .then((r) => {
        const keys = r.keys.map((k) => ({ provider: k.provider, defaultModel: k.defaultModel, masked: k.masked }));
        setAvailableKeys(keys);
        const remembered = typeof window !== "undefined" ? localStorage.getItem("seo_pref_provider") : null;
        const pick = (remembered && keys.find((k) => k.provider === remembered)) || keys[0];
        setSelectedProvider(pick?.provider ?? null);
      })
      .catch(() => setAvailableKeys([]));
  }, []);

  function pickProvider(p: string) {
    setSelectedProvider(p);
    if (typeof window !== "undefined") localStorage.setItem("seo_pref_provider", p);
  }

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;
    setError(null);
    setInput("");

    const userMsg: Message = { role: "user", content: trimmed };
    const sysMsg: Message = { role: "system", content: systemPrompt(framework, backend, files) };

    // If the user mentions a file, include its current content so the model edits the real source.
    let augmented = trimmed;
    const mentioned = files.find((f) => trimmed.toLowerCase().includes(f.toLowerCase()));
    if (mentioned) {
      try {
        const content = await readFile(mentioned);
        augmented = `${trimmed}\n\nCurrent contents of ${mentioned}:\n\`\`\`\n${content}\n\`\`\``;
      } catch { /* ignore */ }
    }

    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      let buffer = "";
      await api.chat(
        [sysMsg, ...history.slice(0, -1).filter((m) => m.role !== "system"),
          { role: "user", content: augmented }],
        projectId,
        (delta) => {
          buffer += delta;
          setMessages((cur) => {
            const copy = cur.slice();
            copy[copy.length - 1] = { role: "assistant", content: buffer };
            return copy;
          });
        },
        {
          provider: selectedProvider || undefined,
          signal: ctrl.signal,
          onMeta: (m) => setLastMeta(m),
        },
      );
      setPendingEdits(extractEdits(buffer));
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      // Trial pool 503 = cap hit / per-user limit reached / disabled.
      if (err?.status === 503 && (availableKeys?.length ?? 0) === 0) {
        setTrialExhausted(true);
        // Drop the empty assistant bubble we optimistically appended.
        setMessages((cur) => cur.slice(0, -1));
        return;
      }
      setError(String(err?.message || err));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  async function applyAll() {
    if (pendingEdits.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      for (const edit of pendingEdits) {
        if (edit.kind === "patch") {
          const current = await readFile(edit.path);
          let patched: string;
          try {
            patched = applyUnifiedDiff(current, edit.patch);
          } catch (err: any) {
            throw new Error(`Could not apply patch to ${edit.path}: ${err?.message || err}`);
          }
          await applyEdit(edit.path, patched);
        } else {
          await applyEdit(edit.path, edit.content);
        }
      }
      setPendingEdits([]);
      onChange?.();
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setApplying(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }

  function clear() {
    setMessages([]);
    setPendingEdits([]);
    setError(null);
  }

  // Hard gate: trial exhausted AND no BYOK key → user must add a key to continue.
  if (trialExhausted) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-accent/10 grid place-items-center mb-3">
          <span className="text-accent">⚡</span>
        </div>
        <p className="text-sm font-medium mb-1">You&apos;ve used your free prompts</p>
        <p className="text-xs text-muted mb-4 leading-relaxed">
          Add your own AI key to keep building. We forward chat requests directly to your provider with zero token markup.
        </p>
        <Link href="/settings" className="bg-accent text-white text-sm px-4 py-2 rounded-md font-medium">
          Add a key
        </Link>
      </div>
    );
  }

  const onTrial = lastMeta?.tier === "trial" || (availableKeys !== null && availableKeys.length === 0 && !lastMeta);
  const trialRemaining = lastMeta?.tier === "trial" ? lastMeta.trialRemaining : undefined;
  const trialMax = lastMeta?.tier === "trial" ? lastMeta.trialMax : undefined;

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-9 flex items-center px-3 border-b border-black/5 text-xs uppercase tracking-wider text-muted gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        AI assistant
        {availableKeys && availableKeys.length > 0 && (
          <>
            <span className="text-black/30">·</span>
            <select
              value={selectedProvider || ""}
              onChange={(e) => pickProvider(e.target.value)}
              className="text-xs normal-case tracking-normal bg-transparent border-0 outline-none cursor-pointer hover:text-ink"
            >
              {availableKeys.map((k) => (
                <option key={k.provider} value={k.provider}>
                  {PROVIDER_LABELS[k.provider] || k.provider} · {k.defaultModel}
                </option>
              ))}
            </select>
          </>
        )}
        {onTrial && (
          <>
            <span className="text-black/30">·</span>
            <span className="text-xs normal-case tracking-normal text-accent">
              Free trial
              {typeof trialRemaining === "number" && typeof trialMax === "number"
                ? ` · ${trialRemaining}/${trialMax} left`
                : ""}
            </span>
          </>
        )}
        <button onClick={clear} className="ml-auto text-xs normal-case tracking-normal hover:text-ink">Clear</button>
      </div>

      {onTrial && (
        <div className="bg-accent/5 border-b border-black/5 px-3 py-2 text-xs text-muted">
          You&apos;re on the free trial pool — limited prompts on our key.{" "}
          <Link href="/settings" className="text-accent font-medium hover:underline">Add your own AI key</Link> for unlimited usage.
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-sm">
        {messages.length === 0 ? (
          <div className="text-muted text-xs leading-relaxed">
            <p className="mb-2 font-medium text-ink">Ask me to build, edit, or audit your site.</p>
            <p className="mb-1">Try:</p>
            <ul className="space-y-1">
              <li>· "Add a pricing section with 3 tiers and schema.org Product markup."</li>
              <li>· "Audit index.html and fix every SEO issue you find."</li>
              <li>· "Add an /about page with a team bio and breadcrumbs JSON-LD."</li>
            </ul>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "" : "border-l-2 border-accent/30 pl-3"}>
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                {m.role === "user" ? "You" : "Assistant"}
              </div>
              <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content || (streaming && i === messages.length - 1 ? "…" : "")}</div>
            </div>
          ))
        )}
        {error && (
          <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded">{error}</div>
        )}
      </div>

      {pendingEdits.length > 0 && !streaming && (
        <div className="border-t border-black/5 bg-accent/5 px-3 py-2">
          <div className="text-xs font-medium text-ink mb-1.5">{pendingEdits.length} file edit{pendingEdits.length === 1 ? "" : "s"} ready</div>
          <ul className="text-xs text-muted mb-2 space-y-0.5">
            {pendingEdits.map((e) => (
              <li key={e.path + e.kind} className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wider px-1 rounded ${e.kind === "patch" ? "bg-accent/10 text-accent" : "bg-black/5"}`}>{e.kind}</span>
                <span className="font-mono truncate">{e.path}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={applyAll}
              disabled={applying}
              className="bg-accent text-white text-xs px-3 py-1.5 rounded font-medium disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply all"}
            </button>
            <button
              onClick={() => setPendingEdits([])}
              className="text-xs px-3 py-1.5 rounded border border-black/10 hover:bg-black/5"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="border-t border-black/5 p-3"
      >
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
            }}
            placeholder={streaming ? "Streaming…" : "Describe a change. Cmd/Ctrl+Enter to send."}
            disabled={streaming}
            rows={3}
            className="w-full text-sm border border-black/10 rounded-md px-3 py-2 outline-none focus:border-accent resize-none disabled:bg-black/5"
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-muted">Cmd/Ctrl+Enter to send</span>
          {streaming ? (
            <button type="button" onClick={stop} className="text-xs px-3 py-1.5 rounded border border-black/10 hover:bg-black/5">Stop</button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="bg-ink text-white text-xs px-3 py-1.5 rounded font-medium disabled:opacity-40">Send</button>
          )}
        </div>
      </form>
    </div>
  );
}
