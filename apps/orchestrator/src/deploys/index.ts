/**
 * Deploy dispatcher. The HTTP route in projects.ts builds a DeployInput from
 * the DB row and forwards to the adapter the user picked.
 */

import { Router, Response } from "express";
import { z } from "zod";
import { one, query } from "../db";
import { AuthedRequest, requireAuth } from "../auth";
import { requireExportPlan } from "../plans";
import { projectDirFor } from "../docker";
import { DeployError, DeployInput, DeployResult } from "./util";
import { deployVercel } from "./vercel";
import { deployNetlify } from "./netlify";
import { deployCloudflare } from "./cloudflare";
import { deployGitHub } from "./github";
import { deployCpanel } from "./cpanel";

export type DeployTarget = "vercel" | "netlify" | "cloudflare" | "github" | "cpanel";

const ADAPTERS: Record<DeployTarget, (i: DeployInput) => Promise<DeployResult>> = {
  vercel: deployVercel,
  netlify: deployNetlify,
  cloudflare: deployCloudflare,
  github: deployGitHub,
  cpanel: deployCpanel,
};

const DeployBody = z.object({
  target: z.enum(["vercel", "netlify", "cloudflare", "github", "cpanel"]),
  credentials: z.record(z.string()),
});

export const deploysRouter = Router();
deploysRouter.use(requireAuth);

deploysRouter.post("/:id/deploy", requireExportPlan, async (req: AuthedRequest, res: Response) => {
  const parsed = DeployBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const project = await one<{ id: string; name: string; framework: any; owner_id: string }>(
    "SELECT id, name, framework, owner_id FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });

  const deployRow = await one<{ id: string }>(
    `INSERT INTO deploys (project_id, target, status) VALUES ($1, $2, 'building') RETURNING id`,
    [project.id, parsed.data.target],
  );

  try {
    const adapter = ADAPTERS[parsed.data.target];
    const result = await adapter({
      projectId: project.id,
      projectName: project.name,
      projectDir: projectDirFor(project.id),
      framework: project.framework,
      credentials: parsed.data.credentials,
    });
    await query(
      `UPDATE deploys SET status = $1, url = $2, log = $3 WHERE id = $4`,
      [result.status, result.url, result.log ?? "", deployRow!.id],
    );
    return res.json({ ok: true, deploy: { id: deployRow!.id, ...result } });
  } catch (err: any) {
    const log = err instanceof DeployError ? err.log ?? err.message : String(err?.message || err);
    await query(`UPDATE deploys SET status = 'failed', log = $1 WHERE id = $2`, [log, deployRow!.id]);
    return res.status(502).json({ error: err?.message || "Deploy failed", detail: log });
  }
});

deploysRouter.get("/:id/deploys", async (req: AuthedRequest, res: Response) => {
  const project = await one(
    "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });
  const rows = await query(
    "SELECT id, target, url, status, created_at FROM deploys WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20",
    [req.params.id],
  );
  return res.json({ deploys: rows });
});
