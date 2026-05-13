/**
 * Push the full project source to a user's GitHub repository.
 *
 * Different from deploys/github.ts (which builds + pushes to gh-pages for
 * GitHub Pages hosting): this pushes the working tree to `main` (or a chosen
 * branch) of a repo the user owns. Used for backups, CI integration, or to
 * hand the project off to a developer outside the platform.
 *
 * Requires a PAT with `repo` scope. We never persist the token.
 */

import fs from "fs-extra";
import { collectFiles } from "../deploys/util";

export interface GitHubExportInput {
  token: string;
  repoName: string;
  description?: string;
  isPrivate?: boolean;
  branch?: string;
  projectDir: string;
}

export interface GitHubExportResult {
  url: string;
  sha: string;
  branch: string;
  filesPushed: number;
  created: boolean;
}

export class GitHubExportError extends Error {
  constructor(message: string) { super(message); this.name = "GitHubExportError"; }
}

const GH = "https://api.github.com";

export async function exportToGitHub(input: GitHubExportInput): Promise<GitHubExportResult> {
  const token = input.token?.trim();
  const repo = input.repoName?.trim();
  const branch = (input.branch || "main").trim();

  if (!token) throw new GitHubExportError("Missing GitHub token");
  if (!repo) throw new GitHubExportError("Missing repository name");
  if (!/^[a-zA-Z0-9._-]+$/.test(repo) || repo.length > 100) {
    throw new GitHubExportError("Repository name must be ≤100 chars and contain only letters, numbers, dot, dash, underscore");
  }
  if (!/^[a-zA-Z0-9._/-]+$/.test(branch)) {
    throw new GitHubExportError("Invalid branch name");
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "seowebsitesbuilder-export/1.0",
  };

  // Resolve the authenticated user (PAT owner). Repos are created under this account.
  const userRes = await fetch(`${GH}/user`, { headers });
  if (userRes.status === 401 || userRes.status === 403) {
    throw new GitHubExportError("GitHub auth failed. Check the token has the 'repo' scope and hasn't expired.");
  }
  if (!userRes.ok) throw new GitHubExportError(`GitHub user lookup ${userRes.status}`);
  const user = await userRes.json() as { login: string };
  const owner = user.login;

  // Repo exists? If not, create it.
  let created = false;
  const repoRes = await fetch(`${GH}/repos/${owner}/${repo}`, { headers });
  if (repoRes.status === 404) {
    const createRes = await fetch(`${GH}/user/repos`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: repo,
        description: input.description || "Built with Seowebsitesbuilder",
        private: input.isPrivate !== false,
        auto_init: false,
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({} as any));
      throw new GitHubExportError(`Repo creation failed (${createRes.status}): ${body?.message || "unknown"}`);
    }
    created = true;
  } else if (!repoRes.ok) {
    throw new GitHubExportError(`Repo lookup ${repoRes.status}`);
  }

  const repoApi = `${GH}/repos/${owner}/${repo}`;

  // Existing branch tip (if any).
  let parentSha: string | null = null;
  const refRes = await fetch(`${repoApi}/git/refs/heads/${branch}`, { headers });
  if (refRes.ok) {
    const refBody = await refRes.json() as { object: { sha: string } };
    parentSha = refBody.object.sha;
  } else if (refRes.status !== 404 && refRes.status !== 409) {
    // 409 happens on freshly-created empty repos; treat as "no parent yet".
    throw new GitHubExportError(`ref lookup ${refRes.status}: ${await refRes.text()}`);
  }

  // Upload each file as a blob, then assemble into a tree + commit.
  const files = await collectFiles(input.projectDir);
  if (files.length === 0) throw new GitHubExportError("Project is empty");

  const blobs = await Promise.all(files.map(async (f) => {
    const data = (await fs.readFile(f.abs)).toString("base64");
    const r = await fetch(`${repoApi}/git/blobs`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ content: data, encoding: "base64" }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({} as any));
      throw new GitHubExportError(`Blob upload failed for ${f.rel} (${r.status}): ${body?.message || "unknown"}`);
    }
    const b = await r.json() as { sha: string };
    return { path: f.rel, sha: b.sha };
  }));

  const treeRes = await fetch(`${repoApi}/git/trees`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      tree: blobs.map((b) => ({ path: b.path, mode: "100644", type: "blob", sha: b.sha })),
    }),
  });
  const tree = await treeRes.json();
  if (!treeRes.ok) throw new GitHubExportError(`tree ${treeRes.status}: ${tree?.message || ""}`);

  const commitRes = await fetch(`${repoApi}/git/commits`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Export from Seowebsitesbuilder · ${new Date().toISOString()}`,
      tree: tree.sha,
      parents: parentSha ? [parentSha] : [],
    }),
  });
  const commit = await commitRes.json();
  if (!commitRes.ok) throw new GitHubExportError(`commit ${commitRes.status}: ${commit?.message || ""}`);

  const updateRes = await fetch(`${repoApi}/git/refs/heads/${branch}`, {
    method: parentSha ? "PATCH" : "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(parentSha
      ? { sha: commit.sha, force: true }
      : { ref: `refs/heads/${branch}`, sha: commit.sha }),
  });
  if (!updateRes.ok) throw new GitHubExportError(`ref update ${updateRes.status}: ${await updateRes.text()}`);

  return {
    url: `https://github.com/${owner}/${repo}`,
    sha: commit.sha,
    branch,
    filesPushed: blobs.length,
    created,
  };
}
