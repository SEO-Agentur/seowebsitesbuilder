/**
 * OpenAI-style chat completions streaming. Works with OpenAI itself plus any
 * provider that mimics the API: OpenRouter, Mistral, xAI Grok, DeepSeek,
 * Groq, Together, etc. The user supplies the baseUrl per key (defaults to
 * api.openai.com when the provider type is `openai`).
 */

import type { StreamArgs } from "./types";

export async function streamOpenAICompat(
  { key, model, baseUrl, messages, res }: StreamArgs,
  fallbackBaseUrl = "https://api.openai.com/v1",
): Promise<void> {
  const base = (baseUrl || fallbackBaseUrl).replace(/\/$/, "");
  const url = `${base}/chat/completions`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!r.ok || !r.body) throw new Error(`${base} ${r.status}: ${await r.text()}`);

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") return;
      try {
        const p = JSON.parse(payload);
        const delta = p.choices?.[0]?.delta?.content;
        if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      } catch { /* ignore */ }
    }
  }
}
