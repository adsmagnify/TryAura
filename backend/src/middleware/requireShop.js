/**
 * Storefront auth: require shop domain, validate myshopify.com format.
 * Does NOT expose access tokens to the client.
 */
function normalizeShop(shop) {
  if (!shop) return null;
  let s = String(shop).trim().toLowerCase();
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return s;
}

function isValidShopDomain(shop) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}

function requireShop(req, res, next) {
  const shop = normalizeShop(
    req.body?.shop || req.query?.shop || req.headers["x-shopify-shop-domain"]
  );

  if (!shop || !isValidShopDomain(shop)) {
    return res.status(400).json({ success: false, error: "Valid shop parameter required" });
  }

  req.shop = shop;
  next();
}

module.exports = { requireShop, normalizeShop, isValidShopDomain };
