/**
 * Auth routes — embedded app is the canonical OAuth path.
 * Legacy /auth URLs redirect to the Shopify embedded app install flow.
 */
const express = require("express");
const sessionStore = require("../services/sessionStore");
const { shopify } = require("../shopify/client");
const { env } = require("../config/env");
const { logger } = require("../lib/logger");

const router = express.Router();

function isValidShopDomain(shop) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop || "");
}

function normalizeShop(shop) {
  if (!shop) return null;
  let s = String(shop).trim().toLowerCase();
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return s;
}

function embeddedInstallUrl(shop) {
  const appUrl = process.env.SHOPIFY_APP_URL || env.frontendUrl;
  return `${appUrl}/auth?shop=${encodeURIComponent(shop)}`;
}

/** Redirect legacy OAuth to embedded app */
function redirectToEmbeddedAuth(req, res) {
  const shop = normalizeShop(req.query.shop);
  if (!shop || !isValidShopDomain(shop)) {
    return res.status(400).json({
      success: false,
      error: "Provide a valid shop query param, e.g. ?shop=your-store.myshopify.com",
      installUrl: process.env.SHOPIFY_APP_URL
        ? `${process.env.SHOPIFY_APP_URL}/auth`
        : undefined,
    });
  }
  logger.info({ shop }, "Redirecting legacy /auth to embedded app OAuth");
  return res.redirect(embeddedInstallUrl(shop));
}

router.get("/", redirectToEmbeddedAuth);
router.get("/login", redirectToEmbeddedAuth);

/** Legacy callback — redirect to app */
router.get("/callback", (req, res) => {
  const shop = normalizeShop(req.query.shop);
  if (shop) return res.redirect(`${env.frontendUrl}/app?shop=${encodeURIComponent(shop)}`);
  return res.redirect(env.frontendUrl);
});

router.get("/status", async (req, res) => {
  const shop = normalizeShop(req.query.shop);
  if (!shop) return res.status(400).json({ success: false, error: "Missing shop parameter" });

  const token = await sessionStore.getAccessToken(shop);
  res.json({
    success: true,
    shop,
    authenticated: !!token,
    hasToken: !!token,
    storage: sessionStore.storageMode(),
  });
});

/** Removed token preview in production */
router.get("/token", async (req, res) => {
  if (env.isProd) {
    return res.status(404).json({ success: false, error: "Not found" });
  }
  const shop = normalizeShop(req.query.shop);
  if (!shop) return res.status(400).json({ success: false, error: "Missing shop" });
  const token = await sessionStore.getAccessToken(shop);
  if (!token) return res.status(404).json({ success: false, authenticated: false });
  res.json({ success: true, shop, hasToken: true });
});

router.post("/token/delete", async (req, res) => {
  const shop = normalizeShop(req.body.shop);
  if (!shop) return res.status(400).json({ success: false, error: "Missing shop" });
  await sessionStore.deleteSession(shop);
  res.json({ success: true, message: "Session deleted", shop });
});

router.get("/error", (req, res) => {
  res.status(400).json({
    success: false,
    error: req.query.error || "Authentication failed",
    shop: req.query.shop,
    help: "Install TryAura from Shopify Admin → Apps.",
  });
});

async function getShopToken(shop) {
  return sessionStore.getAccessToken(normalizeShop(shop));
}

async function setShopToken(shop, accessToken, scope) {
  return sessionStore.setSession(normalizeShop(shop), accessToken, scope);
}

async function deleteShopToken(shop) {
  return sessionStore.deleteSession(normalizeShop(shop));
}

module.exports = router;
module.exports.getShopToken = getShopToken;
module.exports.setShopToken = setShopToken;
module.exports.deleteShopToken = deleteShopToken;
module.exports.shopify = shopify;
