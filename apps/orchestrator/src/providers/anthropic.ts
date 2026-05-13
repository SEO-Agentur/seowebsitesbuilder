/** Anthropic Messages API streaming adapter. */

import type { StreamArgs } from "./types";

export async function streamAnthropic({ key, model, messages, res }: StreamArgs): Promise<void> {
  const system = messages.find((m) => m.role === "system")?.content;
  const turnMessages = messages.filter((m) => m.role !== "system");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: turnMessages,
      stream: true,
    }),
  });
  if (!r.ok || !r.body) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);

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
      if (payload === "[DONE]") return;
      try {
        const p = JSON.parse(payload);
        if (p.type === "content_block_delta" && p.delta?.text) {
          res.write(`data: ${JSON.stringify({ delta: p.delta.text })}\n\n`);
        }
      } catch { /* ignore non-JSON keepalive frames */ }
    }
  }
}
