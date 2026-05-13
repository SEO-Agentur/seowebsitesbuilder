/**
 * Audit production build — runs the framework's `build` command inside the
 * project's running container, then scores the built HTML with the SEO engine.
 *
 *   html / php → no build needed, score the live index file
 *   astro      → `pnpm build`, score dist/index.html
 *   nextjs     → `pnpm build` (requires output:"export" in next.config.js), score out/index.html
 *
 * Falls back to a clear error message if the container isn't running or the
 * build fails. Container must already be running — this endpoint won't start it.
 */

import { Router, Response } from "express";
import path from "node:path";
import fs from "fs-extra";
import Docker from "dockerode";
import { AuthedRequest, requireAuth } from "./auth";
import { one } from "./db";
import { projectDirFor } from "./docker";
import { score } from "@seo/seo-engine";

export const auditRouter = Router();
auditRouter.use(requireAuth);

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

interface ProjectRow {
  id: string;
  framework: "html" | "astro" | "nextjs" | "php";
  container_id: string | null;
  status: string;
}

const BUILD_CMD: Record<ProjectRow["framework"], string | null> = {
  html: null,
  php: null,
  astro: "pnpm build",
  nextjs: "pnpm build",
};

const OUTPUT_HTML: Record<ProjectRow["framework"], string> = {
  html: "index.html",
  php: "index.php",                  // PHP has no static output — we score the source file
  astro: "dist/index.html",
  nextjs: "out/index.html",
};

async function execInContainer(containerId: string, cmd: string, timeoutMs = 180_000): Promise<{ ok: boolean; output: string }> {
  const c = docker.getContainer(containerId);
  const exec = await c.exec({
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: "/app",
    Cmd: ["sh", "-c", cmd],
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  return new Promise((resolve) => {
    let output = "";
    const t = setTimeout(() => {
      resolve({ ok: false, output: output + `\n[build timed out after ${timeoutMs / 1000}s]` });
    }, timeoutMs);
    stream.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
    stream.on("end", async () => {
      clearTimeout(t);
      try {
        const inspect = await exec.inspect();
        resolve({ ok: inspect.ExitCode === 0, output });
      } catch {
        resolve({ ok: true, output });
      }
    });
  });
}

auditRouter.post("/:id/audit-build", async (req: AuthedRequest, res: Response) => {
  const project = await one<ProjectRow>(
    "SELECT id, framework, container_id, status FROM projects WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id],
  );
  if (!project) return res.status(404).json({ error: "Not found" });

  const dir = projectDirFor(project.id);
  const buildCmd = BUILD_CMD[project.framework];
  let buildLog = "";

  // For frameworks that build, we need a running container to run the build in.
  if (buildCmd) {
    if (!project.container_id || project.status !== "running") {
      return res.status(409).json({
        error: "Start the preview container first — audit runs the build inside it.",
      });
    }
    const result = await execInContainer(project.container_id, buildCmd);
    buildLog = result.output;
    if (!result.ok) {
      return res.status(500).json({ error: "Build failed", buildLog });
    }
  }

  const outputPath = path.join(dir, OUTPUT_HTML[project.framework]);
  if (!(await fs.pathExists(outputPath))) {
    return res.status(404).json({
      error: `Built HTML not found at ${OUTPUT_HTML[project.framework]}`,
      hint: project.framework === "nextjs"
        ? "Add `output: 'export'` to your next.config.js so `pnpm build` produces a static out/ directory."
        : undefined,
      buildLog,
    });
  }

  const html = await fs.readFile(outputPath, "utf8");
  const report = score(html);

  return res.json({
    ok: true,
    framework: project.framework,
    outputPath: OUTPUT_HTML[project.framework],
    htmlBytes: Buffer.byteLength(html, "utf8"),
    report,
    buildLog: buildLog ? buildLog.slice(-2000) : undefined, // cap log size in response
  });
});
