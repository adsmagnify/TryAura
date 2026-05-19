const { shopifyApi, ApiVersion, LogSeverity } = require("@shopify/shopify-api");
require("@shopify/shopify-api/adapters/node");

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  apiVersion: ApiVersion.January25,
  scopes: process.env.SHOPIFY_SCOPES?.split(",") || ["read_products", "write_products"],
  hostName: (process.env.BACKEND_URL || "http://localhost:3001").replace(/^https?:\/\//, ""),
  isEmbeddedApp: true,
  isCustomStoreApp: false,
  logger: {
    level: process.env.NODE_ENV === "development" ? LogSeverity.Debug : LogSeverity.Error,
  },
});

module.exports = { shopify };
