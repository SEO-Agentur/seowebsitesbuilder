/** Export endpoints — currently just GitHub. Mounted on /projects. */

import { Router, Response } from "express";
import { z } from "zod";
import { AuthedRequest, requireAuth } from "../auth";
import { requireExportPlan } from "../plans";
import { one } from "../db";
import { projectDirFor } from "../docker";
import { exportToGitHub, GitHubExportError } from "./github";

export const exportsRouter = Router();
exportsRouter.use(requireAuth);

const Body = z.object({
  token: z.string().min(1),
  repoName: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  isPrivate: z.boolean().optional(),
  branch: z.string().max(100).optional(),
});

exportsRouter.post("/:id/export-github", requireExportPlan, async (req: AuthedRequest, res: Response) => {
  const project = await one<{ id: string; slug: string }>(
    "SELECT id, slug FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await exportToGitHub({
      ...parsed.data,
      projectDir: projectDirFor(project.id),
    });
    return res.json({ ok: true, export: result });
  } catch (err: any) {
    const status = err instanceof GitHubExportError ? 400 : 502;
    return res.status(status).json({ error: err?.message || "Export failed" });
  }
});
