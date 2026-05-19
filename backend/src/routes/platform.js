const express = require("express");
const shopSettings = require("../services/shopSettings");
const { env } = require("../config/env");

const router = express.Router();

function requirePlatformAuth(req, res, next) {
  const headerName = (process.env.PLATFORM_ADMIN_HEADER || "x-platform-admin-key").toLowerCase();
  const key = req.headers[headerName];
  if (!env.platformAdminSecret || key !== env.platformAdminSecret) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  return next();
}

function normalizeShop(shop) {
  let s = String(shop).replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return s;
}

/** List all shops with settings + usage */
router.get("/shops", requirePlatformAuth, async (_req, res, next) => {
  try {
    await shopSettings.syncInstalledShops();
    const shops = await shopSettings.listShops();
    const rows = await Promise.all(
      shops.map(async (shop) => {
        const settings = await shopSettings.getSettings(shop);
        const usage = await shopSettings.getUsage(shop);
        const stats = await shopSettings.getShopStats(shop);
        return { shop, settings, usage, stats };
      })
    );
    res.json({ success: true, shops: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/shops/:shop", requirePlatformAuth, async (req, res, next) => {
  try {
    const shop = normalizeShop(req.params.shop);
    const settings = await shopSettings.getSettings(shop);
    const usage = await shopSettings.getUsage(shop);
    const stats = await shopSettings.getShopStats(shop);
    const activity = await shopSettings.getRecentActivity(shop, 20);
    res.json({ success: true, shop, settings, usage, stats, activity });
  } catch (err) {
    next(err);
  }
});

router.patch("/shops/:shop", requirePlatformAuth, async (req, res, next) => {
  try {
    const shop = normalizeShop(req.params.shop);
    const settings = await shopSettings.upsertSettings(
      shop,
      {
        enabled: req.body.enabled,
        aiProvider: req.body.aiProvider,
        buttonText: req.body.buttonText,
        buttonColor: req.body.buttonColor,
        maxDailyRequests: req.body.maxDailyRequests,
        monthlyGenerationLimit: req.body.monthlyGenerationLimit,
        watermarkEnabled: req.body.watermarkEnabled,
        processingMessage: req.body.processingMessage,
        plan: req.body.plan,
        platformNotes: req.body.platformNotes,
      },
      { platform: true }
    );
    const usage = await shopSettings.getUsage(shop);
    res.json({ success: true, shop, settings, usage });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
