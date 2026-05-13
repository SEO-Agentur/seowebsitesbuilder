/**
 * Stripe billing: checkout, customer-portal, webhook, and a /me/plan endpoint.
 *
 * Required env vars to enable billing:
 *   STRIPE_SECRET_KEY        — sk_test_… or sk_live_…
 *   STRIPE_WEBHOOK_SECRET    — whsec_…
 *   STRIPE_PRICE_SOLO        — price_…
 *   STRIPE_PRICE_PRO         — price_…
 *   STRIPE_PRICE_AGENCY      — price_…
 *   BILLING_RETURN_URL       — defaults to https://seowebsitesbuilder.com/billing
 *
 * When STRIPE_SECRET_KEY is unset, checkout/portal endpoints return 503 and
 * the rest of the orchestrator boots fine — useful before billing goes live.
 *
 * The webhook handler MUST receive the raw request body to verify the
 * signature. We mount it BEFORE express.json() in index.ts via the special
 * `webhookRouter` exported here.
 */

import { Router, Request, Response, Application, raw } from "express";
import { z } from "zod";
import { AuthedRequest, requireAuth } from "./auth";
import { one, query } from "./db";
import { PLANS, Plan, stripePriceFor, userPlan } from "./plans";

const RETURN_URL = process.env.BILLING_RETURN_URL || "https://seowebsitesbuilder.com/billing";

let stripeInstance: any = null;
async function stripe(): Promise<any | null> {
  if (stripeInstance) return stripeInstance;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  const Stripe = (await import("stripe")).default;
  stripeInstance = new Stripe(secret, { apiVersion: "2024-11-20.acacia" as any });
  return stripeInstance;
}

export const billingRouter = Router();
billingRouter.use(requireAuth);

/** Helper — find or create the Stripe customer + the local subscription row. */
async function ensureCustomer(userId: string, email: string, name?: string | null): Promise<string> {
  const s = await stripe();
  if (!s) throw new Error("Stripe not configured");

  const existing = await one<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1",
    [userId],
  );
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await s.customers.create({
    email,
    name: name ?? undefined,
    metadata: { user_id: userId },
  });

  await query(
    `INSERT INTO subscriptions (user_id, stripe_customer_id, plan, status)
     VALUES ($1, $2, 'free', 'inactive')
     ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id`,
    [userId, customer.id],
  );
  return customer.id;
}

const CheckoutBody = z.object({ plan: z.enum(["solo", "pro", "agency"]) });

billingRouter.post("/checkout-session", async (req: AuthedRequest, res: Response) => {
  const s = await stripe();
  if (!s) return res.status(503).json({ error: "Billing not configured. Set STRIPE_SECRET_KEY on the orchestrator." });

  const parsed = CheckoutBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const priceId = stripePriceFor(parsed.data.plan);
  if (!priceId) return res.status(503).json({ error: `STRIPE_PRICE_${parsed.data.plan.toUpperCase()} env var is not set.` });

  try {
    const customerId = await ensureCustomer(req.user!.id, req.user!.email, req.user!.name);
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${RETURN_URL}?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${RETURN_URL}?canceled=1`,
      allow_promotion_codes: true,
      subscription_data: { metadata: { user_id: req.user!.id, plan: parsed.data.plan } },
    });
    return res.json({ url: session.url });
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || "Stripe checkout failed" });
  }
});

billingRouter.post("/portal", async (req: AuthedRequest, res: Response) => {
  const s = await stripe();
  if (!s) return res.status(503).json({ error: "Billing not configured" });
  try {
    const customerId = await ensureCustomer(req.user!.id, req.user!.email, req.user!.name);
    const session = await s.billingPortal.sessions.create({
      customer: customerId,
      return_url: RETURN_URL,
    });
    return res.json({ url: session.url });
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || "Portal failed" });
  }
});

/** Used by the frontend to render plan name + usage. */
billingRouter.get("/me", async (req: AuthedRequest, res: Response) => {
  const plan = await userPlan(req.user!.id);
  const limits = PLANS[plan];
  const projectCount = await one<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM projects WHERE owner_id = $1",
    [req.user!.id],
  );
  const sub = await one<{ current_period_end: string | null; status: string }>(
    "SELECT current_period_end, status FROM subscriptions WHERE user_id = $1",
    [req.user!.id],
  );
  return res.json({
    plan,
    limits: {
      maxProjects: limits.maxProjects === Infinity ? null : limits.maxProjects,
      maxCustomDomains: limits.maxCustomDomains === Infinity ? null : limits.maxCustomDomains,
      maxSeats: limits.maxSeats,
      publishOnSeosites: limits.publishOnSeosites,
      publishExpiresAfterDays: limits.publishExpiresAfterDays,
      canExport: limits.canExport,
      whiteLabel: limits.whiteLabel,
    },
    usage: { projects: parseInt(projectCount?.count ?? "0", 10) },
    subscription: {
      status: sub?.status ?? "inactive",
      currentPeriodEnd: sub?.current_period_end ?? null,
    },
    stripeReady: !!process.env.STRIPE_SECRET_KEY,
  });
});

/**
 * Webhook router — NO auth, NO json body parser. Mounted via mountWebhook()
 * which uses express.raw() so we can verify the Stripe signature.
 */
export function mountWebhook(app: Application): void {
  app.post(
    "/api/billing/webhook",
    raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const s = await stripe();
      const sig = req.headers["stripe-signature"];
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!s || !secret || !sig) {
        return res.status(503).send("Billing not configured");
      }
      let event: any;
      try {
        event = s.webhooks.constructEvent(req.body, sig as string, secret);
      } catch (err: any) {
        return res.status(400).send(`Webhook signature failed: ${err?.message || err}`);
      }

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object;
            const customerId = session.customer as string;
            const subscriptionId = session.subscription as string;
            const sub = await s.subscriptions.retrieve(subscriptionId);
            const planFromMeta = (sub.metadata?.plan as Plan) || "solo";
            await query(
              `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
               SELECT $1, $2, $3, $4, $5, to_timestamp($6)
               ON CONFLICT (user_id) DO UPDATE SET
                 stripe_subscription_id = EXCLUDED.stripe_subscription_id,
                 plan                   = EXCLUDED.plan,
                 status                 = EXCLUDED.status,
                 current_period_end     = EXCLUDED.current_period_end,
                 updated_at             = now()`,
              [
                sub.metadata?.user_id,
                customerId,
                subscriptionId,
                planFromMeta,
                sub.status,
                sub.current_period_end,
              ],
            );
            break;
          }
          case "customer.subscription.updated":
          case "customer.subscription.deleted": {
            const sub = event.data.object;
            const planFromMeta = (sub.metadata?.plan as Plan) || "free";
            const newPlan = event.type === "customer.subscription.deleted" ? "free" : planFromMeta;
            await query(
              `UPDATE subscriptions
                  SET status = $1,
                      plan = $2,
                      current_period_end = to_timestamp($3),
                      updated_at = now()
                WHERE stripe_subscription_id = $4`,
              [sub.status, newPlan, sub.current_period_end, sub.id],
            );
            break;
          }
          case "invoice.payment_failed": {
            const inv = event.data.object;
            await query(
              `UPDATE subscriptions SET status = 'past_due', updated_at = now() WHERE stripe_customer_id = $1`,
              [inv.customer],
            );
            break;
          }
        }
      } catch (err: any) {
        // Don't 500 — Stripe will retry indefinitely. Log and ack.
        console.error("[webhook]", event.type, "handler failed:", err?.message || err);
      }
      return res.json({ received: true });
    },
  );
}
