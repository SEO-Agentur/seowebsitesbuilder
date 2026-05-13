/**
 * OAuth login — GitHub and Google.
 *
 * Flow:
 *   1. Browser hits GET /api/oauth/{provider}/start → 302 to provider authorize URL,
 *      with a signed JWT state token containing the provider name.
 *   2. Provider redirects back to /api/oauth/{provider}/callback with code + state.
 *   3. Server verifies state, exchanges code for access token, fetches the
 *      user's profile, finds-or-creates the user, links the oauth_accounts row.
 *   4. Issues our normal app JWT and redirects to /auth/callback#token=<jwt>,
 *      where the frontend reads it, stores in localStorage, and lands on /dashboard.
 *
 * Required env vars per provider (omit to disable that provider):
 *   GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET
 *   GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
 *   OAUTH_REDIRECT_BASE — public origin, defaults to https://seowebsitesbuilder.com
 *
 * Setup:
 *   GitHub  →  github.com/settings/developers → "New OAuth App"
 *     Callback URL: https://seowebsitesbuilder.com/api/oauth/github/callback
 *   Google  →  console.cloud.google.com → APIs & Services → Credentials → "OAuth 2.0 Client ID"
 *     Authorized redirect URI: https://seowebsitesbuilder.com/api/oauth/google/callback
 */

import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { one, query } from "./db";
import { scaffoldProjectDir } from "./docker";

export const oauthRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret";
const OAUTH_REDIRECT_BASE = (process.env.OAUTH_REDIRECT_BASE || "https://seowebsitesbuilder.com").replace(/\/$/, "");
const FRONTEND_CALLBACK = `${OAUTH_REDIRECT_BASE}/auth/callback`;

type Provider = "github" | "google";

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  userUrl: string;
  scope: string;
  clientId(): string | undefined;
  clientSecret(): string | undefined;
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl:     "https://github.com/login/oauth/access_token",
    userUrl:      "https://api.github.com/user",
    scope:        "read:user user:email",
    clientId:     () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
  },
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl:     "https://oauth2.googleapis.com/token",
    userUrl:      "https://www.googleapis.com/oauth2/v3/userinfo",
    scope:        "openid email profile",
    clientId:     () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
  },
};

function callbackUrl(provider: Provider): string {
  return `${OAUTH_REDIRECT_BASE}/api/oauth/${provider}/callback`;
}

function isConfigured(provider: Provider): boolean {
  const c = PROVIDERS[provider];
  return !!(c.clientId() && c.clientSecret());
}

function makeState(provider: Provider): string {
  return jwt.sign({ p: provider, scope: "oauth_state" }, JWT_SECRET, { expiresIn: "10m" });
}

function verifyState(state: string, provider: Provider): boolean {
  try {
    const p = jwt.verify(state, JWT_SECRET) as { p?: string; scope?: string };
    return p.scope === "oauth_state" && p.p === provider;
  } catch { return false; }
}

oauthRouter.get("/providers", (_req: Request, res: Response) => {
  res.json({
    providers: (["github", "google"] as Provider[]).map((p) => ({
      id: p, enabled: isConfigured(p),
    })),
  });
});

oauthRouter.get("/:provider/start", (req: Request, res: Response) => {
  const provider = req.params.provider as Provider;
  if (!(provider in PROVIDERS)) return res.status(404).json({ error: "Unknown provider" });
  if (!isConfigured(provider)) return res.status(503).json({ error: `${provider} OAuth is not configured on this orchestrator.` });

  const cfg = PROVIDERS[provider];
  const state = makeState(provider);
  const params = new URLSearchParams({
    client_id: cfg.clientId()!,
    redirect_uri: callbackUrl(provider),
    scope: cfg.scope,
    state,
    response_type: "code",
  });
  if (provider === "google") params.set("access_type", "online");
  return res.redirect(`${cfg.authorizeUrl}?${params.toString()}`);
});

