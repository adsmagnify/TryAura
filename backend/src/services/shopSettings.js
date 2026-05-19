/**
 * Per-shop settings stored in Postgres (shop_settings) with in-memory fallback.
 */
const { query } = require("../lib/db");
const { ensureSchema } = require("../lib/ensureSchema");
const { env } = require("../config/env");
const { logger } = require("../lib/logger");

const DEFAULTS = {
  enabled: true,
  aiProvider: "nanobanana",
  buttonText: "Try This Dress",
  buttonColor: "#1a1a2e",
  maxDailyRequests: 100,
  monthlyGenerationLimit: 500,
  watermarkEnabled: false,
  processingMessage: "Our AI is styling you...",
  plan: "free",
  platformNotes: null,
};

const MERCHANT_FIELDS = [
  "enabled",
  "aiProvider",
  "buttonText",
  "buttonColor",
  "maxDailyRequests",
  "watermarkEnabled",
  "processingMessage",
];

const PLATFORM_FIELDS = [
  ...MERCHANT_FIELDS,
  "monthlyGenerationLimit",
  "plan",
  "platformNotes",
];

const memory = new Map();

function usePostgres() {
  return Boolean((env.databaseUrl || "").startsWith("postgres"));
}

async function withDb() {
  if (!usePostgres()) return false;
  await ensureSchema();
  return true;
}

