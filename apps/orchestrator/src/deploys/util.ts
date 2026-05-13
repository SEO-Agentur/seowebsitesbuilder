/** Deploy-adapter helpers. */

import path from "node:path";
import fs from "fs-extra";
import archiver from "archiver";

const IGNORE = new Set(["node_modules", ".git", ".next", "dist", ".cache", ".vercel", ".netlify"]);

export interface CollectedFile {
  /** path relative to projectDir, posix slashes */
  rel: string;
  abs: string;
  size: number;
}

export async function collectFiles(projectDir: string): Promise<CollectedFile[]> {
  const out: CollectedFile[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORE.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(abs);
      } else if (e.isFile()) {
        const stat = await fs.stat(abs);
        const rel = path.relative(projectDir, abs).split(path.sep).join("/");
        out.push({ rel, abs, size: stat.size });
      }
    }
  }
  await walk(projectDir);
  return out;
}

/** Pipe a zip stream of the project to a buffer. Suitable for Netlify-style uploads. */
export async function zipProject(projectDir: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    archive.on("data", (c) => chunks.push(c as Buffer));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.glob("**/*", {
      cwd: projectDir,
      ignore: ["node_modules/**", ".git/**", ".next/**", "dist/**", ".cache/**"],
      dot: false,
    });
    archive.finalize();
  });
}

export interface DeployInput {
  projectId: string;
  projectName: string;
  projectDir: string;
  framework: "html" | "astro" | "nextjs" | "php";
  credentials: Record<string, string>;
}

export interface DeployResult {
  url: string;
  status: "success" | "building" | "failed";
  log?: string;
  externalId?: string;
}

export class DeployError extends Error {
  constructor(message: string, public readonly log?: string) {
    super(message);
  }
}
