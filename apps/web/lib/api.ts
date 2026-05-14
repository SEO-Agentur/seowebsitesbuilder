"use client";

const ORCH = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:4000";

export interface ChatMeta {
  tier: "byok" | "trial";
  provider: string;
  model: string;
  /** Trial-only: remaining lifetime trial prompts for this user, after this call. */
  trialRemaining?: number;
  /** Trial-only: lifetime per-user cap. */
  trialMax?: number;
}

function token() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("seo_token");
}

async function req<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const t = token();
  if (t) headers.set("authorization", `Bearer ${t}`);
  const res = await fetch(`${ORCH}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.headers.get("content-type")?.includes("application/json")) return res.json();
  return res as any;
}

export const api = {
  signup: (email: string, password: string, name?: string) =>
    req<{ token: string; user: { id: string; email: string; name: string | null; is_admin?: boolean } }>(
      "/auth/signup",
      { method: "POST", body: JSON.stringify({ email, password, name }) },
    ),
  login: (email: string, password: string) =>
    req<{ token: string; user: { id: string; email: string; name: string | null; is_admin?: boolean } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),
  me: () => req<{ user: { id: string; email: string; name: string | null; is_admin?: boolean } }>("/auth/me"),
  forgotPassword: (email: string) =>
    req<{ ok: true }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    req<{ ok: true }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  listProjects: () => req<{ projects: any[] }>("/projects"),
  createProject: (name: string, framework: string, backend: string, templateId?: string) =>
    req<{ project: any }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, framework, backend, templateId }),
    }),
  getProject: (id: string) => req<{ project: any }>(`/projects/${id}`),
  startProject: (id: string) => req<{ ok: true; containerId: string; hostPort: number }>(`/projects/${id}/start`, { method: "POST" }),
  stopProject: (id: string) => req<{ ok: true }>(`/projects/${id}/stop`, { method: "POST" }),
  deleteProject: (id: string) => req<{ ok: true }>(`/projects/${id}`, { method: "DELETE" }),
  listFiles: (id: string) => req<{ files: string[] }>(`/projects/${id}/files`),
  readFile: (id: string, path: string) =>
    req<{ path: string; content: string }>(`/projects/${id}/file?path=${encodeURIComponent(path)}`),
  writeFile: (id: string, path: string, content: string) =>
    req<{ ok: true }>(`/projects/${id}/file`, {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    }),
  /** Upload a binary file (image, font, etc) by base64-encoding the bytes. */
  uploadFile: (id: string, path: string, base64Content: string) =>
    req<{ ok: true; bytes: number }>(`/projects/${id}/file`, {
      method: "PUT",
      body: JSON.stringify({ path, content: base64Content, base64: true }),
    }),
  deleteFile: (id: string, path: string) =>
    req<{ ok: true }>(`/projects/${id}/file?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    }),
  renameFile: (id: string, from: string, to: string) =>
    req<{ ok: true }>(`/projects/${id}/file/rename`, {
      method: "POST",
      body: JSON.stringify({ from, to }),
    }),
  fileHistory: (id: string, path: string) =>
    req<{ versions: { id: string; saved_at: string; preview: string }[] }>(
      `/projects/${id}/file/history?path=${encodeURIComponent(path)}`,
    ),
  restoreFileVersion: (id: string, path: string, versionId: string) =>
    req<{ ok: true; content: string }>(`/projects/${id}/file/restore`, {
      method: "POST",
      body: JSON.stringify({ path, versionId }),
    }),
  optimizeImages: (id: string) =>
    req<{
      ok: true;
      processed: number;
      totalBefore: number;
      totalAfter: number;
      totalSaved: number;
      results: { src: string; webp: string; before: number; after: number; saved: number }[];
    }>(`/projects/${id}/optimize-images`, { method: "POST", body: "{}" }),
  auditBuild: (id: string) =>
    req<{
      ok: true;
      framework: string;
      outputPath: string;
      htmlBytes: number;
      report: { score: number; checks: { id: string; label: string; weight: number; passed: boolean; detail?: string }[] };
      buildLog?: string;
    }>(`/projects/${id}/audit-build`, { method: "POST", body: "{}" }),
  /** Public anonymous URL audit. No auth needed. */
  auditUrl: (url: string) =>
    fetch(`${ORCH}/api/audit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }).then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || `Audit failed (${r.status})`);
      return body as {
        id: string; url: string; finalUrl: string; status: number;
        score: number; fetchedAt: string; report: any; shareUrl: string;
      };
    }),
  fetchAudit: (id: string) =>
    fetch(`${ORCH}/api/audit/${id}`).then(async (r) => {
      if (!r.ok) throw new Error(`Audit not found`);
      return r.json() as Promise<{ id: string; url: string; finalUrl: string; status: number; score: number; fetchedAt: string; report: any; shareUrl: string }>;
    }),
  exportUrl: (id: string) => `${ORCH}/projects/${id}/export?token=${token() ?? ""}`,
  previewUrl: (id: string, previewToken?: string) =>
    previewToken ? `${ORCH}/preview/${id}/?_t=${previewToken}` : `${ORCH}/preview/${id}/`,
  previewToken: (id: string) =>
    req<{ token: string; expiresIn: number }>(`/projects/${id}/preview-token`, { method: "POST" }),
  listModels: (id: string) =>
    req<{ models: any[]; backend: string }>(`/projects/${id}/models`),
  saveModels: (id: string, models: any[], forceOverwrite?: boolean) =>
    req<{ ok: true; models: any[]; generatedFiles: { written: number; skipped: number } }>(`/projects/${id}/models`, {
      method: "PUT",
      body: JSON.stringify({ models, forceOverwrite }),
    }),
  terminalWsUrl: (id: string) => {
    const url = new URL(ORCH);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `/ws/terminal/${id}`;
    url.searchParams.set("token", token() ?? "");
    return url.toString();
  },
  /** Stream chat completions from the orchestrator's LLM gateway (BYOK or trial pool). */
  async chat(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    projectId: string | undefined,
    onDelta: (text: string) => void,
    options?: {
      provider?: string;
      model?: string;
      signal?: AbortSignal;
      onMeta?: (meta: ChatMeta) => void;
    },
  ): Promise<void> {
    const headers = new Headers({ "content-type": "application/json" });
    const t = token();
    if (t) headers.set("authorization", `Bearer ${t}`);
    const res = await fetch(`${ORCH}/llm/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        projectId,
        provider: options?.provider,
        model: options?.model,
      }),
      signal: options?.signal,
    });
    if (!res.ok || !res.body) {
      // Try to surface a structured error payload (e.g. trial-exhausted 503).
      const body = await res.text().catch(() => "");
      let parsed: any = null;
      try { parsed = body ? JSON.parse(body) : null; } catch { /* not JSON */ }
      const err: any = new Error(parsed?.error || `Chat failed: ${res.status} ${body || res.statusText}`);
      err.status = res.status;
      err.trial = parsed?.trial;
      throw err;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let eventName = "";
        let dataStr = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataStr += (dataStr ? "\n" : "") + line.slice(6);
        }
        if (!dataStr) continue;
        let payload: any;
        try { payload = JSON.parse(dataStr); } catch { continue; }
        if (eventName === "meta") {
          options?.onMeta?.(payload as ChatMeta);
        } else if (eventName === "error") {
          const err: any = new Error(payload?.error || "Stream error");
          err.fromStream = true;
          throw err;
        } else if (eventName === "done") {
          // graceful end
        } else if (typeof payload.delta === "string") {
          onDelta(payload.delta);
        }
      }
    }
  },
  deployProject: (id: string, target: string, credentials: Record<string, string>) =>
    req<{ ok: true; deploy: any }>(`/projects/${id}/deploy`, {
      method: "POST",
      body: JSON.stringify({ target, credentials }),
    }),
  listDeploys: (id: string) =>
    req<{ deploys: any[] }>(`/projects/${id}/deploys`),
  exportToGithub: (
    id: string,
    body: { token: string; repoName: string; description?: string; isPrivate?: boolean; branch?: string },
  ) =>
    req<{
      ok: true;
      export: { url: string; sha: string; branch: string; filesPushed: number; created: boolean };
    }>(`/projects/${id}/export-github`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listAiKeys: () =>
    req<{
      keys: { provider: string; baseUrl: string | null; defaultModel: string; label: string | null; masked: string; updatedAt: string }[];
      available: { id: string; name: string; defaultModel: string; keyDocsUrl: string; presets?: { name: string; baseUrl: string; defaultModel?: string }[] }[];
    }>(`/me/ai-keys`),
  putAiKey: (provider: string, body: { key: string; baseUrl?: string; defaultModel?: string; label?: string }) =>
    req<{ ok: true; provider: string; masked: string }>(`/me/ai-keys/${provider}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteAiKey: (provider: string) =>
    req<{ ok: true }>(`/me/ai-keys/${provider}`, { method: "DELETE" }),
  testAiKey: (provider: string) =>
    req<{ ok: boolean; provider?: string; model?: string; error?: string }>(`/me/ai-keys/${provider}/test`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  billingMe: () =>
    req<{
      plan: "free" | "solo" | "pro" | "agency";
      limits: { maxProjects: number | null; maxCustomDomains: number | null; maxSeats: number; publishOnSeosites: boolean; publishExpiresAfterDays: number | null; canExport: boolean; whiteLabel: boolean };
      usage: { projects: number };
      subscription: { status: string; currentPeriodEnd: string | null };
      stripeReady: boolean;
    }>(`/api/billing/me`),
  checkoutSession: (plan: "solo" | "pro" | "agency") =>
    req<{ url: string }>(`/api/billing/checkout-session`, {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),
  billingPortal: () =>
    req<{ url: string }>(`/api/billing/portal`, { method: "POST", body: "{}" }),
  getPublish: (id: string) =>
    req<{ publish: { id: string; slug: string; status: string; url: string; lastBuiltAt: string; bytesPublished: number | null; expiresAt: string | null } | null }>(`/projects/${id}/publish`),
  publish: (id: string, slug: string) =>
    req<{ ok: true; slug: string; url: string; bytesPublished: number; framework: string; expiresAt: string | null; buildLog?: string }>(`/projects/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ slug }),
    }),
  unpublish: (id: string) =>
    req<{ ok: true }>(`/projects/${id}/publish`, { method: "DELETE" }),
  listCustomDomains: () =>
    req<{ domains: { id: string; domain: string; status: string; verifiedAt: string | null; slug: string; publishId: string }[] }>(`/me/domains`),
  addCustomDomain: (publishId: string, domain: string) =>
    req<{ ok: true; id: string; domain: string; status: string; url: string }>(`/me/domains`, {
      method: "POST",
      body: JSON.stringify({ publishId, domain }),
    }),
  recheckCustomDomain: (id: string) =>
    req<{ ok: true; status: string }>(`/me/domains/${id}/recheck`, { method: "POST", body: "{}" }),
  deleteCustomDomain: (id: string) =>
    req<{ ok: true }>(`/me/domains/${id}`, { method: "DELETE" }),
  oauthProviders: () =>
    fetch(`${ORCH}/api/oauth/providers`).then(async (r) => {
      if (!r.ok) return { providers: [] as { id: "github" | "google"; enabled: boolean }[] };
      return r.json() as Promise<{ providers: { id: "github" | "google"; enabled: boolean }[] }>;
    }),
  oauthStartUrl: (provider: "github" | "google") => `${ORCH}/api/oauth/${provider}/start`,
  // Admin (gated server-side by users.is_admin). Mounted under /api so it
  // doesn't collide with the Next frontend's /admin/* pages in the reverse proxy.
  adminTrialConfig: () =>
    req<{
      config: { provider: string; model: string; maxInputTokens: number; maxOutputTokens: number; dailyUsdCap: number; maxPerUser: number; enabled: boolean };
      supportedModels: string[];
      keyConfigured: boolean;
    }>(`/api/admin/trial-ai/config`),
  adminUpdateTrialConfig: (patch: any) =>
    req<{ ok: true; config: any }>(`/api/admin/trial-ai/config`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  adminTrialUsage: () =>
    req<{
      today: { promptCount: number; uniqueUsers: number; spendUsd: number; capUsd: number; capRemainingUsd: number };
      sevenDays: { day: string; promptCount: number; spendUsd: number }[];
      topUsers: { userId: string; email: string; calls: number; spendUsd: number }[];
    }>(`/api/admin/trial-ai/usage`),
  listPublishes: () =>
    req<{
      publishes: {
        id: string; slug: string; status: string; url: string;
        lastBuiltAt: string; bytesPublished: number | null;
        project: { id: string; name: string; framework: string };
      }[];
    }>(`/me/publishes`),
};

export function previewUrl(id: string, previewToken?: string) { return api.previewUrl(id, previewToken); }
export function exportUrl(id: string) { return api.exportUrl(id); }
export function terminalWsUrl(id: string) { return api.terminalWsUrl(id); }
