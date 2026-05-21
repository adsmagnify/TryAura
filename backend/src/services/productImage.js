const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const sessionStore = require("./sessionStore");
const { shopify } = require("../shopify/client");
const { logger } = require("../lib/logger");

function formatGraphqlErrors(errors) {
  if (errors == null) return "Unknown Shopify API error";
  if (typeof errors === "string") return errors;

  const list = Array.isArray(errors) ? errors : [errors];
  if (!list.length) return "Unknown Shopify API error";

  const parts = list.map((e) => {
    if (e == null) return "Unknown error";
    if (typeof e === "string") return e;
    if (typeof e === "object") {
      const code = e.extensions?.code;
      const problems = e.extensions?.problems;
      if (e.message) return code ? `${e.message} (${code})` : e.message;
      if (code) return String(code);
      if (Array.isArray(problems) && problems.length) {
        return problems.map((p) => p.message || JSON.stringify(p)).join(", ");
      }
      try {
        return JSON.stringify(e);
      } catch {
        return "Unknown error";
      }
    }
    return String(e);
  });

  const joined = parts.filter(Boolean).join("; ");
  return joined || "Unknown Shopify API error";
}

/** Numeric Shopify product id or null if invalid (e.g. SKU from JSON-LD). */
function normalizeProductId(productId) {
  if (productId == null || productId === "") return null;
  const raw = String(productId).trim();

  const gidMatch = raw.match(/^gid:\/\/shopify\/Product\/(\d+)$/i);
  if (gidMatch) return gidMatch[1];

  if (/^\d+$/.test(raw)) return raw;

  return null;
}

async function fetchProductImageRest(numericId, shop, accessToken, apiVersion) {
  const f = await fetch;
  const url = `https://${shop}/admin/api/${apiVersion}/products/${numericId}.json`;

  const response = await f(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Shopify API returned invalid JSON (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const msg = data?.errors || data?.error || text.slice(0, 200);
    const detail = typeof msg === "string" ? msg : JSON.stringify(msg);
    logger.warn({ shop, productId: numericId, status: response.status, detail }, "Shopify REST product fetch failed");
    throw new Error(`Shopify API HTTP ${response.status}: ${detail}`);
  }

  const product = data.product;
  if (!product) throw new Error(`Product not found: ${numericId}`);

  const imageUrl =
    product.image?.src ||
    product.images?.[0]?.src ||
    product.media?.[0]?.preview_image?.src;

  if (!imageUrl) throw new Error("Product has no images");
  return imageUrl;
}

async function fetchProductImageGraphql(gid, shop, accessToken, apiVersion) {
  const f = await fetch;
  const graphqlUrl = `https://${shop}/admin/api/${apiVersion}/graphql.json`;

  const query = `
    query GetProductImage($id: ID!) {
      product(id: $id) {
        featuredMedia {
          preview {
            image {
              url
            }
          }
        }
        media(first: 1) {
          nodes {
            preview {
              image {
                url
              }
            }
          }
        }
      }
    }
  `;

  const response = await f(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables: { id: gid } }),
  });

  const data = await response.json();

  if (!response.ok) {
    const detail = formatGraphqlErrors(data?.errors) || JSON.stringify(data).slice(0, 300);
    logger.error({ shop, status: response.status, detail }, "Shopify GraphQL HTTP error");
    throw new Error(`Shopify GraphQL HTTP ${response.status}: ${detail}`);
  }
  if (data.errors) {
    const detail = formatGraphqlErrors(data.errors);
    logger.error({ shop, gid, detail, errors: data.errors }, "Shopify GraphQL errors");
    throw new Error(`Shopify API error: ${detail}`);
  }

  const product = data.data?.product;
  if (!product) throw new Error(`Product not found: ${gid}`);

  const imageUrl =
    product.featuredMedia?.preview?.image?.url ||
    product.media?.nodes?.[0]?.preview?.image?.url;

  if (!imageUrl) throw new Error("Product has no images");
  return imageUrl;
}

async function fetchProductImage(productId, shop) {
  const accessToken = await sessionStore.getAccessToken(shop);

  if (!shop) throw new Error("Shop domain not provided. Include 'shop' parameter.");
  if (!accessToken) {
    throw new Error(`No access token for ${shop}. Install the app from Shopify Admin → Apps → TryAura.`);
  }

  const numericId = normalizeProductId(productId);
  if (!numericId) {
    throw new Error(
      `Invalid product id "${productId}". Refresh the product page and try again.`,
    );
  }

  const apiVersion = shopify?.config?.apiVersion || "2025-01";
  const gid = `gid://shopify/Product/${numericId}`;

  try {
    return await fetchProductImageRest(numericId, shop, accessToken, apiVersion);
  } catch (restErr) {
    logger.warn({ err: restErr.message, shop, productId: numericId }, "REST product image failed, trying GraphQL");
    try {
      return await fetchProductImageGraphql(gid, shop, accessToken, apiVersion);
    } catch (gqlErr) {
      const msg = gqlErr?.message || restErr?.message || "Could not load product image from Shopify";
      throw new Error(msg);
    }
  }
}

module.exports = { fetchProductImage, normalizeProductId };
