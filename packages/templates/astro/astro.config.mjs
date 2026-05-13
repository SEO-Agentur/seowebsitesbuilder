import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://example.com",
  integrations: [sitemap()],
  output: "static",
  build: { inlineStylesheets: "always" },
});
