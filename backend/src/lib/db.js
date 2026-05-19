const { Pool } = require("pg");
const { env } = require("../config/env");
const { logger } = require("./logger");

let pool = null;

function getPool() {
  const url = env.databaseUrl || "";
  if (!url.startsWith("postgres")) return null;
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: env.databaseUrl,
      ssl: env.isProd ? { rejectUnauthorized: false } : undefined,
      max: env.isProd ? 10 : 3,
      idleTimeoutMillis: 30_000,
    });
    pool.on("error", (err) => logger.error({ err }, "Postgres pool error"));
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error("Database not configured (USE_SUPABASE=false)");
  return p.query(text, params);
}

async function withTransaction(fn) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getPool, query, withTransaction };
