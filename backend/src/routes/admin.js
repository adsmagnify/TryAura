const express = require("express");
const stats = require("../services/stats");

const router = express.Router();

const DEFAULT_SETTINGS = {
  enabled: true,
  aiProvider: process.env.AI_PROVIDER || "nanobanana",
  buttonText: "Try This Dress",
  buttonColor: "#1a1a2e",
  maxDailyRequests: 100,
  watermarkEnabled: false,
  processingMessage: "Our AI is styling you...",
};

let settings = { ...DEFAULT_SETTINGS };

function requireAuth(req, res, next) {
  const headerName = (process.env.API_KEY_HEADER || "x-tryon-api-key").toLowerCase();
  if (!process.env.API_SECRET || req.headers[headerName] !== process.env.API_SECRET) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  return next();
}

router.get("/settings", requireAuth, (_req, res) => {
  res.json({ success: true, settings });
});

router.patch("/settings", requireAuth, (req, res) => {
  const allowed = [
    "enabled",
    "aiProvider",
    "buttonText",
    "buttonColor",
    "maxDailyRequests",
    "watermarkEnabled",
    "processingMessage",
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  settings = { ...settings, ...updates };
  res.json({ success: true, settings });
});

router.post("/settings/reset", requireAuth, (_req, res) => {
  settings = { ...DEFAULT_SETTINGS };
  res.json({ success: true, settings });
});

router.get("/settings/public", (_req, res) => {
  res.json({
    enabled: settings.enabled,
    buttonText: settings.buttonText,
    buttonColor: settings.buttonColor,
    processingMessage: settings.processingMessage,
  });
});

router.get("/stats", requireAuth, (_req, res) => {
  const s = stats.getStats();
  const successRate =
    s.totalJobs > 0 ? Math.round((s.successfulJobs / s.totalJobs) * 100) : 0;

  res.json({
    success: true,
    stats: {
      totalJobs: s.totalJobs,
      successfulJobs: s.successfulJobs,
      failedJobs: s.failedJobs,
      successRate,
      averageProcessingTimeMs: Math.round(s.averageProcessingTimeMs || 0),
      totalTryons: s.totalTryons,
      totalConversions: s.totalConversions,
      conversionRate: s.conversionRate,
      totalRevenue: s.totalRevenue,
      recentActivity: s.recentActivity,
      dailyUsage: s.dailyUsage,
    },
  });
});

module.exports = router;
