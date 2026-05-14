/**
 * File API for a project. The container's bind-mounted /app dir is the source of truth.
 * We mirror writes into Postgres so projects survive a container loss.
 */

import { Router, Response } from "express";
import path from "node:path";
import fs from "fs-extra";
import archiver from "archiver";
import { z } from "zod";
import { AuthedRequest, requireAuth } from "./auth";
import { requireExportPlan } from "./plans";
import { one, query } from "./db";
import { projectDirFor } from "./docker";

export const filesRouter = Router();
filesRouter.use(requireAuth);

// Walk a directory and return relative file list.
async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  if (!(await fs.pathExists(dir))) return out;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === ".next" || e.name === "dist") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full, base)));
    } else {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

async function ownsProject(req: AuthedRequest, projectId: string) {
  return one(
    "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
    [projectId, req.user!.id],
  );
}

// Reject path traversal.
function safeJoin(root: string, rel: string) {
  const target = path.resolve(root, rel);
  if (!target.startsWith(path.resolve(root) + path.sep) && target !== path.resolve(root)) {
    throw new Error("Path escapes project root");
  }
  return target;
}

// GET /projects/:id/files — list relative paths
filesRouter.get("/:id/files", async (req: AuthedRequest, res: Response) => {
  if (!(await ownsProject(req, req.params.id))) return res.status(404).json({ error: "Not found" });
  const dir = projectDirFor(req.params.id);
  const list = await walk(dir);
  return res.json({ files: list.sort() });
});

// GET /projects/:id/files/:path(*) — read one file
filesRouter.get("/:id/file", async (req: AuthedRequest, res: Response) => {
  if (!(await ownsProject(req, req.params.id))) return res.status(404).json({ error: "Not found" });
  const rel = String(req.query.path || "");
  if (!rel) return res.status(400).json({ error: "path query param required" });
  const dir = projectDirFor(req.params.id);
  let full: string;
  try { full = safeJoin(dir, rel); } catch { return res.status(400).json({ error: "Bad path" }); }
  if (!(await fs.pathExists(full))) return res.status(404).json({ error: "File not found" });
  const content = await fs.readFile(full, "utf8");
  return res.json({ path: rel, content });
});

const PutBody = z.object({
  path: z.string().min(1).max(500),
  content: z.string().max(8_000_000), // ~6 MB binary after base64
  /** When true, decode `content` from base64 before writing — used by the
   *  drag-and-drop upload path for images / fonts / other binary assets. */
  base64: z.boolean().optional(),
});

// PUT /projects/:id/file — write a file
filesRouter.put("/:id/file", async (req: AuthedRequest, res: Response) => {
  if (!(await ownsProject(req, req.params.id))) return res.status(404).json({ error: "Not found" });
  const parsed = PutBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { path: rel, content, base64 } = parsed.data;
  const dir = projectDirFor(req.params.id);
  let full: string;
  try { full = safeJoin(dir, rel); } catch { return res.status(400).json({ error: "Bad path" }); }

  // Binary uploads (images, fonts, etc) skip the text-versioning path —
  // file_versions stores TEXT and would corrupt binary if mirrored.
  if (base64) {
    const buf = Buffer.from(content, "base64");
    await fs.ensureDir(path.dirname(full));
    await fs.writeFile(full, buf);
    // Mirror only the *fact* of the file to Postgres (empty content); the
    // bind-mounted /app dir is the source of truth for binary assets.
    await query(
      `INSERT INTO files (project_id, path, content) VALUES ($1, $2, '')
       ON CONFLICT (project_id, path) DO UPDATE SET updated_at = now()`,
      [req.params.id, rel],
    );
    return res.json({ ok: true, bytes: buf.byteLength });
  }

  // Snapshot the existing content (if any) before overwriting, so the editor
  // can offer "restore previous version" UI.
  const prior = await query<{ content: string }>(
    "SELECT content FROM files WHERE project_id = $1 AND path = $2",
    [req.params.id, rel],
  );
  if (prior[0] && prior[0].content !== content) {
    await query(
      "INSERT INTO file_versions (project_id, path, content) VALUES ($1, $2, $3)",
      [req.params.id, rel, prior[0].content],
    );
    // Keep only the most recent 20 versions per file.
    await query(
      `DELETE FROM file_versions WHERE id IN (
         SELECT id FROM file_versions
          WHERE project_id = $1 AND path = $2
          ORDER BY saved_at DESC OFFSET 20
       )`,
      [req.params.id, rel],
    );
  }

  await fs.ensureDir(path.dirname(full));
  await fs.writeFile(full, content, "utf8");
  await query(
    `INSERT INTO files (project_id, path, content) VALUES ($1, $2, $3)
     ON CONFLICT (project_id, path) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
    [req.params.id, rel, content],
  );
  return res.json({ ok: true });
});

// POST /projects/:id/file/rename — rename/move a file
const RenameBody = z.object({
  from: z.string().min(1).max(500),
  to: z.string().min(1).max(500),
});
filesRouter.post("/:id/file/rename", async (req: AuthedRequest, res: Response) => {
  if (!(await ownsProject(req, req.params.id))) return res.status(404).json({ error: "Not found" });
  const parsed = RenameBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { from, to } = parsed.data;
  if (from === to) return res.json({ ok: true });
  const dir = projectDirFor(req.params.id);
  let src: string, dst: string;
  try {
    src = safeJoin(dir, from);
    dst = safeJoin(dir, to);
  } catch {
    return res.status(400).json({ error: "Bad path" });
  }
  if (!(await fs.pathExists(src))) return res.status(404).json({ error: "Source not found" });
  if (await fs.pathExists(dst)) return res.status(409).json({ error: "Destination already exists" });

  await fs.ensureDir(path.dirname(dst));
  await fs.move(src, dst);

  // Mirror in DB: move the files row + any file_versions rows for the same path.
  await query("UPDATE files SET path = $1, updated_at = now() WHERE project_id = $2 AND path = $3", [to, req.params.id, from]);
  await query("UPDATE file_versions SET path = $1 WHERE project_id = $2 AND path = $3", [to, req.params.id, from]);

  return res.json({ ok: true });
});

// GET /projects/:id/file/history?path=... — list recent versions
filesRouter.get("/:id/file/history", async (req: AuthedRequest, res: Response) => {
  if (!(await ownsProject(req, req.params.id))) return res.status(404).json({ error: "Not found" });
  const rel = String(req.query.path || "");
  if (!rel) return res.status(400).json({ error: "path query param required" });
  const rows = await query<{ id: string; saved_at: string; preview: string }>(
    `SELECT id, saved_at, LEFT(content, 120) AS preview
       FROM file_versions
      WHERE project_id = $1 AND path = $2
      ORDER BY saved_at DESC
      LIMIT 20`,
    [req.params.id, rel],
  );
  return res.json({ versions: rows });
});

// POST /projects/:id/file/restore — restore a specific version
const RestoreBody = z.object({ path: z.string().min(1), versionId: z.string().uuid() });
filesRouter.post("/:id/file/restore", async (req: AuthedRequest, res: Response) => {
  if (!(await ownsProject(req, req.params.id))) return res.status(404).json({ error: "Not found" });
  const parsed = RestoreBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { path: rel, versionId } = parsed.data;

  const versions = await query<{ content: string }>(
    "SELECT content FROM file_versions WHERE id = $1 AND project_id = $2 AND path = $3",
    [versionId, req.params.id, rel],
  );
  if (!versions[0]) return res.status(404).json({ error: "Version not found" });

  // Snapshot the current content first (so the user can undo the restore).
  const cur = await query<{ content: string }>(
    "SELECT content FROM files WHERE project_id = $1 AND path = $2",
    [req.params.id, rel],
  );
  if (cur[0] && cur[0].content !== versions[0].content) {
    await query(
      "INSERT INTO file_versions (project_id, path, content) VALUES ($1, $2, $3)",
      [req.params.id, rel, cur[0].content],
    );
  }

  const dir = projectDirFor(req.params.id);
  let full: string;
  try { full = safeJoin(dir, rel); } catch { return res.status(400).json({ error: "Bad path" }); }
  await fs.ensureDir(path.dirname(full));
  await fs.writeFile(full, versions[0].content, "utf8");
  await query(
    `INSERT INTO files (project_id, path, content) VALUES ($1, $2, $3)
     ON CONFLICT (project_id, path) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
    [req.params.id, rel, versions[0].content],
  );

  return res.json({ ok: true, content: versions[0].content });
});

// DELETE /projects/:id/file?path=...
filesRouter.delete("/:id/file", async (req: AuthedRequest, res: Response) => {
  if (!(await ownsProject(req, req.params.id))) return res.status(404).json({ error: "Not found" });
  const rel = String(req.query.path || "");
  if (!rel) return res.status(400).json({ error: "path query param required" });
  const dir = projectDirFor(req.params.id);
  let full: string;
  try { full = safeJoin(dir, rel); } catch { return res.status(400).json({ error: "Bad path" }); }
  await fs.remove(full);
  await query("DELETE FROM files WHERE project_id = $1 AND path = $2", [req.params.id, rel]);
  return res.json({ ok: true });
});

// GET /projects/:id/export — stream a zip of the project directory
filesRouter.get("/:id/export", requireExportPlan, async (req: AuthedRequest, res: Response) => {
  if (!(await ownsProject(req, req.params.id))) return res.status(404).json({ error: "Not found" });
  const dir = projectDirFor(req.params.id);
  if (!(await fs.pathExists(dir))) return res.status(404).json({ error: "Project dir missing" });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.id}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => res.status(500).end(String(err)));
  archive.pipe(res);
  archive.glob("**/*", { cwd: dir, ignore: ["node_modules/**", ".next/**", "dist/**", ".git/**"] });
  await archive.finalize();
});
