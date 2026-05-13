/**
 * GitHub Pages deploy adapter — pushes the project to a `gh-pages` branch
 * via the GitHub Contents API. Works for static frameworks (html, astro, nextjs static export).
 *
 * Required credentials:
 *   token  — GitHub PAT with `repo` scope
 *   owner  — GitHub username or org
 *   repo   — repository name (must already exist; we don't auto-create)
 *   branch?— defaults to "gh-pages"
 */

import fs from "fs-extra";
import { collectFiles, DeployError, DeployInput, DeployResult } from "./util";

export async function deployGitHub(input: DeployInput): Promise<DeployResult> {
  const { token, owner, repo } = input.credentials;
  const branch = input.credentials.branch?.trim() || "gh-pages";
  if (!token || !owner || !repo) {
    throw new DeployError("GitHub deploy requires token, owner, and repo");
  }
  if (input.framework === "php") throw new DeployError("GitHub Pages is static-only; PHP isn't supported.");

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  // Resolve branch ref (create if missing).
  let parentSha: string | null = null;
  const refRes = await fetch(`${base}/git/refs/heads/${branch}`, { headers });
  if (refRes.ok) {
    const refBody: any = await refRes.json();
    parentSha = refBody?.object?.sha ?? null;
  } else if (refRes.status !== 404) {
    throw new DeployError(`GitHub ref lookup ${refRes.status}: ${await refRes.text()}`);
  }

  const files = await collectFiles(input.projectDir);

  // Create blobs for each file
  const blobs = await Promise.all(files.map(async (f) => {
    const data = (await fs.readFile(f.abs)).toString("base64");
    const r = await fetch(`${base}/git/blobs`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ content: data, encoding: "base64" }),
    });
    const b: any = await r.json();
    if (!r.ok) throw new DeployError(`GitHub blob ${r.status}: ${b?.message || ""}`);
    return { path: f.rel, sha: b.sha as string };
  }));

  const treeRes = await fetch(`${base}/git/trees`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      tree: blobs.map((b) => ({ path: b.path, mode: "100644", type: "blob", sha: b.sha })),
    }),
  });
  const tree: any = await treeRes.json();
  if (!treeRes.ok) throw new DeployError(`GitHub tree ${treeRes.status}: ${tree?.message || ""}`);

  const commitRes = await fetch(`${base}/git/commits`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Deploy ${input.projectName} via Seowebsitesbuilder`,
      tree: tree.sha,
      parents: parentSha ? [parentSha] : [],
    }),
  });
  const commit: any = await commitRes.json();
  if (!commitRes.ok) throw new DeployError(`GitHub commit ${commitRes.status}: ${commit?.message || ""}`);

  const updateRes = await fetch(`${base}/git/refs/heads/${branch}`, {
    method: parentSha ? "PATCH" : "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(parentSha
      ? { sha: commit.sha, force: true }
      : { ref: `refs/heads/${branch}`, sha: commit.sha }),
  });
  if (!updateRes.ok) throw new DeployError(`GitHub ref update ${updateRes.status}: ${await updateRes.text()}`);

  return {
    url: `https://${owner}.github.io/${repo}/`,
    status: "success",
    externalId: commit.sha,
  };
}
