// Next 14 instrumentation hook — runs once on server boot per runtime.
// Routes to the right Sentry config based on the runtime (node vs edge).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
