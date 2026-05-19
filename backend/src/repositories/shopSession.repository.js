/**
 * Shop session repository — Postgres when USE_SUPABASE=true, else falls back to auth.js file store.
 */
const { query } = require("../lib/db");
const { env } = require("../config/env");
const { logger } = require("../lib/logger");

// Lazy require to avoid circular dependency with auth.js
function getFileStore() {
  return require("../routes/auth");
}

async function getAccessToken(shop) {
  if (!env.useSupabase) {
    return getFileStore().getShopToken(shop);
  }

  const { rows } = await query(
    `SELECT access_token, expires_at FROM shop_sessions WHERE shop = $1`,
    [shop]
  );
  if (!rows[0]) return null;

  if (rows[0].expires_at && new Date(rows[0].expires_at) < new Date()) {
    await deleteSession(shop);
    return null;
  }
  return rows[0].access_token;
}

async function upsertSession(session) {
  if (!env.useSupabase) {
    getFileStore().setShopToken(session.shop, session.accessToken, session.scope);
    return;
  }

  const id = session.id || `offline_${session.shop}`;
  await query(
    `INSERT INTO shop_sessions (
      id, shop, state, is_online, scope, access_token, expires_at,
      user_id, first_name, last_name, email, account_owner, locale, collaborator
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (shop) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      scope = EXCLUDED.scope,
      expires_at = EXCLUDED.expires_at,
      state = EXCLUDED.state,
      is_online = EXCLUDED.is_online,
      updated_at = now()`,
    [
      id,
      session.shop,
      session.state || "",
      session.isOnline ?? false,
      session.scope || null,
      session.accessToken,
      session.expiresAt ? new Date(session.expiresAt) : null,
      session.userId || null,
      session.firstName || null,
      session.lastName || null,
      session.email || null,
      session.accountOwner ?? false,
      session.locale || null,
      session.collaborator ?? null,
    ]
  );
  logger.info({ shop: session.shop }, "Session upserted to Postgres");
}

async function deleteSession(shop) {
  if (!env.useSupabase) {
    getFileStore().deleteShopToken(shop);
    return;
  }
  await query(`DELETE FROM shop_sessions WHERE shop = $1`, [shop]);
  logger.info({ shop }, "Session deleted from Postgres");
}

async function loadSessionById(id) {
  if (!env.useSupabase) {
    const shop = id.replace(/^offline_/, "");
    const token = getFileStore().getShopToken(shop);
    if (!token) return null;
    return { id, shop, accessToken: token };
  }

  const { rows } = await query(`SELECT * FROM shop_sessions WHERE id = $1`, [id]);
  return rows[0] || null;
}

module.exports = { getAccessToken, upsertSession, deleteSession, loadSessionById };
