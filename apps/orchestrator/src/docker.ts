/**
 * Docker SDK wrapper. Each project gets one container.
 *
 * Image / command per framework:
 *   html   → node:20-alpine, `npx --yes serve -l 3000 .`
 *   astro  → node:20-alpine, `pnpm install --silent && pnpm dev --host 0.0.0.0 --port 3000`
 *   nextjs → node:20-alpine, `pnpm install --silent && pnpm dev --hostname 0.0.0.0 --port 3000`
 *   php    → php:8.3-cli, `php -S 0.0.0.0:3000 -t .`
 *
 * The host filesystem path /var/seobuilder/projects/<projectId> is bind-mounted at /app
 * so files written via the file API are immediately visible to the running process.
 */

import Docker from "dockerode";
import path from "node:path";
import fs from "fs-extra";

export type Framework = "html" | "astro" | "nextjs" | "php";

interface FrameworkConfig {
  image: string;
  cmd: string[];
  workdir: string;
  port: number;
  /** When true, mount an anonymous volume on /app/node_modules so the
   *  prebuilt image's node_modules isn't shadowed by the host bind mount. */
  prebuilt?: boolean;
}

const FRAMEWORK_CONFIG: Record<Framework, FrameworkConfig> = {
  html: {
    image: "node:20-alpine",
    cmd: ["sh", "-c", "npx --yes serve -l 3000 ."],
    workdir: "/app",
    port: 3000,
  },
  astro: {
    // Prebuilt image bakes node_modules in — first-start <2s instead of 15-30s.
    // Build on the VPS:
    //   docker build -t seo-tpl-astro:latest -f packages/templates/astro/Dockerfile packages/templates/astro
    // Falls back gracefully to a runtime install if the image is missing.
    image: process.env.ASTRO_IMAGE || "seo-tpl-astro:latest",
    cmd: ["pnpm", "dev", "--host", "0.0.0.0", "--port", "3000"],
    workdir: "/app",
    port: 3000,
    prebuilt: true,
  },
  nextjs: {
    image: process.env.NEXTJS_IMAGE || "seo-tpl-nextjs:latest",
    cmd: ["pnpm", "dev", "--hostname", "0.0.0.0", "--port", "3000"],
    workdir: "/app",
    port: 3000,
    prebuilt: true,
  },
  php: {
    image: "php:8.3-cli",
    cmd: ["sh", "-c", "php -S 0.0.0.0:3000 -t ."],
    workdir: "/app",
    port: 3000,
  },
};

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const TEMPLATES_DIR = process.env.TEMPLATES_DIR || path.resolve(__dirname, "../../../packages/templates");
const PROJECTS_DIR = process.env.PROJECT_VOLUMES_DIR || "/var/seobuilder/projects";

export async function ensureImage(image: string) {
  const images = await docker.listImages({ filters: { reference: [image] } });
  if (images.length > 0) return;
  await new Promise<void>((resolve, reject) => {
    docker.pull(image, (err: any, stream: any) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (e: any) => (e ? reject(e) : resolve()));
    });
  });
}

export async function scaffoldProjectDir(projectId: string, framework: Framework, templateId?: string) {
  const target = path.join(PROJECTS_DIR, projectId);
  const sourceDir = templateId && templateId !== framework
    ? path.join(TEMPLATES_DIR, templateId)
    : path.join(TEMPLATES_DIR, framework);
  // Fall back to the framework's blank starter if the requested template
  // dir doesn't exist on disk (e.g. someone deleted it after creating a project).
  const source = (await fs.pathExists(sourceDir))
    ? sourceDir
    : path.join(TEMPLATES_DIR, framework);
  await fs.ensureDir(target);
  await fs.copy(source, target, { overwrite: false, errorOnExist: false });
  return target;
}

