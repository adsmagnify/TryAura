-- TryAura production schema (Supabase Postgres)
-- Run in Supabase SQL Editor or via supabase db push

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shopify sessions (replaces tokens.json + Prisma SQLite)
-- ---------------------------------------------------------------------------
CREATE TABLE shop_sessions (
  id              TEXT PRIMARY KEY,          -- e.g. offline_shop.myshopify.com
  shop            TEXT NOT NULL UNIQUE,
  state           TEXT,
  is_online       BOOLEAN NOT NULL DEFAULT false,
  scope           TEXT,
  access_token    TEXT NOT NULL,
  expires_at      TIMESTAMPTZ,
  user_id         BIGINT,
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT,
  account_owner   BOOLEAN DEFAULT false,
  locale          TEXT,
  collaborator    BOOLEAN,
  installed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX shop_sessions_shop_idx ON shop_sessions (shop);

-- ---------------------------------------------------------------------------
-- Async generation jobs (replaces blocking POST /api/tryon)
-- ---------------------------------------------------------------------------
CREATE TYPE generation_job_status AS ENUM (
  'queued',
  'processing',
  'retrying',
  'completed',
  'failed'
);

CREATE TABLE generation_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop                TEXT NOT NULL,
  status              generation_job_status NOT NULL DEFAULT 'queued',
  product_id          TEXT,
  product_type        TEXT,
  customer_id         TEXT,
  session_id          TEXT,                 -- storefront conversion tracking
  person_image_key    TEXT,                 -- R2 object key
  garment_image_key   TEXT,
  person_image_url    TEXT,                 -- public URL passed to NanoBanana
  garment_image_url   TEXT,
  result_image_key    TEXT,
  result_image_url    TEXT,
  provider            TEXT DEFAULT 'nanobanana',
  provider_task_id    TEXT,
  attempt_count       INT NOT NULL DEFAULT 0,
  max_attempts        INT NOT NULL DEFAULT 3,
  error_message       TEXT,
  error_code          TEXT,
  processing_time_ms  INT,
  idempotency_key     TEXT,                 -- client-supplied dedupe key
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  next_retry_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX generation_jobs_idempotency_idx
  ON generation_jobs (shop, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX generation_jobs_status_created_idx
  ON generation_jobs (status, created_at);

CREATE INDEX generation_jobs_shop_created_idx
  ON generation_jobs (shop, created_at DESC);

-- Worker claim query: SELECT ... FOR UPDATE SKIP LOCKED
CREATE INDEX generation_jobs_claim_idx
  ON generation_jobs (status, next_retry_at, created_at)
  WHERE status IN ('queued', 'retrying');

-- ---------------------------------------------------------------------------
-- Webhook idempotency (Shopify X-Shopify-Webhook-Id)
-- ---------------------------------------------------------------------------
CREATE TABLE webhook_events (
  id              TEXT PRIMARY KEY,         -- Shopify webhook ID
  shop            TEXT,
  topic           TEXT NOT NULL,
  payload_hash    TEXT,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'processed',  -- processed | failed
  error_message   TEXT
);

CREATE INDEX webhook_events_shop_topic_idx ON webhook_events (shop, topic);

-- ---------------------------------------------------------------------------
-- Usage / analytics (replaces stats.json)
-- ---------------------------------------------------------------------------
CREATE TABLE daily_shop_stats (
  shop            TEXT NOT NULL,
  stat_date       DATE NOT NULL,
  jobs_started    INT NOT NULL DEFAULT 0,
  jobs_succeeded  INT NOT NULL DEFAULT 0,
  jobs_failed     INT NOT NULL DEFAULT 0,
  conversions     INT NOT NULL DEFAULT 0,
  revenue_cents   BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (shop, stat_date)
);

CREATE TABLE tryon_sessions (
  id              TEXT PRIMARY KEY,
  shop            TEXT NOT NULL,
  product_id      TEXT,
  customer_id     TEXT,
  job_id          UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at    TIMESTAMPTZ,
  order_id        TEXT
);

CREATE INDEX tryon_sessions_customer_idx
  ON tryon_sessions (shop, customer_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shop_sessions_updated_at
  BEFORE UPDATE ON shop_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER generation_jobs_updated_at
  BEFORE UPDATE ON generation_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