oauthRouter.get("/:provider/callback", async (req: Request, res: Response) => {
  const provider = req.params.provider as Provider;
  if (!(provider in PROVIDERS)) return res.status(404).send("Unknown provider");
  if (!isConfigured(provider)) return res.status(503).send("OAuth not configured");

  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  if (!code || !verifyState(state, provider)) return res.status(400).send("Invalid OAuth state");

  const cfg = PROVIDERS[provider];

  // Exchange code → access_token
  let accessToken: string;
  try {
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId()!,
        client_secret: cfg.clientSecret()!,
        code,
        redirect_uri: callbackUrl(provider),
        grant_type: "authorization_code",
      }).toString(),
    });
    const body: any = await tokenRes.json();
    if (!tokenRes.ok || !body?.access_token) {
      console.error("[oauth] token exchange failed:", provider, tokenRes.status, body);
      return res.status(502).send(`OAuth token exchange failed: ${body?.error_description || body?.error || tokenRes.status}`);
    }
    accessToken = body.access_token;
  } catch (err: any) {
    console.error("[oauth] token exchange error:", provider, err?.message);
    return res.status(502).send("OAuth token exchange error");
  }

  // Fetch profile
  let profile: { id: string; email: string; name: string };
  try {
    if (provider === "github") {
      const [userRes, emailsRes] = await Promise.all([
        fetch(cfg.userUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "seowebsitesbuilder" } }),
        fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "seowebsitesbuilder" } }),
      ]);
      if (!userRes.ok) return res.status(502).send("GitHub user fetch failed");
      const u: any = await userRes.json();
      let email = u.email as string | null;
      if (!email && emailsRes.ok) {
        const emails: any[] = await emailsRes.json();
        const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
        email = primary?.email ?? null;
      }
      if (!email) return res.status(400).send("Could not retrieve a verified email from GitHub. Make sure you have a verified email on your GitHub account.");
      profile = { id: String(u.id), email: email.toLowerCase(), name: u.name || u.login || email };
    } else {
      const userRes = await fetch(cfg.userUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!userRes.ok) return res.status(502).send("Google userinfo fetch failed");
      const u: any = await userRes.json();
      if (!u.email || !u.email_verified) return res.status(400).send("Google returned no verified email");
      profile = { id: String(u.sub), email: String(u.email).toLowerCase(), name: u.name || u.given_name || u.email };
    }
  } catch (err: any) {
    console.error("[oauth] profile error:", provider, err?.message);
    return res.status(502).send("OAuth profile fetch error");
  }

  // Find or create
  let userId: string;
  const linked = await one<{ user_id: string }>(
    "SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2",
    [provider, profile.id],
  );
  if (linked) {
    userId = linked.user_id;
  } else {
    // Look up by email — link to existing account if it exists.
    const existing = await one<{ id: string }>("SELECT id FROM users WHERE email = $1", [profile.email]);
    if (existing) {
      userId = existing.id;
      await query(
        "INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [userId, provider, profile.id, profile.email],
      );
    } else {
      // Brand new user. password_hash stays NULL.
      const created = await one<{ id: string }>(
        "INSERT INTO users (email, password_hash, name) VALUES ($1, NULL, $2) RETURNING id",
        [profile.email, profile.name],
      );
      userId = created!.id;
      await query(
        "INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email) VALUES ($1, $2, $3, $4)",
        [userId, provider, profile.id, profile.email],
      );
      // Auto-create starter project, same as email signup.
      try {
        const starter = await one<{ id: string }>(
          `INSERT INTO projects (owner_id, name, slug, framework, backend, template_id)
           VALUES ($1, 'My first SEO site', 'my-first-site', 'html', 'none', 'html')
           RETURNING id`,
          [userId],
        );
        if (starter) await scaffoldProjectDir(starter.id, "html", "html");
      } catch (err) {
        console.warn(`[oauth ${provider}] starter scaffold failed for ${profile.email}:`, err);
      }
    }
  }

  const appToken = jwt.sign({ sub: userId, email: profile.email }, JWT_SECRET, { expiresIn: "7d" });
  // Hash carries the token so it never hits server logs / referrer headers.
  return res.redirect(`${FRONTEND_CALLBACK}#token=${appToken}`);
});