function rowToSettings(row) {
  if (!row) return null;
  return {
    shop: row.shop,
    enabled: row.enabled,
    aiProvider: row.ai_provider,
    buttonText: row.button_text,
    buttonColor: row.button_color,
    maxDailyRequests: row.max_daily_requests,
    monthlyGenerationLimit: row.monthly_generation_limit,
    watermarkEnabled: row.watermark_enabled,
    processingMessage: row.processing_message,
    plan: row.plan,
    platformNotes: row.platform_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function settingsToRow(shop, settings) {
  return {
    shop,
    enabled: settings.enabled ?? DEFAULTS.enabled,
    ai_provider: settings.aiProvider ?? DEFAULTS.aiProvider,
    button_text: settings.buttonText ?? DEFAULTS.buttonText,
    button_color: settings.buttonColor ?? DEFAULTS.buttonColor,
    max_daily_requests: settings.maxDailyRequests ?? DEFAULTS.maxDailyRequests,
    monthly_generation_limit: settings.monthlyGenerationLimit ?? DEFAULTS.monthlyGenerationLimit,
    watermark_enabled: settings.watermarkEnabled ?? DEFAULTS.watermarkEnabled,
    processing_message: settings.processingMessage ?? DEFAULTS.processingMessage,
    plan: settings.plan ?? DEFAULTS.plan,
    platform_notes: settings.platformNotes ?? null,
  };
}

function mergeDefaults(shop, partial = {}) {
  return {
    shop,
    ...DEFAULTS,
    ...partial,
  };
}

async function listSessionShops() {
  if (!(await withDb())) return [];
  try {
    const { rows } = await query(
      `SELECT DISTINCT shop FROM "Session" WHERE shop IS NOT NULL AND shop <> '' ORDER BY shop`
    );
    return rows.map((r) => r.shop);
  } catch (err) {
    logger.warn({ err: err.message }, "Could not read Session table");
    return [];
  }
}

/** Ensure a shop_settings row exists for every installed store (from OAuth Session table). */
async function syncInstalledShops() {
  if (!(await withDb())) return [];
  const shops = await listSessionShops();
  for (const shop of shops) {
    await ensureShopRecord(shop);
  }
  return shops;
}

async function ensureShopRecord(shop) {
  if (!(await withDb())) return;
  await query(`INSERT INTO shop_settings (shop) VALUES ($1) ON CONFLICT (shop) DO NOTHING`, [shop]);
}

async function getSettings(shop) {
  if (!shop) throw new Error("shop is required");

  if (await withDb()) {
    await ensureShopRecord(shop);
    const { rows } = await query(`SELECT * FROM shop_settings WHERE shop = $1`, [shop]);
    if (rows[0]) return rowToSettings(rows[0]);
    return mergeDefaults(shop);
  }

  return memory.get(shop) || mergeDefaults(shop);
}

async function upsertSettings(shop, updates, { platform = false } = {}) {
  const allowed = platform ? PLATFORM_FIELDS : MERCHANT_FIELDS;
  const current = await getSettings(shop);
  const next = { ...current };

  for (const key of allowed) {
    if (updates[key] !== undefined) next[key] = updates[key];
  }

  if (!platform && next.maxDailyRequests > current.monthlyGenerationLimit) {
    next.maxDailyRequests = current.monthlyGenerationLimit;
  }

  if (await withDb()) {
    const row = settingsToRow(shop, next);
    await query(
      `INSERT INTO shop_settings (
        shop, enabled, ai_provider, button_text, button_color,
        max_daily_requests, monthly_generation_limit, watermark_enabled,
        processing_message, plan, platform_notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (shop) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        ai_provider = EXCLUDED.ai_provider,
        button_text = EXCLUDED.button_text,
        button_color = EXCLUDED.button_color,
        max_daily_requests = EXCLUDED.max_daily_requests,
        monthly_generation_limit = EXCLUDED.monthly_generation_limit,
        watermark_enabled = EXCLUDED.watermark_enabled,
        processing_message = EXCLUDED.processing_message,
        plan = EXCLUDED.plan,
        platform_notes = EXCLUDED.platform_notes,
        updated_at = now()`,
      [
        row.shop,
        row.enabled,
        row.ai_provider,
        row.button_text,
        row.button_color,
        row.max_daily_requests,
        row.monthly_generation_limit,
        row.watermark_enabled,
        row.processing_message,
        row.plan,
        row.platform_notes,
      ]
    );
    return getSettings(shop);
  }

  memory.set(shop, next);
  return next;
}

async function resetSettings(shop) {
  if (await withDb()) {
    await query(`DELETE FROM shop_settings WHERE shop = $1`, [shop]);
    await ensureShopRecord(shop);
  } else {
    memory.delete(shop);
  }
  return getSettings(shop);
}

async function listShops() {
  if (await withDb()) {
    await syncInstalledShops();
    const { rows } = await query(`SELECT shop FROM shop_settings ORDER BY shop`);
    return rows.map((r) => r.shop);
  }
  return [...new Set([...memory.keys()])];
}

async function getUsage(shop) {
  if (!(await withDb())) {
    return { dailyUsed: 0, monthlyUsed: 0 };
  }

  try {
    const { rows } = await query(
      `SELECT
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) AS daily_used,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) AS monthly_used
       FROM generation_jobs
       WHERE shop = $1`,
      [shop]
    );

    return {
      dailyUsed: parseInt(rows[0]?.daily_used || "0", 10),
      monthlyUsed: parseInt(rows[0]?.monthly_used || "0", 10),
    };
  } catch {
    return { dailyUsed: 0, monthlyUsed: 0 };
  }
}

async function assertCanGenerate(shop) {
  const settings = await getSettings(shop);
  if (!settings.enabled) {
    const err = new Error("Virtual try-on is disabled for this store.");
    err.status = 403;
    throw err;
  }

  const usage = await getUsage(shop);
  if (usage.dailyUsed >= settings.maxDailyRequests) {
    const err = new Error("Daily try-on limit reached. Try again tomorrow.");
    err.status = 429;
    throw err;
  }
  if (usage.monthlyUsed >= settings.monthlyGenerationLimit) {
    const err = new Error("Monthly generation limit reached for this store.");
    err.status = 429;
    throw err;
  }

  return { settings, usage };
}

async function getShopStats(shop) {
  if (!(await withDb())) {
    return {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      successRate: 0,
      averageProcessingTimeMs: 0,
    };
  }

  try {
    const { rows } = await query(
      `SELECT
        COUNT(*) AS total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed') AS successful_jobs,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_jobs,
        COALESCE(AVG(processing_time_ms) FILTER (WHERE status = 'completed'), 0) AS avg_ms
       FROM generation_jobs
       WHERE shop = $1`,
      [shop]
    );

    const totalJobs = parseInt(rows[0]?.total_jobs || "0", 10);
    const successfulJobs = parseInt(rows[0]?.successful_jobs || "0", 10);
    const failedJobs = parseInt(rows[0]?.failed_jobs || "0", 10);
    const successRate = totalJobs > 0 ? Math.round((successfulJobs / totalJobs) * 100) : 0;

    return {
      totalJobs,
      successfulJobs,
      failedJobs,
      successRate,
      averageProcessingTimeMs: Math.round(parseFloat(rows[0]?.avg_ms || "0")),
    };
  } catch {
    return {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      successRate: 0,
      averageProcessingTimeMs: 0,
    };
  }
}

async function getRecentActivity(shop, limit = 20) {
  if (!(await withDb())) return [];

  try {
    const { rows } = await query(
      `SELECT id, shop, status, product_id, customer_id, session_id,
              error_message, processing_time_ms, created_at, completed_at
       FROM generation_jobs
       WHERE shop = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [shop, limit]
    );

    return rows.map((row) => ({
      id: row.id,
      shop: row.shop,
      status: row.status,
      productId: row.product_id,
      customerId: row.customer_id,
      sessionId: row.session_id,
      error: row.error_message,
      processingTimeMs: row.processing_time_ms,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
  } catch (err) {
    logger.warn({ err: err.message, shop }, "Could not load recent activity");
    return [];
  }
}

function publicSettings(settings) {
  return {
    enabled: settings.enabled,
    buttonText: settings.buttonText,
    buttonColor: settings.buttonColor,
    processingMessage: settings.processingMessage,
  };
}

module.exports = {
  DEFAULTS,
  MERCHANT_FIELDS,
  PLATFORM_FIELDS,
  getSettings,
  upsertSettings,
  resetSettings,
  listShops,
  syncInstalledShops,
  ensureShopRecord,
  getUsage,
  assertCanGenerate,
  getShopStats,
  getRecentActivity,
  publicSettings,
};