export async function startContainer(projectId: string, framework: Framework) {
  let cfg = FRAMEWORK_CONFIG[framework];

  // Prebuilt image fallback: if the prebuilt template image doesn't exist
  // (e.g. the operator hasn't built it yet), fall back to runtime install on
  // node:20-alpine so things still work.
  if (cfg.prebuilt) {
    const images = await docker.listImages({ filters: { reference: [cfg.image] } });
    if (images.length === 0) {
      console.warn(`[docker] prebuilt image ${cfg.image} missing — falling back to runtime install`);
      const installCmd = framework === "astro"
        ? "corepack enable && corepack prepare pnpm@9.0.0 --activate && pnpm install --silent && pnpm dev --host 0.0.0.0 --port 3000"
        : "corepack enable && corepack prepare pnpm@9.0.0 --activate && pnpm install --silent && pnpm dev --hostname 0.0.0.0 --port 3000";
      cfg = { ...cfg, image: "node:20-alpine", cmd: ["sh", "-c", installCmd], prebuilt: false };
    }
  }

  await ensureImage(cfg.image);
  const projectDir = await scaffoldProjectDir(projectId, framework);

  const name = `seo_proj_${projectId.replace(/-/g, "_")}`;

  // Reap any container that's claiming this name. Robust to:
  //   - the container being in any state (running, paused, exited, dead)
  //   - rapid double-clicks of "Start" by the user (we run under a per-
  //     project lock above this layer; this is defense in depth)
  //   - the previous start crashing mid-flow and leaving an orphan
  const existing = await docker.listContainers({
    all: true,
    filters: { name: [`^/${name}$`] },
  }).catch(() => [] as Awaited<ReturnType<typeof docker.listContainers>>);
  for (const c of existing) {
    try {
      const ref = docker.getContainer(c.Id);
      await ref.remove({ force: true, v: false });
    } catch {
      // already gone — fine
    }
  }
  // Tiny grace period so Docker releases the name before we recreate it.
  if (existing.length > 0) {
    await new Promise((res) => setTimeout(res, 200));
  }

  // When using a prebuilt image, mount an anonymous volume on /app/node_modules
  // so the image's baked node_modules survives the host bind mount of /app.
  const binds: string[] = [`${projectDir}:${cfg.workdir}`];
  const volumes: Record<string, object> = {};
  if (cfg.prebuilt) volumes[`${cfg.workdir}/node_modules`] = {};

  const container = await docker.createContainer({
    Image: cfg.image,
    name,
    Cmd: cfg.cmd,
    WorkingDir: cfg.workdir,
    Tty: false,
    Volumes: Object.keys(volumes).length ? volumes : undefined,
    HostConfig: {
      Binds: binds,
      PortBindings: { [`${cfg.port}/tcp`]: [{ HostPort: "" }] },
      AutoRemove: false,
      // Static frameworks idle around 80 MB. Astro/Next dev servers need
      // headroom for the JIT + (when prebuilt image is missing) a one-shot
      // pnpm install at boot. 512 MB OOM-killed Next on first start.
      Memory: framework === "html" || framework === "php"
        ? 384 * 1024 * 1024
        : 1536 * 1024 * 1024,
      // ~50% of one CPU; bumped for the heavier frameworks too.
      CpuQuota: framework === "html" || framework === "php" ? 50000 : 100000,
    },
    ExposedPorts: { [`${cfg.port}/tcp`]: {} },
    Labels: { "seo.project": projectId, "seo.framework": framework },
  });

  await container.start();
  const info = await container.inspect();
  const portInfo = info.NetworkSettings.Ports?.[`${cfg.port}/tcp`]?.[0];
  const hostPort = portInfo ? parseInt(portInfo.HostPort, 10) : null;

  // Wait until the dev server inside the container is actually bound and
  // serving. Without this, the editor sets status=running the moment Docker
  // returns, but the iframe's first request hits before `pnpm dev` (or
  // `npx serve`, or whatever) has finished booting → ECONNRESET shown in
  // the iframe and stays there until the user manually refreshes.
  if (hostPort) {
    const previewHost = process.env.PREVIEW_HOST || "127.0.0.1";
    const startedAt = Date.now();
    // Frameworks that do install-at-boot (no prebuilt image) need more time.
    // Static frameworks (html/php) usually ready in <2s. Cap at 45s either way.
    const timeoutMs = framework === "html" || framework === "php" ? 15_000 : 45_000;
    while (Date.now() - startedAt < timeoutMs) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1500);
        const r = await fetch(`http://${previewHost}:${hostPort}/`, { signal: ctrl.signal });
        clearTimeout(t);
        // Any HTTP response (even 404) means the dev server is up.
        if (r.status > 0) {
          return { containerId: info.Id, hostPort };
        }
      } catch {
        // ECONNREFUSED / ECONNRESET / fetch abort — server not ready yet.
      }
      await new Promise((res) => setTimeout(res, 300));
    }
    console.warn(`[docker] container ${name} did not bind ${cfg.port} within ${timeoutMs}ms — returning anyway`);
  }

  return { containerId: info.Id, hostPort };
}

export async function stopContainer(containerId: string) {
  try {
    const c = docker.getContainer(containerId);
    await c.stop({ t: 5 }).catch(() => {});
    await c.remove({ force: true }).catch(() => {});
  } catch {
    // ignore
  }
}

export async function containerStatus(containerId: string): Promise<"running" | "stopped" | "error" | "missing"> {
  try {
    const c = docker.getContainer(containerId);
    const info = await c.inspect();
    if (info.State.Running) return "running";
    if (info.State.ExitCode === 0) return "stopped";
    return "error";
  } catch {
    return "missing";
  }
}

export async function attachShell(containerId: string) {
  const c = docker.getContainer(containerId);
  const exec = await c.exec({
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Cmd: ["sh"],
  });
  return exec.start({ hijack: true, stdin: true });
}

export function projectDirFor(projectId: string) {
  return path.join(PROJECTS_DIR, projectId);
}
