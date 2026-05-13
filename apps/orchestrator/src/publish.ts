/**
 * Publish a project to <slug>.seosites.app.
 *
 *   html   → copy project files verbatim
 *   astro  → docker exec `pnpm build`, copy dist/
 *   nextjs → docker exec `pnpm build`, copy out/ (requires next.config output:"export")
 *   php    → unsupported in v1 (no PHP runtime on the hosting layer; deploy via cPanel instead)
 *
 * Caddy already has a `*.seosites.app` block serving from /var/seosites/<labels.2>/
 * (set up earlier with the Cloudflare Origin Cert). Custom domains are
 * layered on top via [domains.ts].
 */

import { Router, Response } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "fs-extra";
import Docker from "dockerode";
import { AuthedRequest, requireAuth } from "./auth";
import { one, query } from "./db";
import { projectDirFor } from "./docker";
import { PLANS, userPlan } from "./plans";

export const publishRouter = Router();
publishRouter.use(requireAuth);

/** Cross-project list of the user's publishes — used by /domains and the
 *  project picker when attaching a custom domain. */
export const publishesListRouter = Router();
publishesListRouter.use(requireAuth);
publishesListRouter.get("/", async (req: AuthedRequest, res: Response) => {
  const rows = await query<{
    id: string; slug: string; status: string; last_built_at: string;
    bytes_published: number | null;
    project_id: string; project_name: string; framework: string;
  }>(
    `SELECT p.id, p.slug, p.status, p.last_built_at, p.bytes_published,
            pr.id AS project_id, pr.name AS project_name, pr.framework
       FROM publishes p
       JOIN projects pr ON pr.id = p.project_id
      WHERE pr.owner_id = $1
      ORDER BY p.last_built_at DESC`,
    [req.user!.id],
  );
  return res.json({
    publishes: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      status: r.status,
      url: `https://${r.slug}.seosites.app`,
      lastBuiltAt: r.last_built_at,
      bytesPublished: r.bytes_published,
      project: { id: r.project_id, name: r.project_name, framework: r.framework },
    })),
  });
});

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const SEOSITES_ROOT = process.env.SEOSITES_ROOT || "/var/seosites";

// Reserved slugs we never let users claim.
const RESERVED = new Set([
  "_default", "_admin", "_api", "_internal", "_health", "_static",
  "www", "mail", "api", "admin", "ftp", "smtp", "pop", "imap",
  "blog", "shop", "store", "app", "auth", "login", "signup",
  "cname", "ns", "ns1", "ns2", "dns", "test", "staging", "dev",
  "support", "help", "docs", "status",
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

const PublishBody = z.object({
  slug: z.string().min(3).max(60).regex(SLUG_RE, "slug must be lowercase letters, digits, and dashes (3–60 chars, no leading/trailing dash)"),
});

interface ProjectRow {
  id: string;
  name: string;
  framework: "html" | "astro" | "nextjs" | "php";
  container_id: string | null;
  status: string;
}

interface PublishRow {
  id: string;
  project_id: string;
  slug: string;
  status: string;
  last_built_at: string;
  bytes_published: number | null;
  expires_at: string | null;
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  async function walk(d: string) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) total += (await fs.stat(full)).size;
    }
  }
  await walk(dir);
  return total;
}

