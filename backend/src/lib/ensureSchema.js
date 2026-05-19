/**
 * Ensures required Postgres tables exist (safe to run on every startup).
 */
const { query, getPool } = require("./db");
const { env } = require("../config/env");
const { logger } = require("./logger");

const SHOP_SETTINGS_SQL = `
CREATE TABLE IF NOT EXISTS shop_settings (
  shop                      TEXT PRIMARY KEY,
  enabled                   BOOLEAN NOT NULL DEFAULT true,
  ai_provider               TEXT NOT NULL DEFAULT 'nanobanana',
  button_text               TEXT NOT NULL DEFAULT 'Try This Dress',
  button_color              TEXT NOT NULL DEFAULT '#1a1a2e',
  max_daily_requests        INT NOT NULL DEFAULT 100,
  monthly_generation_limit  INT NOT NULL DEFAULT 500,
  watermark_enabled         BOOLEAN NOT NULL DEFAULT false,
  processing_message        TEXT NOT NULL DEFAULT 'Our AI is styling you...',
  plan                      TEXT NOT NULL DEFAULT 'free',
  platform_notes            TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_settings_plan_idx ON shop_settings (plan);
`;

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return true;
  const url = env.databaseUrl || "";
  if (!url.startsWith("postgres")) {
    logger.warn("DATABASE_URL not postgres — shop_settings use in-memory fallback");
    schemaReady = true;
    return false;
  }

  getPool();
  await query(SHOP_SETTINGS_SQL);
  schemaReady = true;
  logger.info("Database schema ready (shop_settings)");
  return true;
}

module.exports = { ensureSchema };
