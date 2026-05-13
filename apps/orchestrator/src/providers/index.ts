/** Provider dispatcher. */

import type { Provider, StreamArgs } from "./types";
import { streamAnthropic } from "./anthropic";
import { streamOpenAICompat } from "./openai-compat";
import { streamGoogle } from "./google";

export { PROVIDERS } from "./types";
export type { Provider, ChatMessage, ProviderInfo } from "./types";

export async function streamChat(provider: Provider, args: StreamArgs): Promise<void> {
  switch (provider) {
    case "anthropic":
      return streamAnthropic(args);
    case "openai":
      return streamOpenAICompat(args, "https://api.openai.com/v1");
    case "openai_compat":
      if (!args.baseUrl) throw new Error("openai_compat requires a baseUrl");
      return streamOpenAICompat(args, args.baseUrl);
    case "google":
      return streamGoogle(args);
  }
}
