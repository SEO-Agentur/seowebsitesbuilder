/**
 * Image optimization endpoint. Walks the project dir for PNG/JPG, writes
 * .webp alongside (originals preserved). Does NOT rewrite HTML — the user
 * decides how to reference them (e.g. <picture> with both sources) or asks
 * the AI assistant to do it.
 */

import { Router, Response } from "express";
import path from "node:path";
import fs from "fs-extra";
import { AuthedRequest, requireAuth } from "./auth";
import { one } from "./db";
import { projectDirFor } from "./docker";

export const imagesRouter = Router();
imagesRouter.use(requireAuth);

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", ".cache"]);
const IMAGE_RE = /\.(png|jpe?g)$/i;
const QUALITY = 80;

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  if (!(await fs.pathExists(dir))) return out;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (IMAGE_RE.test(e.name)) out.push(full);
  }
  return out;
}

imagesRouter.post("/:id/optimize-images", async (req: AuthedRequest, res: Response) => {
  const project = await one<{ id: string }>(
    "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });

  let sharp: any;
  try {
    // Lazy import so the orchestrator boots even on hosts where sharp's
    // native binaries failed to install.
    sharp = (await import("sharp")).default;
  } catch (err: any) {
    return res.status(500).json({ error: "sharp not installed on the orchestrator", detail: String(err?.message || err) });
  }

  const dir = projectDirFor(project.id);
  const images = await walk(dir);
  const results: { src: string; webp: string; before: number; after: number; saved: number }[] = [];
  let totalBefore = 0;
  let totalAfter = 0;

  for (const img of images) {
    const webp = img.replace(IMAGE_RE, ".webp");
    try {
      const before = (await fs.stat(img)).size;
      await sharp(img).webp({ quality: QUALITY }).toFile(webp);
      const after = (await fs.stat(webp)).size;
      results.push({
        src: path.relative(dir, img),
        webp: path.relative(dir, webp),
        before,
        after,
        saved: before - after,
      });
      totalBefore += before;
      totalAfter += after;
    } catch (err: any) {
      results.push({
        src: path.relative(dir, img),
        webp: "",
        before: 0,
        after: 0,
        saved: 0,
      });
    }
  }

  return res.json({
    ok: true,
    processed: results.length,
    totalBefore,
    totalAfter,
    totalSaved: totalBefore - totalAfter,
    results,
  });
});
