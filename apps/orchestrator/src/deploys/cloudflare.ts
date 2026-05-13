/**
 * Cloudflare Pages deploy adapter — direct upload via the v4 API.
 *
 * Required credentials:
 *   token       — Cloudflare API token with "Pages: Edit" permission
 *   accountId   — Cloudflare account ID
 *   projectName — existing Pages project name (we don't auto-create yet)
 */

import { DeployError, DeployInput, DeployResult, zipProject } from "./util";

export async function deployCloudflare(input: DeployInput): Promise<DeployResult> {
  const { token, accountId, projectName } = input.credentials;
  if (!token) throw new DeployError("Missing Cloudflare token");
  if (!accountId) throw new DeployError("Missing Cloudflare accountId");
  if (!projectName) throw new DeployError("Missing Cloudflare projectName (create the Pages project first in the Cloudflare dashboard)");
  if (input.framework === "php") throw new DeployError("Cloudflare Pages is static-only; PHP isn't supported.");

  const zip = await zipProject(input.projectDir);
  const form = new FormData();
  form.append("manifest", new Blob([JSON.stringify({})], { type: "application/json" }));
  // TS 5.7 + @types/node disagreement on Buffer<ArrayBufferLike> vs the DOM
  // lib's BlobPart — the cast is safe; Buffer IS a valid BlobPart at runtime.
  form.append("file", new Blob([zip as unknown as ArrayBuffer], { type: "application/zip" }), "site.zip");

  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/deployments`,
    { method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: form as any },
  );
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body?.success) {
    const msg = body?.errors?.[0]?.message || JSON.stringify(body);
    throw new DeployError(`Cloudflare Pages ${r.status}: ${msg}`);
  }

  return {
    url: body?.result?.url || "",
    status: body?.result?.latest_stage?.status === "success" ? "success" : "building",
    externalId: body?.result?.id,
  };
}
