import express from "express";
import cors from "cors";
import http from "node:http";
import { WebSocketServer } from "ws";
import { authRouter, verifyTokenString } from "./auth";
import { projectsRouter } from "./projects";
import { filesRouter } from "./files";
import { llmRouter } from "./llm";
import { aiKeysRouter } from "./ai-keys";
import { modelsRouter } from "./models";
import { imagesRouter } from "./images";
import { auditRouter } from "./audit";
import { auditUrlRouter } from "./audit-url";
import { billingRouter, mountWebhook } from "./billing";
import { publishRouter, publishesListRouter } from "./publish";
import { domainsRouter, domainsAskRouter } from "./domains";
import { oauthRouter } from "./oauth";
import { adminRouter } from "./admin";
import { deploysRouter } from "./deploys";
import { exportsRouter } from "./exports";
import { previewProxyHandler } from "./proxy";
import { attachShell } from "./docker";
import { one } from "./db";
import { touch } from "./activity";
import { startIdleStopper } from "./idle";
import { startPublishExpirer } from "./publish-expirer";
import * as terminalHistory from "./terminal-history";

const app = express();
app.use(cors({ origin: true, credentials: true }));

// The Stripe webhook MUST receive the raw request body so the signature can
// be verified. Mount it before express.json() consumes the body.
mountWebhook(app);

app.use(express.json({ limit: "5mb" }));

// Promote ?token= query param into Authorization header. Needed by routes
// that get hit by browser <a> clicks (notably the .zip export — links can't
// set headers). Idempotent — only fills in when Authorization is missing.
app.use((req, _res, next) => {
  if (!req.headers.authorization && typeof req.query.token === "string" && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/projects", projectsRouter);
app.use("/projects", filesRouter); // shares /:id namespace
app.use("/projects", deploysRouter); // shares /:id namespace
app.use("/projects", exportsRouter); // shares /:id namespace
app.use("/projects", modelsRouter);  // shares /:id namespace
app.use("/projects", imagesRouter);  // shares /:id namespace
app.use("/projects", auditRouter);   // shares /:id namespace
app.use("/api", auditUrlRouter);     // public audit endpoints
app.use("/llm", llmRouter);
app.use("/me/ai-keys", aiKeysRouter);
app.use("/api/admin", adminRouter);
app.use("/me/domains", domainsRouter);
app.use("/me/publishes", publishesListRouter);
app.use("/api", domainsAskRouter);   // public Caddy ask endpoint
app.use("/api/billing", billingRouter);
app.use("/api/oauth", oauthRouter);
app.use("/projects", publishRouter); // shares /:id namespace

// Preview reverse proxy
app.use("/preview/:id", (req, res) => previewProxyHandler(req as any, res));

const server = http.createServer(app);

// WebSocket terminal: ws://host/ws/terminal/:projectId?token=...
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", async (req, socket, head) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  if (!url.pathname.startsWith("/ws/terminal/")) {
    socket.destroy();
    return;
  }
  const projectId = url.pathname.split("/").pop()!;
  const token = url.searchParams.get("token") || "";
  const claims = verifyTokenString(token);
  if (!claims) { socket.destroy(); return; }

  const project = await one<{ id: string; container_id: string | null }>(
    "SELECT id, container_id FROM projects WHERE id = $1 AND owner_id = $2",
    [projectId, claims.sub],
  );
  if (!project?.container_id) { socket.destroy(); return; }

  wss.handleUpgrade(req, socket as any, head, async (ws) => {
    try {
      const stream = await attachShell(project.container_id!);
      touch(projectId);
      // Replay any prior scrollback so the user sees what happened before reconnecting.
      const backlog = terminalHistory.replay(projectId);
      if (backlog) ws.send(`\x1b[2m─── reconnected — last ${backlog.length} bytes shown ───\x1b[0m\r\n` + backlog);
      stream.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        terminalHistory.append(projectId, text);
        ws.send(text);
      });
      ws.on("message", (msg) => { touch(projectId); stream.write(msg.toString()); });
      ws.on("close", () => stream.end());
      stream.on("end", () => ws.close());
    } catch (err: any) {
      ws.send(`\r\n[shell error: ${err?.message || err}]\r\n`);
      ws.close();
    }
  });
});

const port = parseInt(process.env.PORT || "4000", 10);
server.listen(port, () => {
  console.log(`[orchestrator] listening on :${port}`);
  startIdleStopper();
  startPublishExpirer();
});
