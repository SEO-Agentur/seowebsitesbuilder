/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@seo/seo-engine"],
  experimental: {
    // Enables instrumentation.ts (where Sentry boots on the server).
    instrumentationHook: true,
  },
};

// Wrap with Sentry config only when a DSN is present, so a fresh checkout
// without Sentry env vars still builds and starts.
if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
  const { withSentryConfig } = require("@sentry/nextjs");
  module.exports = withSentryConfig(nextConfig, {
    silent: true,
    // Source-map upload only runs if SENTRY_AUTH_TOKEN is present; otherwise
    // a no-op warning is emitted and the build succeeds.
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true,
  });
} else {
  module.exports = nextConfig;
}
