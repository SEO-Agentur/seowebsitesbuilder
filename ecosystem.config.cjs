// pm2 process definitions for the production VPS.
//
// Secrets (DATABASE_URL, JWT_SECRET, KEY_ENCRYPTION_SECRET, TRIAL_ANTHROPIC_API_KEY,
// ADMIN_EMAIL, RESEND_API_KEY) live in /opt/seowebsitesbuilder/.env (mode 600)
// and are read at pm2 boot. This file is committed to git; .env never is.
//
// Non-secret defaults (paths, ports, public hostnames) stay inline here so
// fresh VPS provisioning works with just a populated .env.
const fs = require("fs");

const envPath = "/opt/seowebsitesbuilder/.env";
const fileEnv = (() => {
  try {
    const out = {};
    for (const raw of fs.readFileSync(envPath, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
})();

function need(key) {
  const v = fileEnv[key];
  if (!v) {
    console.warn(`[ecosystem] missing ${key} in ${envPath}`);
  }
  return v || "";
}

module.exports = {
  apps: [
    {
      name: "seo-orchestrator",
      cwd: "/opt/seowebsitesbuilder/apps/orchestrator",
      script: "./node_modules/.bin/tsx",
      args: "src/index.ts",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
        PROJECT_VOLUMES_DIR: "/var/seobuilder/projects",
        TEMPLATES_DIR: "/opt/seowebsitesbuilder/packages/templates",
        VPS_IP: "187.77.74.66",
        SEOSITES_ROOT: "/var/seosites",
        DYNAMIC_CADDY_PATH: "/etc/caddy/dynamic.caddy",
        PUBLIC_WEB_URL: "https://seowebsitesbuilder.com",
        // Secrets — from .env
        DATABASE_URL: need("DATABASE_URL"),
        JWT_SECRET: need("JWT_SECRET"),
        KEY_ENCRYPTION_SECRET: need("KEY_ENCRYPTION_SECRET"),
        TRIAL_ANTHROPIC_API_KEY: fileEnv.TRIAL_ANTHROPIC_API_KEY || "",
        ADMIN_EMAIL: fileEnv.ADMIN_EMAIL || "",
        RESEND_API_KEY: fileEnv.RESEND_API_KEY || "",
        EMAIL_FROM: fileEnv.EMAIL_FROM || "Seowebsitesbuilder <noreply@seowebsitesbuilder.com>",
      },
      max_memory_restart: "500M",
    },
    {
      name: "seo-web",
      cwd: "/opt/seowebsitesbuilder/apps/web",
      script: "./node_modules/.bin/next",
      args: "start --port 3000 --hostname 127.0.0.1",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        // NEXT_PUBLIC_* must also be present at build time
        // (see apps/web/.env.production)
        NEXT_PUBLIC_ORCHESTRATOR_URL: "https://seowebsitesbuilder.com",
      },
      max_memory_restart: "400M",
    },
  ],
};
