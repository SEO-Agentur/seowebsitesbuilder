/** @type {import('next').NextConfig} */
module.exports = {
  output: "export",
  reactStrictMode: true,
  // Force statically rendered pages — the whole point.
  experimental: { optimizeCss: true },
};
