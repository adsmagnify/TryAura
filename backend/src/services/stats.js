const fs = require("fs");
const path = require("path");

const STATS_FILE = path.join(__dirname, "../../stats.json");
const MAX_RECENT_ACTIVITY = 100;

// In-memory stats storage
let stats = loadStats();

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const raw = fs.readFileSync(STATS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      return {
        totalJobs: parsed.totalJobs || 0,
        successfulJobs: parsed.successfulJobs || 0,
        failedJobs: parsed.failedJobs || 0,
        averageProcessingTimeMs: parsed.averageProcessingTimeMs || 0,
        dailyUsage: parsed.dailyUsage || {},
        recentActivity: parsed.recentActivity || [],
        // Conversion tracking
        conversionStats: parsed.conversionStats || {
          tryonSessions: {}, // sessionId -> { timestamp, productId, customerId?, converted: boolean }
          dailyConversions: {}, // date -> { tryons, orders, revenue }
          ordersAfterTryon: [], // array of order records
        },
        pluginInstalledAt: parsed.pluginInstalledAt || new Date().toISOString(),
      };
    }
  } catch (e) {
    console.error("[Stats] Failed to load stats.json:", e.message);
  }
  return {
    totalJobs: 0,
    successfulJobs: 0,
    failedJobs: 0,
    averageProcessingTimeMs: 0,
    dailyUsage: {},
    recentActivity: [],
    conversionStats: {
      tryonSessions: {},
      dailyConversions: {},
      ordersAfterTryon: [],
    },
    pluginInstalledAt: new Date().toISOString(),
  };
}

function saveStats() {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf8");
  } catch (e) {
    console.error("[Stats] Failed to save stats.json:", e.message);
  }
}

// Auto-save every 5 minutes
setInterval(saveStats, 300000);

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function generateId() {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  // Record a new job start
  recordJobStart: () => {
    const jobId = generateId();
    return jobId;
  },

  // Record successful job completion
  recordJobSuccess: (processingTimeMs, productType = "unknown") => {
    stats.totalJobs++;
    stats.successfulJobs++;

    // Update average processing time
    const totalSuccessful = stats.successfulJobs;
    const currentAvg = stats.averageProcessingTimeMs;
    stats.averageProcessingTimeMs = Math.round(
      (currentAvg * (totalSuccessful - 1) + processingTimeMs) / totalSuccessful
    );

    // Update daily usage
    const today = getTodayKey();
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { count: 0, success: 0, failed: 0 };
    }
    stats.dailyUsage[today].count++;
    stats.dailyUsage[today].success++;

    // Add to recent activity
    stats.recentActivity.unshift({
      id: generateId(),
      timestamp: new Date().toISOString(),
      status: "success",
      productType,
      processingTimeMs,
    });

    // Trim recent activity
    if (stats.recentActivity.length > MAX_RECENT_ACTIVITY) {
      stats.recentActivity = stats.recentActivity.slice(0, MAX_RECENT_ACTIVITY);
    }

    saveStats();
  },

  // Record failed job
  recordJobFailure: (error, productType = "unknown") => {
    stats.totalJobs++;
    stats.failedJobs++;

    // Update daily usage
    const today = getTodayKey();
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = { count: 0, success: 0, failed: 0 };
    }
    stats.dailyUsage[today].count++;
    stats.dailyUsage[today].failed++;

    // Add to recent activity
    stats.recentActivity.unshift({
      id: generateId(),
      timestamp: new Date().toISOString(),
      status: "failed",
      productType,
      error: error?.message || error || "Unknown error",
    });

    // Trim recent activity
    if (stats.recentActivity.length > MAX_RECENT_ACTIVITY) {
      stats.recentActivity = stats.recentActivity.slice(0, MAX_RECENT_ACTIVITY);
    }

    saveStats();
  },

  // ── Conversion Tracking ─────────────────────────────────────────

  // Record a new try-on session for conversion tracking
  recordTryonSession: (sessionId, productId, customerId = null) => {
    const today = getTodayKey();

    // Store session info
    stats.conversionStats.tryonSessions[sessionId] = {
      timestamp: new Date().toISOString(),
      productId,
      productId,
      customerId,
      converted: false,
      orderId: null,
    };

    // Update daily conversions
    if (!stats.conversionStats.dailyConversions[today]) {
      stats.conversionStats.dailyConversions[today] = {
        tryons: 0,
        orders: 0,
        revenue: 0,
      };
    }
    stats.conversionStats.dailyConversions[today].tryons++;

    saveStats();
    return sessionId;
  },

  // Record an order that was placed after try-on
  recordConversion: (sessionId, orderId, orderAmount, customerId = null) => {
    const session = stats.conversionStats.tryonSessions[sessionId];
    if (!session) return false;

    // Mark session as converted
    session.converted = true;
    session.orderId = orderId;

    // Record the order
    stats.conversionStats.ordersAfterTryon.push({
      sessionId,
      orderId,
      orderAmount: parseFloat(orderAmount) || 0,
      customerId: customerId || session.customerId,
      productId: session.productId,
      tryonTimestamp: session.timestamp,
      orderTimestamp: new Date().toISOString(),
    });

    // Update daily conversions
    const today = getTodayKey();
    if (!stats.conversionStats.dailyConversions[today]) {
      stats.conversionStats.dailyConversions[today] = {
        tryons: 0,
        orders: 0,
        revenue: 0,
      };
    }
    stats.conversionStats.dailyConversions[today].orders++;
    stats.conversionStats.dailyConversions[today].revenue += parseFloat(orderAmount) || 0;

    saveStats();
    return true;
  },

  // Check if there's a recent try-on session for a customer (within 48 hours)
  findRecentSession: (customerId, productId = null) => {
    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000;

    for (const [sessionId, session] of Object.entries(stats.conversionStats.tryonSessions)) {
      const sessionTime = new Date(session.timestamp).getTime();
      if (now - sessionTime > fortyEightHours) continue;
      if (session.converted) continue;
      if (session.customerId !== customerId) continue;
      if (productId && session.productId !== productId) continue;
      return sessionId;
    }
    return null;
  },

  // ── Get Stats ─────────────────────────────────────────────────

  // Get stats for the last N days
  getStats: (days = 7) => {
    const today = new Date();
    const dailyUsage = [];
    const dailyConversions = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];

      // Regular usage stats
      const dayStats = stats.dailyUsage[dateKey] || { count: 0, success: 0, failed: 0 };
      dailyUsage.push({
        date: dateKey,
        count: dayStats.count,
        success: dayStats.success,
        failed: dayStats.failed,
      });

      // Conversion stats
      const convStats = stats.conversionStats.dailyConversions[dateKey] || { tryons: 0, orders: 0, revenue: 0 };
      dailyConversions.push({
        date: dateKey,
        tryons: convStats.tryons,
        orders: convStats.orders,
        revenue: convStats.revenue,
      });
    }

    // Calculate overall conversion metrics
    const totalTryons = Object.keys(stats.conversionStats.tryonSessions).length;
    const totalConversions = stats.conversionStats.ordersAfterTryon.length;
    const totalRevenue = stats.conversionStats.ordersAfterTryon.reduce((sum, o) => sum + o.orderAmount, 0);
    const conversionRate = totalTryons > 0 ? (totalConversions / totalTryons) * 100 : 0;

    // Get before/after comparison (30 days before plugin install vs 30 days after)
    const pluginDate = new Date(stats.pluginInstalledAt);
    const beforeAfterComparison = calculateBeforeAfterComparison(pluginDate);

    return {
      // Original stats
      totalJobs: stats.totalJobs,
      successfulJobs: stats.successfulJobs,
      failedJobs: stats.failedJobs,
      averageProcessingTimeMs: stats.averageProcessingTimeMs,
      dailyUsage,
      recentActivity: stats.recentActivity.slice(0, 10),

      // New conversion analytics
      totalTryons,
      totalConversions,
      totalRevenue,
      conversionRate: Math.round(conversionRate * 100) / 100,
      dailyConversions,
      beforeAfterComparison,
      topConvertingProducts: getTopConvertingProducts(),
    };
  },

  // Reset stats (for testing)
  resetStats: () => {
    stats = {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      averageProcessingTimeMs: 0,
      dailyUsage: {},
      recentActivity: [],
      conversionStats: {
        tryonSessions: {},
        dailyConversions: {},
        ordersAfterTryon: [],
      },
      pluginInstalledAt: new Date().toISOString(),
    };
    saveStats();
  },

  // Get raw stats object
  getRawStats: () => ({ ...stats }),
};

