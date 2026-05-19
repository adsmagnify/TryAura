-- Per-shop merchant settings + platform generation quotas
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

DROP TRIGGER IF EXISTS shop_settings_updated_at ON shop_settings;
CREATE TRIGGER shop_settings_updated_at
  BEFORE UPDATE ON shop_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
