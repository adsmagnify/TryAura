/**
 * Cloudflare R2 upload (S3-compatible). Falls back to local storage when USE_R2_STORAGE=false.
 */
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const { env } = require("../config/env");
const { logger } = require("../lib/logger");
const localStorage = require("./storage");

let s3 = null;

function getS3() {
  if (!s3) {
    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    });
  }
  return s3;
}

function buildKey(prefix, ext = "jpg") {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}/${date}/${uuidv4()}.${ext}`;
}

function publicUrlForKey(key) {
  return `${env.r2.publicUrl}/${key}`;
}

/**
 * Upload processed image buffer. Returns HTTPS URL for NanoBanana.
 */
async function uploadImage(buffer, { prefix = "uploads", contentType = "image/jpeg", ext = "jpg" } = {}) {
  if (!env.useR2Storage) {
    const url = await localStorage.uploadToLocal(buffer, ext);
    return { url, key: null };
  }

  const key = buildKey(prefix, ext);
  await getS3().send(
    new PutObjectCommand({
      Bucket: env.r2.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "private, max-age=3600",
    })
  );

  const url = publicUrlForKey(key);
  logger.debug({ key, url }, "Uploaded to R2");
  return { url, key };
}

async function uploadResult(buffer) {
  return uploadImage(buffer, { prefix: "results", contentType: "image/jpeg" });
}

async function deleteByKey(key) {
  if (!key || !env.useR2Storage) return;
  try {
    await getS3().send(new DeleteObjectCommand({ Bucket: env.r2.bucket, Key: key }));
  } catch (err) {
    logger.warn({ err, key }, "Failed to delete R2 object");
  }
}

module.exports = { uploadImage, uploadResult, deleteByKey, publicUrlForKey, buildKey };
