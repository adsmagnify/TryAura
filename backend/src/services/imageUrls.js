/**
 * Normalize and host image URLs for external AI providers (NanoBanana requires absolute https URIs).
 */
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const { env } = require("../config/env");
const { logger } = require("../lib/logger");
const objectStorage = require("./objectStorage");

function normalizePublicImageUrl(url, label = "image") {
  if (url == null || String(url).trim() === "") {
    throw new Error(`${label} URL is required`);
  }

  let s = String(url).trim();

  if (s.startsWith("//")) s = `https:${s}`;
  if (s.startsWith("/")) {
    throw new Error(`${label} URL must be absolute (received a relative path)`);
  }
  if (s.startsWith("data:")) {
    throw new Error(`${label} must be a public https URL, not embedded image data`);
  }
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(s)) {
    s = `https://${s}`;
  }

  let parsed;
  try {
    parsed = new URL(s);
  } catch {
    throw new Error(`${label} URL is not a valid URI`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${label} URL must use http or https`);
  }

  if (parsed.protocol === "http:" && env.isProd) {
    parsed.protocol = "https:";
  }

  return parsed.href;
}

function isHostedByUs(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const ours = new Set();
    for (const base of [env.backendUrl, env.r2.publicUrl]) {
      if (!base) continue;
      try {
        ours.add(new URL(base).hostname.toLowerCase());
      } catch {
        /* ignore */
      }
    }
    return ours.has(host);
  } catch {
    return false;
  }
}

/**
 * Returns an absolute https URL. Re-uploads third-party images (e.g. Shopify CDN) so providers accept them.
 */
async function prepareImageUrlForAi(url, { label = "image", prefix = "provider" } = {}) {
  const normalized = normalizePublicImageUrl(url, label);
  if (isHostedByUs(normalized)) return normalized;

  const f = await fetch;
  const res = await f(normalized, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Could not fetch ${label} (${res.status})`);
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 100) {
    throw new Error(`${label} download was empty or too small`);
  }

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const uploaded = await objectStorage.uploadImage(buffer, {
    prefix,
    contentType,
    ext,
  });

  const hosted = typeof uploaded === "string" ? uploaded : uploaded.url;
  const hostedUrl = normalizePublicImageUrl(hosted, label);
  logger.debug({ from: normalized, to: hostedUrl, label }, "Mirrored image for AI provider");
  return hostedUrl;
}

module.exports = {
  normalizePublicImageUrl,
  prepareImageUrlForAi,
  isHostedByUs,
};
