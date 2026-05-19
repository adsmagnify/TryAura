const express = require("express");
const shopSettings = require("../services/shopSettings");

const router = express.Router();

function requireMerchantAuth(req, res, next) {
  const headerName = (process.env.API_KEY_HEADER || "x-tryon-api-key").toLowerCase();
  if (!process.env.API_SECRET || req.headers[headerName] !== process.env.API_SECRET) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  return next();
}

function requireShopParam(req, res, next) {
  const shop = req.query.shop || req.body.shop;
  if (!shop || !String(shop).includes(".myshopify.com")) {
    return res.status(400).json({ success: false, error: "Valid shop query param required" });
  }
  req.shop = String(shop).replace(/^https?:\/\//, "").replace(/\/$/, "");
  return next();
}

function camelToApi(body) {
  return {
    enabled: body.enabled,
    aiProvider: body.aiProvider,
    buttonText: body.buttonText,
    buttonColor: body.buttonColor,
    maxDailyRequests: body.maxDailyRequests,
    watermarkEnabled: body.watermarkEnabled,
    processingMessage: body.processingMessage,
  };
}

/** Merchant-scoped settings (embedded app passes ?shop=) */
router.get("/settings", requireMerchantAuth, requireShopParam, async (req, res, next) => {
  try {
    const settings = await shopSettings.getSettings(req.shop);
    const usage = await shopSettings.getUsage(req.shop);
    res.json({ success: true, settings, usage });
  } catch (err) {
    next(err);
  }
});

router.patch("/settings", requireMerchantAuth, requireShopParam, async (req, res, next) => {
  try {
    const settings = await shopSettings.upsertSettings(req.shop, camelToApi(req.body));
    const usage = await shopSettings.getUsage(req.shop);
    res.json({ success: true, settings, usage });
  } catch (err) {
    next(err);
  }
});

router.post("/settings/reset", requireMerchantAuth, requireShopParam, async (req, res, next) => {
  try {
    const settings = await shopSettings.resetSettings(req.shop);
    const usage = await shopSettings.getUsage(req.shop);
    res.json({ success: true, settings, usage });
  } catch (err) {
    next(err);
  }
});

/** Storefront widget — no auth, shop required */
router.get("/settings/public", async (req, res, next) => {
  try {
    const shop = req.query.shop;
    if (!shop || !String(shop).includes(".myshopify.com")) {
      return res.status(400).json({ success: false, error: "shop query param required" });
    }
    const normalized = String(shop).replace(/^https?:\/\//, "").replace(/\/$/, "");
    const settings = await shopSettings.getSettings(normalized);
    res.json({ success: true, settings: shopSettings.publicSettings(settings) });
  } catch (err) {
    next(err);
  }
});

/** Merchant-scoped stats */
router.get("/stats", requireMerchantAuth, requireShopParam, async (req, res, next) => {
  try {
    const stats = await shopSettings.getShopStats(req.shop);
    const usage = await shopSettings.getUsage(req.shop);
    const settings = await shopSettings.getSettings(req.shop);
    res.json({
      success: true,
      stats: {
        ...stats,
        dailyUsed: usage.dailyUsed,
        monthlyUsed: usage.monthlyUsed,
        dailyLimit: settings.maxDailyRequests,
        monthlyLimit: settings.monthlyGenerationLimit,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/activity", requireMerchantAuth, requireShopParam, async (req, res, next) => {
  try {
    const activity = await shopSettings.getRecentActivity(req.shop, 50);
    res.json({ success: true, activity });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
