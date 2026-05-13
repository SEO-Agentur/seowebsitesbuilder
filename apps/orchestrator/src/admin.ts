/**
 * Admin-only endpoints. Auth flow:
 *   1. User authenticates normally via requireAuth (Bearer JWT).
 *   2. requireAdmin then checks users.is_admin = true.
 *   3. Routes available under /admin/* on the orchestrator.
 *
 * Bootstrap an admin by setting ADMIN_EMAIL in the orchestrator env — that
 * email auto-gets is_admin=true on next signup/login (see auth.ts).
 * Or one-shot via SQL:
 *   UPDATE users SET is_admin = true WHERE email = '<you>@example.com';
 */

import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { AuthedRequest, requireAuth } from "./auth";
import { one, query } from "./db";
import { getConfig, setConfig, SUPPORTED_MODELS } from "./trial-ai";

export const adminRouter = Router();
adminRouter.use(requireAuth);

async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const row = await one<{ is_admin: boolean }>(
    "SELECT is_admin FROM users WHERE id = $1",
    [req.user!.id],
  );
  if (!row?.is_admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
adminRouter.use(requireAdmin);

adminRouter.get("/trial-ai/config", async (_req: AuthedRequest, res: Response) => {
  const cfg = await getConfig();
  return res.json({ config: cfg, supportedModels: SUPPORTED_MODELS, keyConfigured: !!process.env.TRIAL_ANTHROPIC_API_KEY });
});

const PutBody = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  maxInputTokens: z.number().int().min(100).max(200_000).optional(),
  maxOutputTokens: z.number().int().min(100).max(64_000).optional(),
  dailyUsdCap: z.number().min(0).max(10_000).optional(),
  maxPerUser: z.number().int().min(0).max(1_000).optional(),
  enabled: z.boolean().optional(),
});

adminRouter.put("/trial-ai/config", async (req: AuthedRequest, res: Response) => {
  const parsed = PutBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const next = await setConfig(parsed.data);
    return res.json({ ok: true, config: next });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "Invalid config" });
  }
});

adminRouter.get("/trial-ai/usage", async (_req: AuthedRequest, res: Response) => {
  const cfg = await getConfig();
  const today = await one<{ count: string; usd: string; users: string }>(
    `SELECT COUNT(*)::text AS count,
            COALESCE(SUM(usd),0)::text AS usd,
            COUNT(DISTINCT user_id)::text AS users
       FROM trial_ai_usage
      WHERE created_at > now() - interval '24 hours'`,
  );
  const sevenDays = await query<{ day: string; count: string; usd: string }>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
            COUNT(*)::text AS count,
            COALESCE(SUM(usd),0)::text AS usd
       FROM trial_ai_usage
      WHERE created_at > now() - interval '7 days'
      GROUP BY day
      ORDER BY day DESC`,
  );
  const topUsers = await query<{ user_id: string; email: string; calls: string; usd: string }>(
    `SELECT u.id AS user_id, u.email, COUNT(*)::text AS calls, SUM(t.usd)::text AS usd
       FROM trial_ai_usage t JOIN users u ON u.id = t.user_id
      WHERE t.created_at > now() - interval '24 hours'
      GROUP BY u.id, u.email
      ORDER BY SUM(t.usd) DESC
      LIMIT 10`,
  );
  return res.json({
    today: {
      promptCount: parseInt(today?.count ?? "0", 10),
      uniqueUsers: parseInt(today?.users ?? "0", 10),
      spendUsd: parseFloat(today?.usd ?? "0"),
      capUsd: cfg.dailyUsdCap,
      capRemainingUsd: Math.max(0, cfg.dailyUsdCap - parseFloat(today?.usd ?? "0")),
    },
    sevenDays: sevenDays.map((d) => ({
      day: d.day,
      promptCount: parseInt(d.count, 10),
      spendUsd: parseFloat(d.usd),
    })),
    topUsers: topUsers.map((u) => ({
      userId: u.user_id, email: u.email,
      calls: parseInt(u.calls, 10), spendUsd: parseFloat(u.usd),
    })),
  });
});
