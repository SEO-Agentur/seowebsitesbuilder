/**
 * Per-user AI provider keys (BYOK).
 *
 * GET    /me/ai-keys                — list configured providers (no plaintext)
 * PUT    /me/ai-keys/:provider      — set/replace
 * DELETE /me/ai-keys/:provider      — remove
 * POST   /me/ai-keys/:provider/test — verify the key works (lightweight ping)
 *
 * The plaintext key never leaves the orchestrator after PUT, and is never
 * returned in any GET response — we only surface metadata (provider, baseUrl,
 * defaultModel, label, updated_at) plus a masked preview.
 */

import { Router, Response } from "express";
import { z } from "zod";
import { AuthedRequest, requireAuth } from "./auth";
import { one, query } from "./db";
import { decrypt, encrypt, maskKey } from "./crypto";
import { PROVIDERS, Provider } from "./providers";

export const aiKeysRouter = Router();
aiKeysRouter.use(requireAuth);

const ProviderEnum = z.enum(["anthropic", "openai", "google", "openai_compat"]);

const PutBody = z.object({
  key: z.string().min(8).max(500),
  baseUrl: z.string().url().max(500).optional(),
  defaultModel: z.string().max(200).optional(),
  label: z.string().max(100).optional(),
});

interface KeyRow {
  provider: Provider;
  encrypted_key: string;
  base_url: string | null;
  default_model: string | null;
  label: string | null;
  updated_at: string;
}

aiKeysRouter.get("/", async (req: AuthedRequest, res: Response) => {
  const rows = await query<KeyRow>(
    "SELECT provider, encrypted_key, base_url, default_model, label, updated_at FROM user_ai_keys WHERE user_id = $1 ORDER BY provider",
    [req.user!.id],
  );
  return res.json({
    keys: rows.map((r) => {
      let masked = "";
      try { masked = maskKey(decrypt(r.encrypted_key)); } catch { masked = "(decryption failed)"; }
      return {
        provider: r.provider,
        baseUrl: r.base_url,
        defaultModel: r.default_model || PROVIDERS[r.provider].defaultModel,
        label: r.label,
        masked,
        updatedAt: r.updated_at,
      };
    }),
    available: Object.values(PROVIDERS),
  });
});

aiKeysRouter.put("/:provider", async (req: AuthedRequest, res: Response) => {
  const provParse = ProviderEnum.safeParse(req.params.provider);
  if (!provParse.success) return res.status(400).json({ error: "Unknown provider" });
  const provider = provParse.data;

  const parsed = PutBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (provider === "openai_compat" && !parsed.data.baseUrl) {
    return res.status(400).json({ error: "openai_compat requires a baseUrl" });
  }
  if (provider === "openai_compat" && !parsed.data.defaultModel) {
    return res.status(400).json({ error: "openai_compat requires a defaultModel" });
  }

  const ciphertext = encrypt(parsed.data.key);

  await query(
    `INSERT INTO user_ai_keys (user_id, provider, encrypted_key, base_url, default_model, label)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, provider) DO UPDATE
       SET encrypted_key = EXCLUDED.encrypted_key,
           base_url      = EXCLUDED.base_url,
           default_model = EXCLUDED.default_model,
           label         = EXCLUDED.label,
           updated_at    = now()`,
    [
      req.user!.id,
      provider,
      ciphertext,
      parsed.data.baseUrl ?? null,
      parsed.data.defaultModel ?? null,
      parsed.data.label ?? null,
    ],
  );

  return res.json({ ok: true, provider, masked: maskKey(parsed.data.key) });
});

aiKeysRouter.delete("/:provider", async (req: AuthedRequest, res: Response) => {
  const provParse = ProviderEnum.safeParse(req.params.provider);
  if (!provParse.success) return res.status(400).json({ error: "Unknown provider" });
  await query(
    "DELETE FROM user_ai_keys WHERE user_id = $1 AND provider = $2",
    [req.user!.id, provParse.data],
  );
  return res.json({ ok: true });
});

aiKeysRouter.post("/:provider/test", async (req: AuthedRequest, res: Response) => {
  const provParse = ProviderEnum.safeParse(req.params.provider);
  if (!provParse.success) return res.status(400).json({ error: "Unknown provider" });
  const row = await one<KeyRow>(
    "SELECT provider, encrypted_key, base_url, default_model FROM user_ai_keys WHERE user_id = $1 AND provider = $2",
    [req.user!.id, provParse.data],
  );
  if (!row) return res.status(404).json({ error: "No key configured for this provider" });

  try {
    const key = decrypt(row.encrypted_key);
    const provider = row.provider;
    const model = row.default_model || PROVIDERS[provider].defaultModel;
    // Lightweight ping per provider — just verify auth.
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      });
      if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
    } else if (provider === "google") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(key)}`);
      if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 200)}`);
    } else {
      const base = (provider === "openai" ? "https://api.openai.com/v1" : row.base_url || "").replace(/\/$/, "");
      if (!base) throw new Error("baseUrl required for openai_compat");
      const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
      // /models isn't always available on third-party endpoints — also accept 404 as "auth ok".
      if (!r.ok && r.status !== 404) throw new Error(`${base} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
    return res.json({ ok: true, provider, model });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err?.message || "Test failed" });
  }
});
