/**
 * Schema/model management.
 *
 * Each project owns a list of model definitions (name + fields). Editing them
 * triggers re-running the backend generator and writing the generated files
 * into the project dir alongside the framework template. Existing user-edited
 * files are never clobbered — generators check `fs.pathExists` before writing.
 */

import { Router, Response } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "fs-extra";
import { AuthedRequest, requireAuth } from "./auth";
import { one, query } from "./db";
import { projectDirFor } from "./docker";
import { generateBackend, type Backend, type ModelDef } from "@seo/generators";

export const modelsRouter = Router();
modelsRouter.use(requireAuth);

const FieldSchema = z.object({
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/i).max(60),
  type: z.enum(["string", "text", "int", "float", "bool", "timestamp", "uuid", "json"]),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  default: z.string().max(100).optional(),
});

const ModelSchema = z.object({
  name: z.string().regex(/^[A-Z][A-Za-z0-9]*$/).max(60),
  fields: z.array(FieldSchema).min(1).max(60),
});

const PutBody = z.object({
  models: z.array(ModelSchema).max(40),
  /** When true, overwrite previously-generated files even if the user edited them. Default false. */
  forceOverwrite: z.boolean().optional(),
});

interface ProjectRow {
  id: string;
  name: string;
  framework: "html" | "astro" | "nextjs" | "php";
  backend: Backend;
  models: ModelDef[];
}

modelsRouter.get("/:id/models", async (req: AuthedRequest, res: Response) => {
  const project = await one<ProjectRow>(
    "SELECT id, name, framework, backend, models FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });
  return res.json({ models: project.models || [], backend: project.backend });
});

modelsRouter.put("/:id/models", async (req: AuthedRequest, res: Response) => {
  const project = await one<ProjectRow>(
    "SELECT id, name, framework, backend FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });

  const parsed = PutBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (project.backend === "none") {
    return res.status(400).json({ error: "This project has no backend. Recreate it with a backend choice to use schema models." });
  }

  await query(
    "UPDATE projects SET models = $1, updated_at = now() WHERE id = $2",
    [JSON.stringify(parsed.data.models), project.id],
  );

  // Re-run the generator and write new/updated files.
  let written = 0;
  let skipped = 0;
  try {
    const generated = generateBackend({
      framework: project.framework,
      backend: project.backend,
      projectName: project.name,
      models: parsed.data.models,
    });
    const dir = projectDirFor(project.id);
    for (const f of generated) {
      const full = path.join(dir, f.path);
      if (!parsed.data.forceOverwrite && (await fs.pathExists(full))) {
        skipped++;
        continue;
      }
      await fs.ensureDir(path.dirname(full));
      await fs.writeFile(full, f.content, "utf8");
      await query(
        `INSERT INTO files (project_id, path, content) VALUES ($1, $2, $3)
         ON CONFLICT (project_id, path) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
        [project.id, f.path, f.content],
      );
      written++;
    }
  } catch (err: any) {
    return res.status(500).json({ error: "Models saved but regeneration failed", detail: String(err?.message || err) });
  }

  return res.json({ ok: true, models: parsed.data.models, generatedFiles: { written, skipped } });
});
