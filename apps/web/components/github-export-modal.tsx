"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  projectId: string;
  defaultRepoName: string;
  onClose: () => void;
}

interface ExportResult {
  url: string;
  sha: string;
  branch: string;
  filesPushed: number;
  created: boolean;
}

export function GithubExportModal({ projectId, defaultRepoName, onClose }: Props) {
  const [token, setToken] = useState("");
  const [repoName, setRepoName] = useState(defaultRepoName);
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim() || !repoName.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.exportToGithub(projectId, {
        token: token.trim(),
        repoName: repoName.trim(),
        description: description.trim() || undefined,
        isPrivate,
      });
      setResult(r.export);
      // Clear token from memory; we never want to keep it around.
      setToken("");
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-black/5 flex items-center">
          <h2 className="text-lg font-semibold tracking-tight">Export to GitHub</h2>
          <button onClick={onClose} className="ml-auto text-sm text-muted hover:text-ink">Close</button>
        </header>
        <div className="p-6">
          <p className="text-sm text-muted mb-5">
            Push the full project source to a GitHub repo you own. We&apos;ll create the repo if it doesn&apos;t exist.
            <span className="block mt-1"><strong>Your token is forwarded once and never stored.</strong></span>
          </p>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">GitHub personal access token <span className="text-red-600">*</span></span>
              <input
                type="password"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
                className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent text-sm font-mono"
              />
              <span className="text-xs text-muted">
                Needs <code className="px-1 bg-black/5 rounded">repo</code> scope. Create at{" "}
                <a className="text-accent underline" target="_blank" rel="noreferrer" href="https://github.com/settings/tokens/new?scopes=repo&description=Seowebsitesbuilder%20export">
                  github.com/settings/tokens/new
                </a>
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Repository name <span className="text-red-600">*</span></span>
              <input
                type="text"
                required
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                pattern="[a-zA-Z0-9._-]+"
                placeholder="my-cool-site"
                className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent text-sm"
              />
              <span className="text-xs text-muted">Letters, numbers, dot, dash, underscore.</span>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Description (optional)</span>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                placeholder="Built with Seowebsitesbuilder"
                className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent text-sm"
              />
            </label>

            <label className="flex items-center gap-2 text-sm pt-1">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              <span>Create as <strong>private</strong> repository (recommended)</span>
            </label>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded">{error}</div>
            )}

            {result && (
              <div className="bg-green-50 text-green-800 text-sm px-3 py-2 rounded space-y-1">
                <div>
                  Exported <strong>{result.filesPushed}</strong> files to{" "}
                  <a href={result.url} target="_blank" rel="noreferrer" className="underline font-medium">
                    {result.url.replace("https://", "")}
                  </a>
                </div>
                <div className="text-xs">
                  {result.created ? "Created new repo" : "Updated existing repo"} · branch{" "}
                  <code className="bg-black/10 px-1 rounded">{result.branch}</code> · commit{" "}
                  <code className="bg-black/10 px-1 rounded">{result.sha.slice(0, 7)}</code>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-md border border-black/10 hover:bg-black/5"
              >
                {result ? "Done" : "Cancel"}
              </button>
              {!result && (
                <button
                  type="submit"
                  disabled={busy || !token.trim() || !repoName.trim()}
                  className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium disabled:opacity-50"
                >
                  {busy ? "Pushing…" : "Export to GitHub"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
