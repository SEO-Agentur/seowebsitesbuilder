/** Shared types + provider catalog for the BYOK LLM gateway. */

import type { Response } from "express";

export type Provider = "anthropic" | "openai" | "google" | "openai_compat";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamArgs {
  key: string;
  model: string;
  baseUrl?: string;       // openai_compat only
  messages: ChatMessage[];
  res: Response;          // SSE response we write `data: {...}\n\n` to
}

export interface ProviderInfo {
  id: Provider;
  name: string;
  defaultModel: string;
  /** Suggested base URLs to surface to the user for the openai_compat provider. */
  presets?: { name: string; baseUrl: string; defaultModel?: string }[];
  /** Where to get an API key for this provider. */
  keyDocsUrl: string;
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    defaultModel: "claude-sonnet-4-6",
    keyDocsUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-4o-mini",
    keyDocsUrl: "https://platform.openai.com/api-keys",
  },
  google: {
    id: "google",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    keyDocsUrl: "https://aistudio.google.com/app/apikey",
  },
  openai_compat: {
    id: "openai_compat",
    name: "OpenAI-compatible (custom)",
    defaultModel: "",
    keyDocsUrl: "https://openrouter.ai/keys",
    presets: [
      { name: "OpenRouter (gateway to 100+ models)", baseUrl: "https://openrouter.ai/api/v1" },
      { name: "Mistral AI", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-large-latest" },
      { name: "xAI Grok", baseUrl: "https://api.x.ai/v1", defaultModel: "grok-2-latest" },
      { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
      { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
      { name: "Together AI", baseUrl: "https://api.together.xyz/v1", defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" },
    ],
  },
};
