/**
 * Vercel deploy adapter. Uses the v13 deployments API with inline files.
 * Vercel runs the build itself for nextjs/astro projects.
 *
 * Required credentials:
 *   token   — Vercel personal access token
 *   teamId? — optional team ID for team accounts
 */

import fs from "fs-extra";
import { collectFiles, DeployError, DeployInput, DeployResult } from "./util";

const VERCEL_FRAMEWORK: Record<string, string | null> = {
  nextjs: "nextjs",
  astro: "astro",
  html: null,
  php: null, // not supported on Vercel runtime; user should pick another target
};

interface VercelFilePayload {
  file: string;
  data: string;
  encoding: "base64";
}

export async function deployVercel(input: DeployInput): Promise<DeployResult> {
  const token = input.credentials.token?.trim();
  if (!token) throw new DeployError("Missing Vercel token");
  if (input.framework === "php") {
    throw new DeployError("Vercel does not support a long-running PHP server. Use cPanel or a VPS for PHP deploys.");
  }

  const filesOnDisk = await collectFiles(input.projectDir);
  const files: VercelFilePayload[] = await Promise.all(
    filesOnDisk.map(async (f) => ({
      file: f.rel,
      data: (await fs.readFile(f.abs)).toString("base64"),
      encoding: "base64",
    })),
  );

  const teamQuery = input.credentials.teamId ? `?teamId=${encodeURIComponent(input.credentials.teamId)}` : "";
  const r = await fetch(`https://api.vercel.com/v13/deployments${teamQuery}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: slug(input.projectName),
      files,
      projectSettings: {
        framework: VERCEL_FRAMEWORK[input.framework],
      },
      target: "production",
    }),
  });

  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new DeployError(`Vercel API ${r.status}: ${body?.error?.message || JSON.stringify(body)}`, JSON.stringify(body));
  }

  const url = body?.url ? `https://${body.url}` : (body?.alias?.[0] ? `https://${body.alias[0]}` : "");
  const readyState: string = body?.readyState || body?.status || "INITIALIZING";
  return {
    url,
    status: readyState === "READY" ? "success" : "building",
    externalId: body?.id || body?.uid,
  };
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "site";
}
