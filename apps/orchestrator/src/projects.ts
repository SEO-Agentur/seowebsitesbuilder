import { Router, Response } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "fs-extra";
import jwt from "jsonwebtoken";
import { one, query } from "./db";
import { AuthedRequest, requireAuth } from "./auth";
import {
  containerStatus,
  Framework,
  projectDirFor,
  scaffoldProjectDir,
  startContainer,
  stopContainer,
} from "./docker";
import { generateBackend, type Backend } from "@seo/generators";
import { PLANS, userPlan } from "./plans";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const CreateProject = z.object({
  name: z.string().min(1).max(100),
  framework: z.enum(["html", "astro", "nextjs", "php"]),
  backend: z.enum(["none", "supabase", "postgres", "go"]).default("none"),
  templateId: z.string().regex(/^[a-z0-9-]+$/).max(60).optional(),
});

interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  framework: Framework;
  backend: string;
  container_id: string | null;
  preview_port: number | null;
  status: string;
  seo_score: number;
  created_at: string;
  updated_at: string;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "project";
}

projectsRouter.get("/", async (req: AuthedRequest, res: Response) => {
  const rows = await query<ProjectRow>(
    "SELECT * FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC",
    [req.user!.id],
  );
  return res.json({ projects: rows });
});

projectsRouter.post("/", async (req: AuthedRequest, res: Response) => {
  const parsed = CreateProject.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, framework, backend, templateId } = parsed.data;

  // Plan quota gate. Admins bypass — operators need to be able to use their
  // own product without paying themselves.
  const plan = await userPlan(req.user!.id);
  const limits = PLANS[plan];
  const countRow = await one<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM projects WHERE owner_id = $1",
    [req.user!.id],
  );
  const projectCount = parseInt(countRow?.count ?? "0", 10);
  if (
    !req.user!.is_admin &&
    limits.maxProjects !== Infinity &&
    projectCount >= limits.maxProjects
  ) {
    return res.status(402).json({
      error: `Your ${limits.name} plan allows ${limits.maxProjects} project${limits.maxProjects === 1 ? "" : "s"}. Upgrade at /billing to create more.`,
      plan,
      limit: limits.maxProjects,
    });
  }

  const baseSlug = slugify(name);
  let slug = baseSlug;
  for (let i = 2; ; i++) {
    const existing = await one(
      "SELECT id FROM projects WHERE owner_id = $1 AND slug = $2",
      [req.user!.id, slug],
    );
    if (!existing) break;
    slug = `${baseSlug}-${i}`;
    if (i > 100) return res.status(500).json({ error: "Too many slug collisions" });
  }

  const effectiveTemplate = templateId || framework;
  const project = await one<ProjectRow>(
    `INSERT INTO projects (owner_id, name, slug, framework, backend, template_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.user!.id, name, slug, framework, backend, effectiveTemplate],
  );
  if (!project) return res.status(500).json({ error: "Failed to create project" });

  // Scaffold the template + any backend codegen up front, so the
  // editor's file tree and the SEO panel work even before the container starts.
  try {
    await scaffoldProjectDir(project.id, framework, effectiveTemplate);
    if (backend !== "none") {
      const generated = generateBackend({
        framework,
        backend: backend as Backend,
        projectName: name,
        models: [],
      });
      const projectDir = projectDirFor(project.id);
      for (const f of generated) {
        const full = path.join(projectDir, f.path);
        if (await fs.pathExists(full)) continue; // never clobber user edits
        await fs.ensureDir(path.dirname(full));
        await fs.writeFile(full, f.content, "utf8");
        await query(
          `INSERT INTO files (project_id, path, content) VALUES ($1, $2, $3)
           ON CONFLICT (project_id, path) DO NOTHING`,
          [project.id, f.path, f.content],
        );
      }
    }
  } catch (err: any) {
    return res.status(500).json({
      error: "Project record created but scaffolding failed",
      detail: String(err?.message || err),
      project,
    });
  }

  return res.status(201).json({ project });
});

projectsRouter.get("/:id", async (req: AuthedRequest, res: Response) => {
  const project = await one<ProjectRow>(
    "SELECT * FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });
  return res.json({ project });
});

/** Per-project locks so two parallel /start calls (e.g. user double-clicks
 *  while the first request is still pending) don't race on Docker's name
 *  reservation. Map projectId → in-flight promise. */
const startLocks = new Map<string, Promise<unknown>>();

projectsRouter.post("/:id/start", async (req: AuthedRequest, res: Response) => {
  const project = await one<ProjectRow>(
    "SELECT * FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });

  // If another start is in flight for this project, await it and return the
  // settled result instead of kicking off a parallel docker.create.
  const inflight = startLocks.get(project.id);
  if (inflight) {
    try {
      await inflight;
      const fresh = await one<ProjectRow>("SELECT * FROM projects WHERE id = $1", [project.id]);
      return res.json({ ok: true, containerId: fresh?.container_id ?? null, hostPort: fresh?.preview_port ?? null });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to start container", detail: String(err?.message || err) });
    }
  }

  const work = (async () => {
    await query("UPDATE projects SET status = 'starting' WHERE id = $1", [project.id]);
    try {
      const r = await startContainer(project.id, project.framework);
      await query(
        "UPDATE projects SET container_id = $1, preview_port = $2, status = 'running' WHERE id = $3",
        [r.containerId, r.hostPort, project.id],
      );
      return r;
    } catch (err) {
      await query("UPDATE projects SET status = 'error' WHERE id = $1", [project.id]);
      throw err;
    }
  })();
  startLocks.set(project.id, work);
  try {
    const { containerId, hostPort } = await work;
    return res.json({ ok: true, containerId, hostPort });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to start container", detail: String(err?.message || err) });
  } finally {
    startLocks.delete(project.id);
  }
});

projectsRouter.post("/:id/stop", async (req: AuthedRequest, res: Response) => {
  const project = await one<ProjectRow>(
    "SELECT * FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });
  if (project.container_id) await stopContainer(project.container_id);
  await query(
    "UPDATE projects SET status = 'stopped', container_id = NULL, preview_port = NULL WHERE id = $1",
    [project.id],
  );
  return res.json({ ok: true });
});

projectsRouter.delete("/:id", async (req: AuthedRequest, res: Response) => {
  const project = await one<ProjectRow>(
    "SELECT * FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });
  if (project.container_id) await stopContainer(project.container_id);
  await query("DELETE FROM projects WHERE id = $1", [project.id]);
  return res.json({ ok: true });
});

projectsRouter.get("/:id/status", async (req: AuthedRequest, res: Response) => {
  const project = await one<ProjectRow>(
    "SELECT * FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });
  const live = project.container_id ? await containerStatus(project.container_id) : "missing";
  return res.json({ status: project.status, live });
});

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret";

/**
 * Mint a short-lived preview-scoped JWT. The editor embeds this in the iframe
 * src as `?_t=<token>` so the preview proxy accepts the request without
 * needing an Authorization header (iframes can't carry one).
 */
projectsRouter.post("/:id/preview-token", async (req: AuthedRequest, res: Response) => {
  const project = await one<{ id: string }>(
    "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });
  const token = jwt.sign(
    { sub: project.id, scope: "preview" },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
  return res.json({ token, expiresIn: 3600 });
});
