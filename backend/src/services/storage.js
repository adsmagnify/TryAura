const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

// Local temp dir for dev
const TEMP_DIR = path.join(__dirname, "../../temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ── Validation ──────────────────────────────────────────────────
async function validateImage(buffer, mimetype) {
  const allowedTypes = (
    process.env.ALLOWED_MIME_TYPES || "image/jpeg,image/png,image/webp"
  ).split(",");

  if (!allowedTypes.includes(mimetype))
    return { valid: false, error: `Unsupported file type: ${mimetype}` };

  const maxBytes = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
  if (buffer.length > maxBytes)
    return { valid: false, error: `File too large. Max ${process.env.MAX_FILE_SIZE_MB || 10}MB` };

  try {
    const meta = await sharp(buffer).metadata();
    if (meta.width < 100 || meta.height < 100)
      return { valid: false, error: "Image too small (min 100x100px)" };
    if (meta.width > 4096 || meta.height > 4096)
      return { valid: false, error: "Image too large (max 4096x4096px)" };
  } catch {
    return { valid: false, error: "Could not read image — file may be corrupt" };
  }

  return { valid: true };
}

// ── Preprocessing ───────────────────────────────────────────────
async function preprocessImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ── Convert to base64 data URL (no storage needed) ─────────────
function toBase64DataUrl(buffer, mimeType = "image/jpeg") {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

// ── Save to local temp (for dev/fallback) ───────────────────────
async function uploadToLocal(buffer, ext = "jpg") {
  const fileId = uuidv4();
  const filename = `${fileId}.${ext}`;
  const filepath = path.join(TEMP_DIR, filename);

  fs.writeFileSync(filepath, buffer);

  // Auto-delete after TTL
  const ttl = parseInt(process.env.IMAGE_TTL_SECONDS || "3600") * 1000;
  setTimeout(() => {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`[Storage] TTL expired, deleted: ${filename}`);
    }
  }, ttl);

  return `${process.env.BACKEND_URL || "http://localhost:3001"}/temp/${filename}`;
}

// ── Delete local temp file ──────────────────────────────────────
async function deleteLocal(url) {
  const filename = url.split("/temp/")[1];
  if (filename) {
    const filepath = path.join(TEMP_DIR, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
}

module.exports = {
  validateImage,
  preprocessImage,
  toBase64DataUrl,
  uploadToLocal,
  deleteLocal,
};