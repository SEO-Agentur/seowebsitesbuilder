-- Seowebsitesbuilder Postgres schema.
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT,                                 -- nullable for OAuth-only accounts
  name          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Idempotent migration for existing databases where password_hash was NOT NULL.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Password reset tokens. Only the SHA-256 hash of the token is stored so a
-- DB leak can't be used to take over accounts. Tokens are single-use and
-- expire after 1 hour.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash  TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);

-- Admin-configurable settings for the trial AI pool ("3 free prompts on our
-- key" funnel). Singleton row enforced by CHECK constraint.
CREATE TABLE IF NOT EXISTS trial_ai_config (
  id                INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider          TEXT NOT NULL DEFAULT 'anthropic',
  model             TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  max_input_tokens  INT NOT NULL DEFAULT 1800,
  max_output_tokens INT NOT NULL DEFAULT 10000,
  daily_usd_cap     NUMERIC(10,2) NOT NULL DEFAULT 50.00,
  max_per_user      INT NOT NULL DEFAULT 3,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO trial_ai_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Per-call ledger: powers the daily $ cap, the per-user lifetime cap,
-- and the admin usage dashboard.
CREATE TABLE IF NOT EXISTS trial_ai_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model           TEXT NOT NULL,
  input_tokens    INT NOT NULL,
  output_tokens   INT NOT NULL,
  usd             NUMERIC(10,6) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trial_ai_usage_user   ON trial_ai_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_ai_usage_recent ON trial_ai_usage(created_at DESC);

-- OAuth provider accounts (GitHub, Google). A user can have multiple linked
-- providers, so signing in via either ends up at the same account.
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('github','google')),
  provider_user_id TEXT NOT NULL,
  email            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  framework       TEXT NOT NULL CHECK (framework IN ('html', 'astro', 'nextjs', 'php')),
  backend         TEXT NOT NULL DEFAULT 'none' CHECK (backend IN ('none', 'supabase', 'postgres', 'go')),
  container_id    TEXT,
  preview_port    INT,
  status          TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('stopped', 'starting', 'running', 'error')),
  seo_score       INT DEFAULT 0,
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);

-- Idempotent migrations for existing databases.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_request_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS models JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_id TEXT;
UPDATE projects SET template_id = framework WHERE template_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

CREATE TABLE IF NOT EXISTS files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, path)
);

CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);

-- Append-only history for the files table, populated by the file-write handler.
-- Used by the editor's "Restore version" dropdown. Capped per (project,path)
-- at the application layer (last 20 versions kept).
CREATE TABLE IF NOT EXISTS file_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  content      TEXT NOT NULL,
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_file_versions_lookup ON file_versions(project_id, path, saved_at DESC);

-- Public anonymous SEO audits ("paste any URL, get a free 100-point report").
-- Each row becomes a shareable indexable page at /audit/<id> on the marketing site.
CREATE TABLE IF NOT EXISTS audits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT NOT NULL,
  final_url   TEXT,
  status      INT,
  score       INT NOT NULL,
  report      JSONB NOT NULL,
  ip_hash     TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audits_fetched ON audits(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_ip      ON audits(ip_hash, fetched_at DESC);

-- Stripe subscriptions. One row per user. New users default to plan='free'
-- (1 project, 0 custom domains). Webhook keeps the row in sync with Stripe.
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  plan                   TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','solo','pro','agency')),
  status                 TEXT NOT NULL DEFAULT 'inactive',
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

-- Published projects served from *.seosites.app. One row per project (a
-- project may have one default slug; custom domains are tracked separately).
CREATE TABLE IF NOT EXISTS publishes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  slug            TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'live',  -- 'building', 'live', 'failed'
  build_log       TEXT,
  bytes_published INT,
  expires_at      TIMESTAMPTZ,                   -- null = never expires; set 7d out for free-plan publishes
  last_built_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE publishes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_publishes_expires ON publishes(expires_at) WHERE expires_at IS NOT NULL;

-- Custom domains attached to a publish. Caddy serves the same files but on
-- the user's own domain, with on-demand Let's Encrypt TLS.
CREATE TABLE IF NOT EXISTS custom_domains (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  publish_id   UUID NOT NULL REFERENCES publishes(id) ON DELETE CASCADE,
  domain       TEXT UNIQUE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending, verified, active
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_domains_user ON custom_domains(user_id);

CREATE TABLE IF NOT EXISTS deploys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target        TEXT NOT NULL,                    -- vercel, netlify, cloudflare, github, cpanel, zip
  url           TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending, building, success, failed
  log           TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deploys_project ON deploys(project_id);

-- Per-user AI provider keys (BYOK). Keys are AES-256-GCM encrypted with
-- KEY_ENCRYPTION_SECRET; the orchestrator decrypts in-memory at chat time
-- and the plaintext is never returned to the client.
CREATE TABLE IF NOT EXISTS user_ai_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('anthropic','openai','google','openai_compat')),
  encrypted_key   TEXT NOT NULL,
  base_url        TEXT,
  default_model   TEXT,
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_keys_user ON user_ai_keys(user_id);

-- Convenience: updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS files_updated_at ON files;
CREATE TRIGGER files_updated_at BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS user_ai_keys_updated_at ON user_ai_keys;
CREATE TRIGGER user_ai_keys_updated_at BEFORE UPDATE ON user_ai_keys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS publishes_updated_at ON publishes;
CREATE TRIGGER publishes_updated_at BEFORE UPDATE ON publishes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
