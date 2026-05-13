/**
 * Reverse proxy: requests to /preview/:projectId/* are forwarded to the
 * dynamically-allocated host port of the project's running container.
 *
 * Auth — accept any of:
 *  - Bearer JWT in Authorization header, with project ownership check
 *  - `?_t=<token>` query param: short-lived preview-scoped JWT (1h)
 *    signed with JWT_SECRET, payload { sub: projectId, scope: "preview" }.
 *    This is what the editor embeds in the iframe src.
 */

import { Request, Response } from "express";
import httpProxy from "http-proxy";
import jwt from "jsonwebtoken";
import { one } from "./db";
import { touch } from "./activity";

const proxy = httpProxy.createProxyServer({ ws: true, changeOrigin: true });

proxy.on("error", (err, _req, res) => {
  if (res && "writeHead" in res && !res.headersSent) {
    (res as Response).writeHead(502, { "Content-Type": "text/plain" });
    (res as Response).end(`Preview unavailable: ${err.message}`);
  }
});

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret";

interface ProjectRow { id: string; owner_id: string; preview_port: number | null; status: string }

/** Returns true if the request bears a valid preview token or owner bearer JWT for this project. */
async function isAuthorized(req: Request, projectId: string): Promise<boolean> {
  // Path 1 — preview-scoped JWT in query string.
  const t = String(req.query._t || "");
  if (t) {
    try {
      const payload = jwt.verify(t, JWT_SECRET) as { sub?: string; scope?: string };
      if (payload?.scope === "preview" && payload.sub === projectId) return true;
    } catch { /* fall through */ }
  }
  // Path 2 — full user JWT in Authorization header (curl / API access).
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub?: string };
      if (payload?.sub) {
        const owned = await one(
          "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
          [projectId, payload.sub],
        );
        if (owned) return true;
      }
    } catch { /* fall through */ }
  }
  return false;
}

export async function previewProxyHandler(req: Request, res: Response) {
  const projectId = req.params.id;
  if (!(await isAuthorized(req, projectId))) {
    return res
      .status(401)
      .type("text/html")
      .send(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:2rem;color:#0a0a0a;">
<h2>Preview requires authentication</h2>
<p>This preview link is for the project owner. <a href="https://seowebsitesbuilder.com/login">Log in</a> to view it.</p>
</body>`);
  }

  const project = await one<ProjectRow>(
    "SELECT id, owner_id, preview_port, status FROM projects WHERE id = $1",
    [projectId],
  );
  if (!project) return res.status(404).type("text/plain").send("Project not found");
  if (!project.preview_port) {
    return res
      .status(503)
      .type("text/html")
      .send(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:2rem;">
<h2>Preview not running</h2>
<p>Click <strong>Start</strong> in the editor to launch this project's container.</p>
</body>`);
  }

  // Mark the project as active so the idle stopper doesn't kill it under us.
  touch(projectId);

  // Strip /preview/:id from the path before forwarding.
  const original = req.url; // /preview/:id/something
  req.url = original.replace(new RegExp(`^/preview/${projectId}`), "") || "/";

  proxy.web(req, res, { target: `http://${PREVIEW_HOST}:${project.preview_port}` });
}

const PREVIEW_HOST = process.env.PREVIEW_HOST || "127.0.0.1";
