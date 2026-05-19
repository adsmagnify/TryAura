const { query } = require("../lib/db");
const { env } = require("../config/env");

const memorySeen = new Set(); // dev fallback when USE_SUPABASE=false

async function isProcessed(webhookId) {
  if (!env.useSupabase) {
    return memorySeen.has(webhookId);
  }
  const { rows } = await query(`SELECT 1 FROM webhook_events WHERE id = $1`, [webhookId]);
  return rows.length > 0;
}

async function markProcessed({ id, shop, topic, payloadHash, status = "processed", errorMessage }) {
  if (!env.useSupabase) {
    memorySeen.add(id);
    return;
  }
  await query(
    `INSERT INTO webhook_events (id, shop, topic, payload_hash, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [id, shop, topic, payloadHash || null, status, errorMessage || null]
  );
}

module.exports = { isProcessed, markProcessed };
