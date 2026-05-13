/**
 * LLM gateway. Two tiers:
 *
 *   1. **BYOK** — user added their own provider key in /settings.
 *      Decrypts and forwards. Plaintext never logged.
 *
 *   2. **Trial pool** (fallback) — user has no BYOK key configured.
 *      Forwards through our server-side TRIAL_ANTHROPIC_API_KEY with
 *      admin-controlled caps (model, max input/output tokens, daily $ cap,
 *      per-user lifetime count). All knobs in trial_ai_config / admin UI.
 *
 * On every chat we emit an `event: meta` SSE frame so the client can show
 * which tier handled the request + how many trial prompts remain.
 */

import { Router, Response } from "express";
import { z } from "zod";
import { AuthedRequest, requireAuth } from "./auth";
import { one } from "./db";
import { decrypt } from "./crypto";
import { PROVIDERS, Provider, streamChat } from "./providers";
import * as trial from "./trial-ai";

export const llmRouter = Router();
llmRouter.use(requireAuth);

const ChatBody = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })).min(1),
  projectId: z.string().uuid().optional(),
  provider: z.enum(["anthropic", "openai", "google", "openai_compat"]).optional(),
  model: z.string().max(200).optional(),
});

interface KeyRow {
  provider: Provider;
  encrypted_key: string;
  base_url: string | null;
  default_model: string | null;
}

/** Rough token estimate — 1 token ≈ 4 chars works well enough as a pre-check
 *  to keep us under the trial input cap without paying for a tokenizer dep. */
function estimateTokens(messages: { content: string }[]): number {
  const chars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  return Math.ceil(chars / 4);
}

llmRouter.post("/chat", async (req: AuthedRequest, res: Response) => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Pick BYOK key — explicit, else most-recently-updated.
  let row: KeyRow | null;
  if (parsed.data.provider) {
    row = await one<KeyRow>(
      "SELECT provider, encrypted_key, base_url, default_model FROM user_ai_keys WHERE user_id = $1 AND provider = $2",
      [req.user!.id, parsed.data.provider],
    );
  } else {
    row = await one<KeyRow>(
      "SELECT provider, encrypted_key, base_url, default_model FROM user_ai_keys WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1",
      [req.user!.id],
    );
  }

  // === Trial fallback when no BYOK key configured ===
  if (!row) {
    const cfg = await trial.getConfig();
    const avail = await trial.checkAvailability(req.user!.id, cfg);
    if (!avail.available) {
      return res.status(503).json({
        error: avail.reason || "No AI key configured. Add one at /settings before using the assistant.",
        trial: { remaining: avail.userPromptsRemaining, dailyCap: cfg.dailyUsdCap },
      });
    }
    const estIn = estimateTokens(parsed.data.messages);
    if (estIn > cfg.maxInputTokens) {
      return res.status(413).json({
        error: `Trial prompts are limited to ${cfg.maxInputTokens} input tokens (yours: ~${estIn}). Trim the message or add your own AI key in /settings.`,
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(`event: meta\ndata: ${JSON.stringify({
      tier: "trial",
      provider: cfg.provider, model: cfg.model,
      trialRemaining: avail.userPromptsRemaining - 1, // this call consumes one
      trialMax: cfg.maxPerUser,
    })}\n\n`);
    try {
      await trial.streamTrialChat({
        userId: req.user!.id, cfg, messages: parsed.data.messages, res,
      });
    } catch (err: any) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: String(err?.message || err) })}\n\n`);
    } finally {
      res.write("event: done\ndata: {}\n\n");
      res.end();
    }
    return;
  }

  // === BYOK path ===
  const provider = row.provider;
  const model = parsed.data.model || row.default_model || PROVIDERS[provider].defaultModel;
  if (!model) {
    return res.status(400).json({ error: `No model selected for ${provider}.` });
  }

  let key: string;
  try {
    key = decrypt(row.encrypted_key);
  } catch {
    return res.status(500).json({ error: "Stored key could not be decrypted. Re-save it in /settings." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`event: meta\ndata: ${JSON.stringify({ tier: "byok", provider, model })}\n\n`);

  try {
    await streamChat(provider, {
      key,
      model,
      baseUrl: row.base_url ?? undefined,
      messages: parsed.data.messages,
      res,
    });
  } catch (err: any) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: String(err?.message || err) })}\n\n`);
  } finally {
    res.write("event: done\ndata: {}\n\n");
    res.end();
  }
});
