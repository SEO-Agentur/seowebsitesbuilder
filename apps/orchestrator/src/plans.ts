/**
 * Plan catalog + quota lookups. The plan stored on subscriptions.plan is the
 * source of truth. New users default to 'free' until Stripe checkout completes.
 */

import { one } from "./db";

export type Plan = "free" | "solo" | "pro" | "agency";

export interface PlanLimits {
  id: Plan;
  name: string;
  priceMonthlyUSD: number;
  maxProjects: number;            // Infinity ≡ unlimited
  maxCustomDomains: number;
  maxSeats: number;
  publishOnSeosites: boolean;
  /** Null = never expires; otherwise the published site goes dark after N days. */
  publishExpiresAfterDays: number | null;
  /** .zip download, deploy adapters, GitHub export. Free is locked in to our hosting. */
  canExport: boolean;
  whiteLabel: boolean;
}

export const PLANS: Record<Plan, PlanLimits> = {
  free: {
    id: "free", name: "Free",
    priceMonthlyUSD: 0,
    maxProjects: 1, maxCustomDomains: 0, maxSeats: 1,
    publishOnSeosites: true, publishExpiresAfterDays: 7,
    canExport: false, whiteLabel: false,
  },
  solo: {
    id: "solo", name: "Solo",
    priceMonthlyUSD: 19,
    maxProjects: 3, maxCustomDomains: 3, maxSeats: 1,
    publishOnSeosites: true, publishExpiresAfterDays: null,
    canExport: true, whiteLabel: false,
  },
  pro: {
    id: "pro", name: "Pro",
    priceMonthlyUSD: 49,
    maxProjects: 10, maxCustomDomains: 10, maxSeats: 3,
    publishOnSeosites: true, publishExpiresAfterDays: null,
    canExport: true, whiteLabel: false,
  },
  agency: {
    id: "agency", name: "Agency",
    priceMonthlyUSD: 129,
    maxProjects: Infinity, maxCustomDomains: Infinity, maxSeats: 8,
    publishOnSeosites: true, publishExpiresAfterDays: null,
    canExport: true, whiteLabel: true,
  },
};

/** Shared 402 message used by every export-gated endpoint + UI tooltip. */
export const EXPORT_GATE_MSG = "Exporting, deploying, and Git push are on Solo, Pro, and Agency plans. Free is locked to our hosting on *.seosites.app.";

/** Express middleware: returns 402 if the authed user's plan can't export. */
import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./auth";
export async function requireExportPlan(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  // Admins bypass — operators need to exercise the full product.
  if (req.user!.is_admin) { next(); return; }
  const plan = await userPlan(req.user!.id);
  if (!PLANS[plan].canExport) {
    res.status(402).json({ error: EXPORT_GATE_MSG, plan, upgradeUrl: "/billing" });
    return;
  }
  next();
}

const PRICE_ID_ENV: Record<Plan, string | undefined> = {
  free: undefined,
  solo: "STRIPE_PRICE_SOLO",
  pro: "STRIPE_PRICE_PRO",
  agency: "STRIPE_PRICE_AGENCY",
};

export function stripePriceFor(plan: Plan): string | null {
  const envKey = PRICE_ID_ENV[plan];
  if (!envKey) return null;
  return process.env[envKey] || null;
}

/** Returns the user's current effective plan. Defaults to 'free' if no
 *  subscription row exists. Returns 'free' if the row exists but the
 *  subscription is canceled or past-due. */
export async function userPlan(userId: string): Promise<Plan> {
  const row = await one<{ plan: Plan; status: string; current_period_end: string | null }>(
    "SELECT plan, status, current_period_end FROM subscriptions WHERE user_id = $1",
    [userId],
  );
  if (!row) return "free";
  if (row.plan === "free") return "free";
  // Active or trialing — paid plan applies
  if (row.status === "active" || row.status === "trialing") {
    // Defensive: if period_end has passed and webhook hasn't fired yet, downgrade
    if (row.current_period_end && new Date(row.current_period_end) < new Date()) return "free";
    return row.plan;
  }
  return "free";
}
