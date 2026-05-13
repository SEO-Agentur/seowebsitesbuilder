/**
 * Sentry error tracking. Active only when SENTRY_DSN is set in the env.
 * Without a DSN every export below is a no-op so the app boots identically
 * in dev or on a fresh VPS that hasn't been provisioned with Sentry yet.
 *
 * Side-effects on init (when DSN present):
 *   - global unhandled-rejection / uncaught-exception handlers
 *   - 10% trace sampling (overridable via SENTRY_TRACES_SAMPLE_RATE)
 *
 * Express handlers are exposed via setupExpress() — call it once on the
 * app before any routes are mounted. The error handler must be mounted
 * AFTER all routes; the orchestrator does both in src/index.ts.
 */
import * as Sentry from "@sentry/node";
import type { Application } from "express";

const dsn = process.env.SENTRY_DSN;
export const enabled = !!dsn;

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    // Don't ship PII unless explicitly opted in.
    sendDefaultPii: false,
  });
  console.log("[sentry] initialised");
} else {
  console.log("[sentry] disabled (SENTRY_DSN not set)");
}

/** Attach the Sentry request handler before routes. No-op when disabled. */
export function setupExpressRequest(app: Application): void {
  if (!enabled) return;
  Sentry.setupExpressErrorHandler(app);
}

/** Capture an exception without rethrowing. */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(err, { extra: context });
}

// Convenience re-exports so callsites import from one place.
export { Sentry };
