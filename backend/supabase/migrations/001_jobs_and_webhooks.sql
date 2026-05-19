-- Run in Supabase SQL Editor AFTER Prisma migrate deploy (Session table).
-- Creates job queue + webhook idempotency tables for the API service.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE generation_job_status AS ENUM (
  'queued',
  'processing',
  'retrying',
  'completed',
  'failed'
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop                TEXT NOT NULL,
  status              generation_job_status NOT NULL DEFAULT 'queued',
  product_id          TEXT,
  product_type        TEXT,
  customer_id         TEXT,
  session_id          TEXT,
  person_image_key    TEXT,
  garment_image_key   TEXT,
  person_image_url    TEXT,
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
  idempotency_key     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  next_retry_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS generation_jobs_idempotency_idx
  ON generation_jobs (shop, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS generation_jobs_status_created_idx
  ON generation_jobs (status, created_at);

CREATE INDEX IF NOT EXISTS generation_jobs_claim_idx
  ON generation_jobs (status, next_retry_at, created_at)
  WHERE status IN ('queued', 'retrying');

CREATE TABLE IF NOT EXISTS webhook_events (
  id              TEXT PRIMARY KEY,
  shop            TEXT,
  topic           TEXT NOT NULL,
  payload_hash    TEXT,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'processed',
  error_message   TEXT
);

CREATE TABLE IF NOT EXISTS daily_shop_stats (
  shop            TEXT NOT NULL,
  stat_date       DATE NOT NULL,
  jobs_started    INT NOT NULL DEFAULT 0,
  jobs_succeeded  INT NOT NULL DEFAULT 0,
  jobs_failed     INT NOT NULL DEFAULT 0,
  conversions     INT NOT NULL DEFAULT 0,
  revenue_cents   BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (shop, stat_date)
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generation_jobs_updated_at ON generation_jobs;
CREATE TRIGGER generation_jobs_updated_at
  BEFORE UPDATE ON generation_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
