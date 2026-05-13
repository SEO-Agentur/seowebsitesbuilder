/**
 * Netlify deploy adapter. Zips the project dir and uploads via the deploys API.
 * Creates a new site on first deploy if no siteId is supplied.
 *
 * Required credentials:
 *   token   — Netlify personal access token
 *   siteId? — existing site to deploy to (omit to create a fresh one)
 */

import { DeployError, DeployInput, DeployResult, zipProject } from "./util";

export async function deployNetlify(input: DeployInput): Promise<DeployResult> {
  const token = input.credentials.token?.trim();
  if (!token) throw new DeployError("Missing Netlify token");
  if (input.framework === "php") {
    throw new DeployError("Netlify is static-only; PHP isn't supported. Pick cPanel for PHP.");
  }

  let siteId = input.credentials.siteId?.trim();
  if (!siteId) {
    const created = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: slug(input.projectName) }),
    });
    const createdBody = await created.json().catch(() => ({}));
    if (!created.ok) throw new DeployError(`Netlify create-site ${created.status}: ${createdBody?.message || ""}`);
    siteId = createdBody.id;
  }

  const zip = await zipProject(input.projectDir);
  const r = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/zip",
    },
    // See cloudflare.ts for the BlobPart cast rationale.
    body: new Blob([zip as unknown as ArrayBuffer], { type: "application/zip" }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new DeployError(`Netlify deploy ${r.status}: ${body?.message || ""}`);

  return {
    url: body?.deploy_ssl_url || body?.ssl_url || body?.url || "",
    status: body?.state === "ready" ? "success" : "building",
    externalId: body?.id,
  };
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "site";
}
