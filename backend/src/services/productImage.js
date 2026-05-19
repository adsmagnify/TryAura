const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const sessionStore = require("./sessionStore");
const { shopify } = require("../shopify/client");

async function fetchProductImage(productId, shop) {
  const accessToken = await sessionStore.getAccessToken(shop);

  if (!shop) throw new Error("Shop domain not provided. Include 'shop' parameter.");
  if (!accessToken) {
    throw new Error(`No access token for ${shop}. Install the app from Shopify Admin.`);
  }

  const cleanProductId = productId.includes("gid://")
    ? productId
    : `gid://shopify/Product/${productId}`;

  const f = await fetch;
  const apiVersion = shopify?.config?.apiVersion || "2025-01";
  const graphqlUrl = `https://${shop}/admin/api/${apiVersion}/graphql.json`;

  const query = `
    query GetProductImage($id: ID!) {
      product(id: $id) {
        featuredImage { url }
        images(first: 1) { edges { node { url } } }
      }
    }
  `;

  const response = await f(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables: { id: cleanProductId } }),
  });

  const data = await response.json();
  if (data.errors) throw new Error(`Shopify API error: ${data.errors[0].message}`);

  const product = data.data?.product;
  if (!product) throw new Error(`Product not found: ${cleanProductId}`);

  const imageUrl = product.featuredImage?.url || product.images?.edges?.[0]?.node?.url;
  if (!imageUrl) throw new Error("Product has no images");
  return imageUrl;
}

module.exports = { fetchProductImage };
