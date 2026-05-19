const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");
const { env } = require("../config/env");
const { validateImage, preprocessImage } = require("../services/storage");
const objectStorage = require("../services/objectStorage");
const stats = require("../services/stats");
const sessionStore = require("../services/sessionStore");
const { fetchProductImage } = require("../services/productImage");
const jobStore = require("../services/jobStore");
const { validateUserPhoto, checkFilename, logGuardrailEvent } = require("../services/guardrails");
const { requireShop } = require("../middleware/requireShop");

const router = express.Router();

const limiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please wait a moment and try again." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and WebP images are allowed."));
    }
    const filenameCheck = checkFilename(file.originalname);
    if (!filenameCheck.allowed) {
      logGuardrailEvent("BLOCKED_FILENAME", { filename: file.originalname, reason: filenameCheck.reason });
      return cb(new Error("Image not allowed: " + filenameCheck.reason));
    }
    cb(null, true);
  },
});

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Try-on API. POST multipart to create a job, then poll GET /api/tryon/jobs/:id",
    async: true,
  });
});

router.get("/guidelines", (_req, res) => {
  res.json({
    success: true,
    guidelines: {
      photoRequirements: {
        minWidth: 300,
        minHeight: 400,
        maxSizeMB: env.upload.maxFileSizeMb,
        acceptedFormats: ["JPEG", "PNG", "WebP"],
      },
    },
  });
});

/** Poll job status — same store as POST / */
router.get("/jobs/:id", requireShop, async (req, res, next) => {
  try {
    const job = await jobStore.getJobById(req.params.id, req.shop);
    if (!job) return res.status(404).json({ success: false, error: "Job not found" });
    return res.json({ success: true, job: jobStore.toPublicJob(job) });
  } catch (err) {
    next(err);
  }
});

router.post("/", limiter, requireShop, upload.fields([
  { name: "personImage", maxCount: 1 },
  { name: "userImage", maxCount: 1 },
  { name: "garmentImage", maxCount: 1 },
]), async (req, res, next) => {
  const productType = req.body.productType || "unknown";
  const productId = req.body.productId || null;
  const customerId = req.body.customerId || req.body.customer_id || null;
  const sessionId = req.body.sessionId || stats.recordJobStart();
  const shop = req.shop;

  try {
    const token = await sessionStore.getAccessToken(shop);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: `App not installed for ${shop}. Open Shopify Admin → Apps → TryAura to install.`,
      });
    }

    let personImageUrl = req.body.personImage || req.body.userImageUrl;
    let personImageKey;

    const personImageFile =
      req.files?.personImage?.[0] || req.files?.userImage?.[0];

    if (personImageFile) {
      const validation = await validateImage(personImageFile.buffer, personImageFile.mimetype);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: "Invalid person image: " + validation.error });
      }

      const guardrailCheck = await validateUserPhoto(personImageFile.buffer, personImageFile.mimetype);
      if (!guardrailCheck.valid) {
        logGuardrailEvent("USER_PHOTO_REJECTED", { issues: guardrailCheck.issues });
        return res.status(400).json({
          success: false,
          error: "Photo requirements not met: " + guardrailCheck.issues.join("; "),
          guardrailIssues: guardrailCheck.issues,
        });
      }

      const processedBuffer = await preprocessImage(personImageFile.buffer);
      const uploaded = await objectStorage.uploadImage(processedBuffer);
      personImageUrl = typeof uploaded === "string" ? uploaded : uploaded.url;
      personImageKey = typeof uploaded === "string" ? null : uploaded.key;
    }

    let garmentImageUrl = req.body.garmentImage || req.body.garmentImageUrl;

    if (req.files?.garmentImage?.[0]) {
      const file = req.files.garmentImage[0];
      const validation = await validateImage(file.buffer, file.mimetype);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: "Invalid garment image: " + validation.error });
      }
      const processedBuffer = await preprocessImage(file.buffer);
      const uploaded = await objectStorage.uploadImage(processedBuffer);
      garmentImageUrl = typeof uploaded === "string" ? uploaded : uploaded.url;
    }

    if (!garmentImageUrl && productId) {
      garmentImageUrl = await fetchProductImage(productId, shop);
    }

    if (!personImageUrl) {
      return res.status(400).json({ success: false, error: "Person image is required" });
    }
    if (!garmentImageUrl) {
      return res.status(400).json({
        success: false,
        error: "Garment image required (productId, garmentImage URL, or file upload)",
      });
    }

    const idempotencyKey = req.headers["idempotency-key"] || req.body.idempotencyKey || `tryon_${uuidv4()}`;

    const job = await jobStore.createJob({
      shop,
      productId,
      productType,
      customerId,
      sessionId,
      personImageUrl,
      garmentImageUrl,
      personImageKey,
      idempotencyKey,
    });

    stats.recordTryonSession(sessionId, productId, customerId);

    const pollPath = `/api/tryon/jobs/${job.id}?shop=${encodeURIComponent(shop)}`;

    return res.status(202).json({
      success: true,
      jobId: job.id,
      status: job.status,
      pollUrl: pollPath,
      sessionId,
    });
  } catch (err) {
    stats.recordJobFailure(err.message || "Unknown error", productType);
    next(err);
  }
});

module.exports = router;
