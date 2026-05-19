const express = require("express");
const crypto = require("crypto");
const stats = require("../services/stats");
const sessionStore = require("../services/sessionStore");
const webhookEvents = require("../repositories/webhookEvent.repository");
const { env } = require("../config/env");
const { logger } = require("../lib/logger");

const router = express.Router();

function verifyShopifyWebhook(req, res, next) {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const secret = env.webhookSecret;
  if (!hmac || !secret) return res.status(401).json({ error: "Missing webhook signature" });
  const hash = crypto.createHmac("sha256", secret).update(req.rawBody || "").digest("base64");
  if (hash !== hmac) return res.status(401).json({ error: "Invalid webhook signature" });
  next();
}

router.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

async function withIdempotency(req, res, handler) {
  const webhookId = req.headers["x-shopify-webhook-id"];
  const shop = req.headers["x-shopify-shop-domain"];
  const topic = req.headers["x-shopify-topic"] || req.path;

  if (webhookId && (await webhookEvents.isProcessed(webhookId))) {
    return res.sendStatus(200);
  }

  try {
    await handler();
    if (webhookId) {
      await webhookEvents.markProcessed({ id: webhookId, shop, topic });
    }
    return res.sendStatus(200);
  } catch (err) {
    logger.error({ err: err.message, shop, topic }, "Webhook handler failed");
    if (webhookId) {
      await webhookEvents.markProcessed({
        id: webhookId,
        shop,
        topic,
        status: "failed",
        errorMessage: err.message,
      });
    }
    return res.sendStatus(200);
  }
}

router.post("/uninstalled", verifyShopifyWebhook, (req, res) =>
  withIdempotency(req, res, async () => {
    const shop = req.headers["x-shopify-shop-domain"];
    logger.info({ shop }, "App uninstalled");
    await sessionStore.deleteSession(shop);
  })
);

router.post("/products/update", verifyShopifyWebhook, (req, res) =>
  withIdempotency(req, res, async () => {
    logger.info({ productId: req.body?.id }, "Product updated");
  })
);

router.post("/orders/create", verifyShopifyWebhook, (req, res) =>
  withIdempotency(req, res, async () => {
    const order = req.body;
    const customerId = order.customer?.id || null;
    const orderId = String(order.id);
    const totalPrice = parseFloat(order.total_price || order.current_total_price || 0);

    if (customerId) {
      const sessionId = stats.findRecentSession(String(customerId));
      if (sessionId) {
        stats.recordConversion(sessionId, orderId, totalPrice, String(customerId));
        logger.info({ orderId, sessionId }, "Conversion recorded");
      }
    }
  })
);

module.exports = router;
