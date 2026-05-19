/**
 * Async try-on job API (polling-based).
 * Mount at /api/jobs when USE_ASYNC_JOBS=true
 */
const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");
const { env } = require("../config/env");
const jobRepo = require("../repositories/generationJob.repository");
const shopSession = require("../repositories/shopSession.repository");
const { validateImage, preprocessImage } = require("../services/storage");
const objectStorage = require("../services/objectStorage");
const { validateUserPhoto, checkFilename, logGuardrailEvent } = require("../services/guardrails");
const { requireShop } = require("../middleware/requireShop");

const router = express.Router();

const limiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.storefrontMax,
  message: { success: false, error: "Too many requests. Please wait." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxFileSizeMb * 1024 * 1024 },
});

// POST /api/jobs — create async job
router.post("/", limiter, requireShop, upload.single("personImage"), async (req, res, next) => {
  try {
    const shop = req.shop;
    const token = await shopSession.getAccessToken(shop);
    if (!token) {
      return res.status(401).json({ success: false, error: "Shop not installed. Complete OAuth first." });
    }

    let personImageUrl = req.body.personImageUrl;
    let personImageKey;

    if (req.file) {
      const filenameCheck = checkFilename(req.file.originalname);
      if (!filenameCheck.allowed) {
        return res.status(400).json({ success: false, error: filenameCheck.reason });
      }

      const validation = await validateImage(req.file.buffer, req.file.mimetype);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const guardrailCheck = await validateUserPhoto(req.file.buffer, req.file.mimetype);
      if (!guardrailCheck.valid) {
        logGuardrailEvent("USER_PHOTO_REJECTED", { issues: guardrailCheck.issues });
        return res.status(400).json({ success: false, error: guardrailCheck.issues.join("; ") });
      }

      const processed = await preprocessImage(req.file.buffer);
      const uploaded = await objectStorage.uploadImage(processed);
      if (typeof uploaded === "string") {
        personImageUrl = uploaded;
      } else {
        personImageUrl = uploaded.url;
        personImageKey = uploaded.key;
      }
    }

    const garmentImageUrl = req.body.garmentImageUrl;
    const productId = req.body.productId;

    if (!personImageUrl) {
      return res.status(400).json({ success: false, error: "personImage file or personImageUrl required" });
    }
    if (!garmentImageUrl && !productId) {
      return res.status(400).json({ success: false, error: "garmentImageUrl or productId required" });
    }

    // garment fetch reuses existing tryon route helper in Phase 2 wiring
    let resolvedGarmentUrl = garmentImageUrl;
    if (!resolvedGarmentUrl && productId) {
      const tryonRoute = require("./tryon");
      // Temporary: import fetchProductImage from tryon when refactored to service
      return res.status(501).json({
        success: false,
        error: "Product image auto-fetch: wire fetchProductImage service in Phase 2",
      });
    }

    const idempotencyKey = req.headers["idempotency-key"] || req.body.idempotencyKey;
    const sessionId = req.body.sessionId || `sess_${uuidv4()}`;

    const job = await jobRepo.createJob({
      shop,
      productId,
      productType: req.body.productType,
      customerId: req.body.customerId,
      sessionId,
      personImageUrl,
      garmentImageUrl: resolvedGarmentUrl,
      personImageKey,
      idempotencyKey,
    });

    return res.status(202).json({
      success: true,
      job: jobRepo.toPublicJob(job),
      pollUrl: `/api/jobs/${job.id}?shop=${encodeURIComponent(shop)}`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/:id — poll status
router.get("/:id", requireShop, async (req, res, next) => {
  try {
    const job = await jobRepo.getJobById(req.params.id, req.shop);
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }
    return res.json({ success: true, job: jobRepo.toPublicJob(job) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
