const express = require("express");
const { fetchProductImage } = require("../services/productImage");

const router = express.Router();
const productImageCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchProductImageCached(productId, shop) {
  const cacheKey = `${shop}:${productId}`;
  const cached = productImageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.imageUrl;
  }
  const imageUrl = await fetchProductImage(productId, shop);
  productImageCache.set(cacheKey, { imageUrl, timestamp: Date.now() });
  return imageUrl;
}

router.get("/:productId/image", async (req, res) => {
  const { productId } = req.params;
  const shop = req.query.shop || req.headers["x-shopify-shop-domain"];

  if (!productId) return res.status(400).json({ error: "productId is required" });
  if (!shop) return res.status(400).json({ error: "shop parameter is required" });

  try {
    const imageUrl = await fetchProductImageCached(productId, shop);
    res.json({ success: true, productId, shop, imageUrl });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.get("/image-url", async (req, res) => {
  const { shop, productIds } = req.query;
  const idsArray = productIds ? productIds.split(",") : [];

  if (!shop) return res.status(400).json({ error: "shop parameter is required" });
  if (!idsArray.length) return res.status(400).json({ error: "productIds required" });

  const results = [];
  for (const productId of idsArray) {
    try {
      const imageUrl = await fetchProductImageCached(productId.trim(), shop);
      results.push({ productId: productId.trim(), imageUrl, success: true });
    } catch (error) {
      results.push({ productId: productId.trim(), imageUrl: null, success: false, error: error.message });
    }
  }
  res.json({ success: true, results });
});

module.exports = router;
