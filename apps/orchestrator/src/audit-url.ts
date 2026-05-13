/**
 * Public SEO audit — paste any URL, get a 100-point report.
 *
 * Free top-of-funnel feature: no auth, hashed IP rate-limit, SSRF-guarded
 * fetch. Each result gets a UUID and is stored permanently so it becomes a
 * shareable / linkable page at seowebsitesbuilder.com/audit/<id>.
 *
 * Mounted under /api/audit (not /audit) to avoid collision with the
 * frontend audit pages.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { one, query } from "./db";
import { score } from "@seo/seo-engine";

export const auditUrlRouter = Router();

const FETCH_TIMEOUT_MS   = 10_000;
const MAX_BODY_BYTES     = 5 * 1024 * 1024;
const RATE_PER_IP_HOURLY = 10;

const AuditBody = z.object({ url: z.string().url().max(2048) });

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "::1" || h === "0.0.0.0") return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  // IPv4 RFC1918 + loopback + link-local
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  // The VPS itself
  if (h === "187.77.74.66") return true;
  return false;
}

async function fetchPage(url: string): Promise<{ html: string; status: number; finalUrl: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Seowebsitesbuilder-Audit/1.0 (+https://seowebsitesbuilder.com/audit)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!r.body) return { html: "", status: r.status, finalUrl: r.url };
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        ctrl.abort();
        throw new Error(`Response body exceeded ${MAX_BODY_BYTES / 1024 / 1024} MB`);
      }
      html += decoder.decode(value, { stream: true });
    }
    return { html, status: r.status, finalUrl: r.url };
  } finally {
    clearTimeout(timer);
  }
}

function ipFromReq(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0]?.trim() || req.socket.remoteAddress || "";
  return req.socket.remoteAddress || "";
}

auditUrlRouter.post("/audit", async (req: Request, res: Response) => {
  const parsed = AuditBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // SSRF guard
  let parsedUrl: URL;
  try { parsedUrl = new URL(parsed.data.url); } catch { return res.status(400).json({ error: "Invalid URL" }); }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: "Only http/https URLs are allowed" });
  }
  if (isPrivateHost(parsedUrl.hostname)) {
    return res.status(400).json({ error: "Cannot audit private addresses" });
  }

  // Rate limit by hashed IP — 10/hour
  const ipHash = crypto.createHash("sha256").update(ipFromReq(req)).digest("hex");
  const recent = await one<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM audits WHERE ip_hash = $1 AND fetched_at > now() - interval '1 hour'",
    [ipHash],
  );
  if (parseInt(recent?.count ?? "0", 10) >= RATE_PER_IP_HOURLY) {
    return res.status(429).json({ error: `Rate limited. Try again in an hour, or sign up for unlimited audits.` });
  }

  let html: string;
  let status: number;
  let finalUrl: string;
  try {
    const r = await fetchPage(parsed.data.url);
    html = r.html;
    status = r.status;
    finalUrl = r.finalUrl;
  } catch (err: any) {
    return res.status(502).json({ error: `Failed to fetch: ${err?.message || err}` });
  }
  if (status < 200 || status >= 400) {
    return res.status(502).json({ error: `Target returned HTTP ${status}` });
  }
  if (!html || html.length < 50) {
    return res.status(502).json({ error: "Target returned an empty or non-HTML body" });
  }

  const report = score(html);
  const row = await one<{ id: string }>(
    `INSERT INTO audits (url, final_url, status, score, report, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [parsed.data.url, finalUrl, status, report.score, JSON.stringify(report), ipHash],
  );
  return res.status(201).json({
    id: row!.id,
    url: parsed.data.url,
    finalUrl,
    status,
    score: report.score,
    fetchedAt: new Date().toISOString(),
    report,
    shareUrl: `https://seowebsitesbuilder.com/audit/${row!.id}`,
  });
});

auditUrlRouter.get("/audit/:id", async (req: Request, res: Response) => {
  const row = await one<{
    id: string; url: string; final_url: string; status: number;
    score: number; report: any; fetched_at: string;
  }>(
    "SELECT id, url, final_url, status, score, report, fetched_at FROM audits WHERE id = $1",
    [req.params.id],
  );
  if (!row) return res.status(404).json({ error: "Audit not found" });
  return res.json({
    id: row.id,
    url: row.url,
    finalUrl: row.final_url,
    status: row.status,
    score: row.score,
    fetchedAt: row.fetched_at,
    report: row.report,
    shareUrl: `https://seowebsitesbuilder.com/audit/${row.id}`,
  });
});

auditUrlRouter.get("/audit", async (_req: Request, res: Response) => {
  // Recent audits (just URL + score) for the gallery on the marketing page.
  const rows = await query<{ id: string; url: string; score: number; fetched_at: string }>(
    "SELECT id, url, score, fetched_at FROM audits ORDER BY fetched_at DESC LIMIT 12",
  );
  return res.json({ audits: rows });
});
