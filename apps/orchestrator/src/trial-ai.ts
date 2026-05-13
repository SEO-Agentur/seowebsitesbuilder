/**
 * Trial AI pool — the "3 free prompts on our server-side key" funnel for
 * users who haven't added their own BYOK key yet.
 *
 * All knobs (model, input/output cap, daily $ cap, per-user lifetime cap,
 * enabled flag) live in the trial_ai_config DB row so admins can tune from
 * the /admin UI without redeploys. The key itself stays in env
 * (TRIAL_ANTHROPIC_API_KEY) and is never returned in any API response.
 */

import type { Response } from "express";
import { one, query } from "./db";
import type { ChatMessage } from "./providers/types";

export interface TrialConfig {
  provider: string;
  model: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  dailyUsdCap: number;
  maxPerUser: number;
  enabled: boolean;
}

/** Per-million-token prices in USD. Used to compute the per-call cost from
 *  the `usage` field Anthropic returns. Keep in sync with anthropic.com/pricing. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5":  { input: 1,  output: 5  },
  "claude-sonnet-4-6": { input: 3,  output: 15 },
  "claude-opus-4-7":   { input: 15, output: 75 },
};

export const SUPPORTED_MODELS = Object.keys(PRICES);

export function costOf(model: string, inT: number, outT: number): number {
  const p = PRICES[model] || PRICES["claude-sonnet-4-6"];
  return (inT * p.input + outT * p.output) / 1_000_000;
}

export async function getConfig(): Promise<TrialConfig> {
  const row = await one<{
    provider: string; model: string;
    max_input_tokens: number; max_output_tokens: number;
    daily_usd_cap: string; max_per_user: number; enabled: boolean;
  }>(`SELECT provider, model, max_input_tokens, max_output_tokens, daily_usd_cap, max_per_user, enabled FROM trial_ai_config WHERE id = 1`);
  // Fall back to safe defaults if the row was somehow deleted.
  return {
    provider: row?.provider ?? "anthropic",
    model: row?.model ?? "claude-haiku-4-5",
    maxInputTokens: row?.max_input_tokens ?? 1800,
    maxOutputTokens: row?.max_output_tokens ?? 10000,
    dailyUsdCap: parseFloat((row?.daily_usd_cap ?? "50") as any),
    maxPerUser: row?.max_per_user ?? 3,
    enabled: row?.enabled ?? false,
  };
}

export async function setConfig(patch: Partial<TrialConfig>): Promise<TrialConfig> {
  const current = await getConfig();
  const next: TrialConfig = { ...current, ...patch };
  if (!SUPPORTED_MODELS.includes(next.model)) {
    throw new Error(`Unsupported model. Supported: ${SUPPORTED_MODELS.join(", ")}`);
  }
  if (next.maxInputTokens < 100 || next.maxInputTokens > 200_000) throw new Error("maxInputTokens out of range");
  if (next.maxOutputTokens < 100 || next.maxOutputTokens > 64_000) throw new Error("maxOutputTokens out of range");
  if (next.dailyUsdCap < 0 || next.dailyUsdCap > 10_000) throw new Error("dailyUsdCap out of range");
  if (next.maxPerUser < 0 || next.maxPerUser > 1_000) throw new Error("maxPerUser out of range");
  await query(
    `UPDATE trial_ai_config
       SET provider = $1, model = $2, max_input_tokens = $3, max_output_tokens = $4,
           daily_usd_cap = $5, max_per_user = $6, enabled = $7, updated_at = now()
     WHERE id = 1`,
    [next.provider, next.model, next.maxInputTokens, next.maxOutputTokens, next.dailyUsdCap, next.maxPerUser, next.enabled],
  );
  return next;
}

export interface TrialAvailability {
  available: boolean;
  reason?: string;
  userPromptsRemaining: number;
  dailySpend: number;
  dailyCap: number;
}

/** Decide whether `userId` can use the trial pool right now. Cheap to call;
 *  always call BEFORE the model RTT so we don't waste tokens just to refuse. */
export async function checkAvailability(userId: string, cfg: TrialConfig): Promise<TrialAvailability> {
  const baseline = { userPromptsRemaining: 0, dailySpend: 0, dailyCap: cfg.dailyUsdCap };
  if (!cfg.enabled) return { available: false, reason: "Trial pool is disabled.", ...baseline };
  if (!process.env.TRIAL_ANTHROPIC_API_KEY) {
    return { available: false, reason: "Trial pool not configured on the server.", ...baseline };
  }
  const used = await one<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM trial_ai_usage WHERE user_id = $1",
    [userId],
  );
  const userPrompts = parseInt(used?.count ?? "0", 10);
  const userPromptsRemaining = Math.max(0, cfg.maxPerUser - userPrompts);
  if (userPromptsRemaining === 0) {
    return {
      available: false,
      reason: `You've used your ${cfg.maxPerUser} free prompts. Add your own AI key in /settings to keep going.`,
      userPromptsRemaining: 0, dailySpend: 0, dailyCap: cfg.dailyUsdCap,
    };
  }
  const spendRow = await one<{ sum: string | null }>(
    "SELECT SUM(usd)::text AS sum FROM trial_ai_usage WHERE created_at > now() - interval '24 hours'",
  );
  const dailySpend = parseFloat(spendRow?.sum ?? "0") || 0;
  if (dailySpend >= cfg.dailyUsdCap) {
    return {
      available: false,
      reason: "Free trial pool is at capacity today. Add your own AI key in /settings, or try again tomorrow.",
      userPromptsRemaining, dailySpend, dailyCap: cfg.dailyUsdCap,
    };
  }
  return { available: true, userPromptsRemaining, dailySpend, dailyCap: cfg.dailyUsdCap };
}

/** Stream a chat completion through the trial pool. Captures Anthropic's
 *  `usage` data from the stream and writes a trial_ai_usage row when done. */
export async function streamTrialChat(args: {
  userId: string;
  cfg: TrialConfig;
  messages: ChatMessage[];
  res: Response;
}): Promise<void> {
  const { userId, cfg, messages, res } = args;
  const key = process.env.TRIAL_ANTHROPIC_API_KEY!;
  const system = messages.find((m) => m.role === "system")?.content;
  const turn = messages.filter((m) => m.role !== "system");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: cfg.maxOutputTokens,
      system,
      messages: turn,
      stream: true,
    }),
  });
  if (!r.ok || !r.body) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);

  let inputTokens = 0;
  let outputTokens = 0;
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const event = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const payload = dataLine.slice(6);
      if (payload === "[DONE]") continue;
      try {
        const p = JSON.parse(payload);
        if (p.type === "message_start" && p.message?.usage?.input_tokens) {
          inputTokens = p.message.usage.input_tokens;
        }
        if (p.type === "message_delta" && p.usage?.output_tokens) {
          outputTokens = p.usage.output_tokens;
        }
        if (p.type === "content_block_delta" && p.delta?.text) {
          res.write(`data: ${JSON.stringify({ delta: p.delta.text })}\n\n`);
        }
      } catch { /* ignore non-JSON keepalive */ }
    }
  }

  // Record the usage. Done after stream completion so cost is final.
  const usd = costOf(cfg.model, inputTokens, outputTokens);
  try {
    await query(
      "INSERT INTO trial_ai_usage (user_id, model, input_tokens, output_tokens, usd) VALUES ($1, $2, $3, $4, $5)",
      [userId, cfg.model, inputTokens, outputTokens, usd],
    );
  } catch (err) {
    console.error("[trial-ai] usage write failed:", err);
  }
}