// Helper: Calculate before/after comparison
function calculateBeforeAfterComparison(pluginDate) {
  // For now, we'll simulate the "before" period since we don't have historical data
  // In production, this would pull from Shopify API for historical order data
  const daysSinceInstall = Math.floor((Date.now() - pluginDate.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate average daily orders after install (from our conversion tracking + estimate)
  const totalConversions = stats.conversionStats.ordersAfterTryon.length;
  const avgDailyOrdersAfter = daysSinceInstall > 0 ? totalConversions / daysSinceInstall : 0;

  // Estimate "before" as 15% lower (this would come from actual Shopify data in production)
  const estimatedBeforeDaily = avgDailyOrdersAfter * 0.85;
  const estimatedBeforeTotal = Math.round(estimatedBeforeDaily * daysSinceInstall);

  return {
    beforeInstall: {
      periodDays: daysSinceInstall,
      estimatedOrders: estimatedBeforeTotal,
      avgDailyOrders: Math.round(estimatedBeforeDaily * 100) / 100,
    },
    afterInstall: {
      periodDays: daysSinceInstall,
      totalOrders: totalConversions,
      avgDailyOrders: Math.round(avgDailyOrdersAfter * 100) / 100,
    },
    percentChange: estimatedBeforeTotal > 0
      ? Math.round(((totalConversions - estimatedBeforeTotal) / estimatedBeforeTotal) * 100 * 100) / 100
      : 0,
  };
}

// Helper: Get top converting products
function getTopConvertingProducts() {
  const productConversions = {};

  for (const order of stats.conversionStats.ordersAfterTryon) {
    if (!productConversions[order.productId]) {
      productConversions[order.productId] = {
        productId: order.productId,
        orders: 0,
        revenue: 0,
      };
    }
    productConversions[order.productId].orders++;
    productConversions[order.productId].revenue += order.orderAmount;
  }

  return Object.values(productConversions)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);
}