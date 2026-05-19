/**
 * Unified Shopify session storage for the backend API.
 * Reads tokens written by the embedded app (Prisma Session table) or local fallbacks.
 * Does NOT use tokens.json shared with the frontend.
 */
const fs = require("fs");
const path = require("path");
const { env } = require("../config/env");
const { logger } = require("../lib/logger");

const DATA_DIR = path.join(__dirname, "../../data");
const FILE_STORE = path.join(DATA_DIR, "sessions.json");
const LEGACY_TOKENS = path.join(__dirname, "../../tokens.json");

let pgPool = null;
let sqliteDb = null;

function getPgPool() {
  if (!pgPool && env.databaseUrl) {
    const { Pool } = require("pg");
    pgPool = new Pool({
      connectionString: env.databaseUrl,
      ssl: env.isProd ? { rejectUnauthorized: false } : undefined,
      max: env.isProd ? 10 : 3,
    });
  }
  return pgPool;
}

function getSqliteDb() {
  if (sqliteDb) return sqliteDb;
  const sqlitePath =
    process.env.SQLITE_SESSION_PATH ||
    path.join(__dirname, "../../../ai-virtual-try-on/prisma/dev.db");

  if (!fs.existsSync(sqlitePath)) return null;

  try {
    const Database = require("better-sqlite3");
    sqliteDb = new Database(sqlitePath, { readonly: true });
    return sqliteDb;
  } catch (err) {
    logger.warn({ err: err.message }, "SQLite session DB unavailable");
    return null;
  }
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadFileStore() {
  ensureDataDir();
  if (fs.existsSync(FILE_STORE)) {
    return JSON.parse(fs.readFileSync(FILE_STORE, "utf8"));
  }
  // One-time migration from legacy tokens.json
  if (fs.existsSync(LEGACY_TOKENS)) {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_TOKENS, "utf8"));
    const migrated = {};
    for (const [shop, data] of Object.entries(legacy)) {
      migrated[shop] = {
        accessToken: data.accessToken,
        scope: data.scope,
        expiresAt: data.expiresAt,
      };
    }
    fs.writeFileSync(FILE_STORE, JSON.stringify(migrated, null, 2));
    logger.info("Migrated legacy tokens.json → data/sessions.json");
    return migrated;
  }
  return {};
}

function saveFileStore(data) {
  ensureDataDir();
  fs.writeFileSync(FILE_STORE, JSON.stringify(data, null, 2));
}

function storageMode() {
  const url = env.databaseUrl || "";
  if (url.startsWith("postgres")) {
    return "postgres";
  }
  if (getSqliteDb()) return "sqlite";
  return "file";
}

async function getAccessToken(shop) {
  const mode = storageMode();

  if (mode === "postgres") {
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT "accessToken", expires FROM "Session"
       WHERE shop = $1
       ORDER BY "expires" DESC NULLS LAST
       LIMIT 1`,
      [shop]
    );
    if (!rows[0]?.accessToken) return null;
    if (rows[0].expires && new Date(rows[0].expires) < new Date()) {
      await deleteSession(shop);
      return null;
    }
    return rows[0].accessToken;
  }

  if (mode === "sqlite") {
    const db = getSqliteDb();
    const row = db
      .prepare(`SELECT accessToken, expires FROM Session WHERE shop = ? ORDER BY expires DESC LIMIT 1`)
      .get(shop);
    if (!row?.accessToken) return null;
    if (row.expires && new Date(row.expires) < new Date()) return null;
    return row.accessToken;
  }

  const data = loadFileStore();
  const entry = data[shop];
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    delete data[shop];
    saveFileStore(data);
    return null;
  }
  return entry.accessToken;
}

async function setSession(shop, accessToken, scope) {
  const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
  const expiresAt = Date.now() + ONE_YEAR;

  const mode = storageMode();
  if (mode === "postgres") {
    const pool = getPgPool();
    const id = `offline_${shop}`;
    await pool.query(
      `INSERT INTO "Session" (id, shop, state, "isOnline", scope, expires, "accessToken")
       VALUES ($1, $2, 'sync', false, $3, to_timestamp($4 / 1000.0), $5)
       ON CONFLICT (id) DO UPDATE SET
         "accessToken" = EXCLUDED."accessToken",
         scope = EXCLUDED.scope,
         expires = EXCLUDED.expires`,
      [id, shop, scope || "", expiresAt, accessToken]
    );
    return;
  }

  if (mode === "sqlite") {
    logger.warn({ shop }, "Cannot write sessions to readonly SQLite; use embedded app OAuth");
    return;
  }

  const data = loadFileStore();
  data[shop] = { accessToken, scope, expiresAt };
  saveFileStore(data);
}

async function deleteSession(shop) {
  const mode = storageMode();

  if (mode === "postgres") {
    const pool = getPgPool();
    await pool.query(`DELETE FROM "Session" WHERE shop = $1`, [shop]);
    return;
  }

  if (mode === "file") {
    const data = loadFileStore();
    delete data[shop];
    saveFileStore(data);
  }
}

/** Sync wrapper for legacy call sites during migration */
function getShopTokenSync(shop) {
  // Used only where async isn't wired yet — prefer getAccessToken
  if (storageMode() === "file") {
    const data = loadFileStore();
    const entry = data[shop];
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) return null;
    return entry.accessToken;
  }
  return null;
}

module.exports = {
  getAccessToken,
  setSession,
  deleteSession,
  getShopTokenSync,
  storageMode,
};
