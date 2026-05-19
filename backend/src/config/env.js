/**
 * Centralized env validation. Import after dotenv.config() in server.js.
 */
function requireEnv(name, { optional = false, defaultValue } = {}) {
  const value = process.env[name] ?? defaultValue;
  if (!optional && (value === undefined || value === "")) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function boolEnv(name, defaultValue = false) {
  const v = process.env[name];
  if (v === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3001", 10),
  isProd: process.env.NODE_ENV === "production",

  backendUrl: (process.env.BACKEND_URL || "http://localhost:3001").replace(/\/$/, ""),
  frontendUrl: (process.env.FRONTEND_URL || process.env.BACKEND_URL || "http://localhost:3001").replace(/\/$/, ""),

  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SHOPIFY_SCOPES?.split(",") || ["read_products", "write_products"],
  },

  webhookSecret: process.env.WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET,
  apiSecret: process.env.API_SECRET,
  apiKeyHeader: process.env.API_KEY_HEADER || "x-tryon-api-key",

  nanobananaApiKey: process.env.NANOBANANA_API_KEY,
  aiProvider: process.env.AI_PROVIDER || "nanobanana",

  // Feature flags
  useSupabase: boolEnv("USE_SUPABASE", false),
  useR2Storage: boolEnv("USE_R2_STORAGE", false),
  useAsyncJobs: boolEnv("USE_ASYNC_JOBS", false),
  enableJobWorker: boolEnv("ENABLE_JOB_WORKER", true),

  databaseUrl: process.env.DATABASE_URL,
  databaseUrlDirect: process.env.DIRECT_URL || process.env.DATABASE_URL_DIRECT,

  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME || "tryaura-uploads",
    publicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/$/, ""),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "10", 10),
    storefrontMax: parseInt(process.env.STOREFRONT_RATE_LIMIT_MAX || "5", 10),
  },

  upload: {
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10),
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || "image/jpeg,image/png,image/webp").split(","),
    ttlSeconds: parseInt(process.env.IMAGE_TTL_SECONDS || "3600", 10),
  },

  worker: {
    intervalMs: parseInt(process.env.JOB_WORKER_INTERVAL_MS || "2000", 10),
    batchSize: parseInt(process.env.JOB_WORKER_BATCH_SIZE || "3", 10),
    maxAttempts: parseInt(process.env.JOB_MAX_ATTEMPTS || "3", 10),
    retryBaseMs: parseInt(process.env.JOB_RETRY_BASE_MS || "5000", 10),
  },

  log: {
    level: process.env.LOG_LEVEL || "info",
    pretty: boolEnv("LOG_PRETTY", process.env.NODE_ENV !== "production"),
  },
};

function validateProduction() {
  if (!env.isProd) return;
  requireEnv("SHOPIFY_API_KEY");
  requireEnv("SHOPIFY_API_SECRET");
  requireEnv("API_SECRET");
  requireEnv("NANOBANANA_API_KEY");
  if (env.useSupabase) requireEnv("DATABASE_URL");
  if (env.useR2Storage) {
    requireEnv("R2_ACCOUNT_ID");
    requireEnv("R2_ACCESS_KEY_ID");
    requireEnv("R2_SECRET_ACCESS_KEY");
    requireEnv("R2_PUBLIC_URL");
  }
}

module.exports = { env, requireEnv, boolEnv, validateProduction };