async function execInContainer(containerId: string, cmd: string, timeoutMs = 240_000): Promise<{ ok: boolean; output: string }> {
  const c = docker.getContainer(containerId);
  const exec = await c.exec({
    AttachStdout: true, AttachStderr: true, WorkingDir: "/app",
    Cmd: ["sh", "-c", cmd],
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  return new Promise((resolve) => {
    let output = "";
    const t = setTimeout(() => resolve({ ok: false, output: output + `\n[build timed out after ${timeoutMs / 1000}s]` }), timeoutMs);
    stream.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
    stream.on("end", async () => {
      clearTimeout(t);
      try { const i = await exec.inspect(); resolve({ ok: i.ExitCode === 0, output }); }
      catch { resolve({ ok: true, output }); }
    });
  });
}

/** Where the framework drops its built static output, relative to the project dir. */
function buildOutputDir(framework: ProjectRow["framework"], projectDir: string): string {
  switch (framework) {
    case "html":   return projectDir;            // already static
    case "astro":  return path.join(projectDir, "dist");
    case "nextjs": return path.join(projectDir, "out");
    case "php":    return projectDir;            // not used (PHP not supported)
  }
}

const IGNORE = new Set(["node_modules", ".git", ".next", ".cache", ".astro", "dist", "out"]);
/** For html, copy the source dir but exclude build/cache artifacts. */
async function copyHtml(from: string, to: string): Promise<void> {
  await fs.ensureDir(to);
  await fs.copy(from, to, {
    overwrite: true,
    errorOnExist: false,
    filter: (src) => {
      const rel = path.relative(from, src);
      if (!rel) return true;
      const top = rel.split(path.sep)[0];
      return !IGNORE.has(top);
    },
  });
}

publishRouter.post("/:id/publish", async (req: AuthedRequest, res: Response) => {
  const parsed = PublishBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const project = await one<ProjectRow>(
    "SELECT id, name, framework, container_id, status FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });

  // Plan gate
  const plan = await userPlan(req.user!.id);
  if (!PLANS[plan].publishOnSeosites) {
    return res.status(402).json({ error: "Publishing on *.seosites.app is included on Solo, Pro, and Agency plans. Upgrade at /billing." });
  }

  if (project.framework === "php") {
    return res.status(400).json({ error: "PHP publish isn't supported on *.seosites.app yet (we serve static files). Deploy via cPanel/SFTP for PHP." });
  }

  const slug = parsed.data.slug.toLowerCase();
  if (RESERVED.has(slug)) {
    return res.status(400).json({ error: "That slug is reserved. Pick another." });
  }

  // Uniqueness — global, but allow updating the same project's existing slug.
  const collision = await one<{ project_id: string }>(
    "SELECT project_id FROM publishes WHERE slug = $1",
    [slug],
  );
  if (collision && collision.project_id !== project.id) {
    return res.status(409).json({ error: "That slug is already taken." });
  }

  // For astro/nextjs we need a running container to invoke pnpm build.
  if (project.framework === "astro" || project.framework === "nextjs") {
    if (!project.container_id || project.status !== "running") {
      return res.status(409).json({ error: "Start the preview container first — publish runs the build inside it." });
    }
  }

  // Build (if needed) then copy.
  const projectDir = projectDirFor(project.id);
  let buildLog = "";

  if (project.framework === "astro" || project.framework === "nextjs") {
    const r = await execInContainer(project.container_id!, "pnpm build 2>&1");
    buildLog = r.output;
    if (!r.ok) {
      await query(
        `INSERT INTO publishes (project_id, slug, status, build_log)
         VALUES ($1, $2, 'failed', $3)
         ON CONFLICT (project_id) DO UPDATE SET status='failed', build_log=EXCLUDED.build_log, updated_at=now()`,
        [project.id, slug, buildLog],
      );
      return res.status(500).json({ error: "Build failed", buildLog: buildLog.slice(-3000) });
    }
  }

  const srcDir = buildOutputDir(project.framework, projectDir);
  if (!(await fs.pathExists(srcDir))) {
    return res.status(404).json({
      error: `Built output not found at ${path.relative(projectDir, srcDir) || "."}`,
      hint: project.framework === "nextjs" ? "Add `output: 'export'` to next.config.js so `pnpm build` produces an out/ directory." : undefined,
      buildLog: buildLog.slice(-2000),
    });
  }

  const targetDir = path.join(SEOSITES_ROOT, slug);
  // If a different project previously used this slug, the collision check
  // already blocked us. Safe to wipe and rewrite our own slug dir.
  await fs.remove(targetDir);
  if (project.framework === "html") {
    await copyHtml(srcDir, targetDir);
  } else {
    await fs.copy(srcDir, targetDir, { overwrite: true, errorOnExist: false });
  }
  // Caddy serves these files — match ownership of /var/seosites itself.
  try { await fs.chown(targetDir, 0, 0); } catch { /* best-effort */ }

  const bytes = await dirSize(targetDir);

  // Free-tier publishes get a 7-day expiration; paid plans never expire.
  const ttlDays = PLANS[plan].publishExpiresAfterDays;
  const expiresAt = ttlDays ? new Date(Date.now() + ttlDays * 86_400_000) : null;

  await query(
    `INSERT INTO publishes (project_id, slug, status, build_log, bytes_published, expires_at, last_built_at)
     VALUES ($1, $2, 'live', $3, $4, $5, now())
     ON CONFLICT (project_id) DO UPDATE SET
       slug            = EXCLUDED.slug,
       status          = 'live',
       build_log       = EXCLUDED.build_log,
       bytes_published = EXCLUDED.bytes_published,
       expires_at      = EXCLUDED.expires_at,
       last_built_at   = now(),
       updated_at      = now()`,
    [project.id, slug, buildLog || null, bytes, expiresAt],
  );

  return res.json({
    ok: true,
    slug,
    url: `https://${slug}.seosites.app`,
    bytesPublished: bytes,
    framework: project.framework,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    buildLog: buildLog ? buildLog.slice(-2000) : undefined,
  });
});

publishRouter.get("/:id/publish", async (req: AuthedRequest, res: Response) => {
  const project = await one(
    "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });
  const row = await one<PublishRow>(
    "SELECT id, project_id, slug, status, last_built_at, bytes_published, expires_at FROM publishes WHERE project_id = $1",
    [req.params.id],
  );
  if (!row) return res.json({ publish: null });
  return res.json({
    publish: {
      id: row.id,
      slug: row.slug,
      status: row.status,
      url: `https://${row.slug}.seosites.app`,
      lastBuiltAt: row.last_built_at,
      bytesPublished: row.bytes_published,
      expiresAt: row.expires_at,
    },
  });
});

publishRouter.delete("/:id/publish", async (req: AuthedRequest, res: Response) => {
  const project = await one(
    "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });
  const row = await one<{ slug: string }>(
    "SELECT slug FROM publishes WHERE project_id = $1",
    [req.params.id],
  );
  if (!row) return res.json({ ok: true });
  await fs.remove(path.join(SEOSITES_ROOT, row.slug)).catch(() => undefined);
  await query("DELETE FROM publishes WHERE project_id = $1", [req.params.id]);
  return res.json({ ok: true });
});
