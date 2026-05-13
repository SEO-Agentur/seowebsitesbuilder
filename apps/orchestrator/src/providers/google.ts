/**
 * Google Gemini streamGenerateContent adapter.
 *
 * The API takes the system prompt as `systemInstruction.parts[].text` and
 * the conversation as `contents[]`. Streaming responses are SSE-like, one
 * candidate at a time with `candidates[0].content.parts[0].text` deltas.
 */

import type { StreamArgs } from "./types";

export async function streamGoogle({ key, model, messages, res }: StreamArgs): Promise<void> {
  const system = messages.find((m) => m.role === "system")?.content;
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
    }),
  });
  if (!r.ok || !r.body) throw new Error(`Google ${r.status}: ${await r.text()}`);

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
      const payload = dataLine.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const p = JSON.parse(payload);
        const parts = p?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (typeof part.text === "string" && part.text.length) {
            res.write(`data: ${JSON.stringify({ delta: part.text })}\n\n`);
          }
        }
      } catch { /* ignore */ }
    }
  }
}
