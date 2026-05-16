import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { z } from "zod";
import { one, query } from "./db";
import { sendEmail } from "./email";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret";
const JWT_EXPIRES_IN = "7d";

export interface User {
  id: string;
  email: string;
  name: string | null;
  is_admin?: boolean;
}

/** Auto-promote a user to admin if their email matches ADMIN_EMAIL env var.
 *  Idempotent; safe to call on every login/signup. */
async function maybePromoteAdmin(email: string): Promise<void> {
  const target = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (!target) return;
  if (email.toLowerCase() !== target) return;
  try {
    await query("UPDATE users SET is_admin = true WHERE email = $1 AND is_admin = false", [email]);
  } catch (err) {
    console.warn(`[auth] admin promotion failed for ${email}:`, err);
  }
}

export interface AuthedRequest extends Request {
  user?: User;
}

const SignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().max(100).optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post("/signup", async (req: Request, res: Response) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, name } = parsed.data;

  const existing = await one<User>("SELECT id FROM users WHERE email = $1", [email]);
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const password_hash = await bcrypt.hash(password, 12);
  const user = await one<User>(
    "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name",
    [email, password_hash, name ?? null],
  );
  if (!user) return res.status(500).json({ error: "Failed to create user" });

  // No starter project is seeded any more — the hero-prompt + /onboarding
  // flow IS the new-user's first project. Auto-seeding here would use up
  // the Free plan's 1-project quota, so onboarding would 402 immediately.

  await maybePromoteAdmin(user.email);
  // Re-read so the returned object reflects an immediate admin promotion.
  const fresh = await one<User & { is_admin: boolean }>(
    "SELECT id, email, name, is_admin FROM users WHERE id = $1",
    [user.id],
  );
  const finalUser: User = fresh ?? user;
  const token = jwt.sign({ sub: finalUser.id, email: finalUser.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return res.status(201).json({ token, user: finalUser });
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const row = await one<{ id: string; email: string; name: string | null; password_hash: string | null }>(
    "SELECT id, email, name, password_hash FROM users WHERE email = $1",
    [email],
  );
  if (!row) return res.status(401).json({ error: "Invalid credentials" });
  if (!row.password_hash) {
    return res.status(401).json({ error: "This account was created with OAuth — sign in with GitHub or Google instead." });
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  await maybePromoteAdmin(row.email);
  // Reload to surface is_admin (may have just been promoted)
  const fresh = await one<User & { is_admin: boolean }>(
    "SELECT id, email, name, is_admin FROM users WHERE id = $1",
    [row.id],
  );
  const user: User = fresh ?? { id: row.id, email: row.email, name: row.name };
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return res.json({ token, user });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res: Response) => {
  return res.json({ user: req.user });
});

// ─── Password reset ──────────────────────────────────────────────────────────

const ForgotBody = z.object({ email: z.string().email() });
const ResetBody = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(200),
});

/** Public base URL for links in outbound emails. */
function publicWebUrl(): string {
  return process.env.PUBLIC_WEB_URL?.replace(/\/$/, "") || "https://seowebsitesbuilder.com";
}

function hashToken(t: string): string {
  return crypto.createHash("sha256").update(t).digest("hex");
}

authRouter.post("/forgot-password", async (req: Request, res: Response) => {
  const parsed = ForgotBody.safeParse(req.body);
  // Always return ok so attackers can't enumerate which emails are registered.
  if (!parsed.success) return res.json({ ok: true });
  const { email } = parsed.data;

  const user = await one<{ id: string; email: string; name: string | null }>(
    "SELECT id, email, name FROM users WHERE email = $1",
    [email],
  );
  if (!user) return res.json({ ok: true });

  const token = crypto.randomBytes(32).toString("hex"); // 64 chars
  const tokenHash = hashToken(token);
  await query(
    `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + interval '1 hour')`,
    [tokenHash, user.id],
  );

  const link = `${publicWebUrl()}/reset-password?token=${token}`;
  const subject = "Reset your Seowebsitesbuilder password";
  const html = `<p>Hi${user.name ? " " + escapeHtml(user.name) : ""},</p>
    <p>Click the link below to choose a new password. The link expires in 1 hour.</p>
    <p><a href="${link}">${link}</a></p>
    <p>If you didn&apos;t request this, you can ignore this email.</p>`;
  const text = `Reset link (expires in 1 hour): ${link}`;
  await sendEmail({ to: user.email, subject, html, text });

  return res.json({ ok: true });
});

authRouter.post("/reset-password", async (req: Request, res: Response) => {
  const parsed = ResetBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { token, password } = parsed.data;

  const tokenHash = hashToken(token);
  const row = await one<{ user_id: string; expires_at: Date; used_at: Date | null }>(
    "SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1",
    [tokenHash],
  );
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "This reset link is invalid or expired. Request a new one." });
  }

  const password_hash = await bcrypt.hash(password, 12);
  await query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [password_hash, row.user_id]);
  await query("UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1", [tokenHash]);
  // Invalidate any other outstanding tokens for the same user.
  await query(
    "UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL",
    [row.user_id],
  );
  return res.json({ ok: true });
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ─── /me ─────────────────────────────────────────────────────────────────────

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing bearer token" });
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    one<User>("SELECT id, email, name, is_admin FROM users WHERE id = $1", [payload.sub])
      .then((user) => {
        if (!user) return res.status(401).json({ error: "User not found" });
        req.user = user;
        next();
      })
      .catch((err) => res.status(500).json({ error: "Auth lookup failed", detail: String(err) }));
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function verifyTokenString(token: string): { sub: string; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
  } catch {
    return null;
  }
}
