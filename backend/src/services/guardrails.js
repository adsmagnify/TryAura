/**
 * Content Guardrails Service
 *
 * Provides safety checks and content moderation for virtual try-on images.
 * Prevents misuse of the platform for inappropriate content.
 */

const sharp = require("sharp");

// List of blocked terms for image analysis (basic text-based guardrails)
const BLOCKED_KEYWORDS = [
  "underwear",
  "lingerie",
  "bra",
  "panties",
  "thong",
  "boxers",
  "briefs",
  "intimate",
  "bikini", // context-dependent, may need review
  "swimsuit", // context-dependent
  "nude",
  "naked",
  "explicit",
  "nsfw",
  "adult",
];

// Minimum image quality standards
const MIN_IMAGE_QUALITY = {
  minWidth: 300,
  minHeight: 400,
  minAspectRatio: 0.4, // height/width (taller than wide is preferred for full body)
  maxAspectRatio: 2.5,
};

/**
 * Check image metadata for basic content safety
 * Note: For production, integrate with AWS Rekognition, Google Vision API,
 * or Azure Content Moderator for comprehensive content safety
 */
async function checkImageSafety(buffer, mimetype) {
  const issues = [];
  const warnings = [];

  try {
    const metadata = await sharp(buffer).metadata();

    // Check image dimensions
    if (metadata.width < MIN_IMAGE_QUALITY.minWidth) {
      warnings.push(`Image width too small (${metadata.width}px). Minimum ${MIN_IMAGE_QUALITY.minWidth}px recommended.`);
    }
    if (metadata.height < MIN_IMAGE_QUALITY.minHeight) {
      warnings.push(`Image height too small (${metadata.height}px). Minimum ${MIN_IMAGE_QUALITY.minHeight}px recommended.`);
    }

    // Check aspect ratio
    const aspectRatio = metadata.height / metadata.width;
    if (aspectRatio < MIN_IMAGE_QUALITY.minAspectRatio) {
      warnings.push("Image appears very wide. A full-body photo is recommended.");
    }
    if (aspectRatio > MIN_IMAGE_QUALITY.maxAspectRatio) {
      warnings.push("Image appears very tall/narrow. Consider a clearer full-body photo.");
    }

    // Check if image might be a screenshot (common with inappropriate content)
    // This is a heuristic - screenshots often have specific sizes
    const commonScreenshotSizes = [
      { w: 1125, h: 2436 }, // iPhone X and up
      { w: 750, h: 1334 },  // iPhone 8
      { w: 1080, h: 1920 }, // Common Android
      { w: 1440, h: 2560 }, // Android QHD
    ];

    const isScreenshot = commonScreenshotSizes.some(
      (size) => Math.abs(metadata.width - size.w) < 10 && Math.abs(metadata.height - size.h) < 10
    );

    if (isScreenshot) {
      warnings.push("Image appears to be a screenshot. Please use a direct camera photo for best results.");
    }

    // Note: In production, you would integrate with a content moderation API here
    // Example: AWS Rekognition detectModerationLabels
    // const moderationLabels = await detectModerationLabels(buffer);
    // if (moderationLabels.length > 0) {
    //   issues.push(...moderationLabels.map(l => l.Name));
    // }

    return {
      safe: issues.length === 0,
      issues,
      warnings,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        aspectRatio,
      },
    };
  } catch (error) {
    return {
      safe: false,
      issues: ["Could not analyze image: " + error.message],
      warnings: [],
      metadata: null,
    };
  }
}

/**
 * Validate user photo for try-on requirements
 */
async function validateUserPhoto(buffer, mimetype) {
  const result = await checkImageSafety(buffer, mimetype);

  // Add specific requirements for try-on photos
  if (result.metadata) {
    const { width, height, aspectRatio } = result.metadata;

    // For full-body try-on, we need sufficient resolution
    if (width < 300 || height < 400) {
      result.issues.push("Image resolution too low. Please upload a clearer photo (minimum 300x400px).");
    }

    // Check if image might be too zoomed in (unlikely to be full body)
    if (aspectRatio < 0.6 && width > height * 2) {
      result.warnings.push("Image appears to be a close-up. For best try-on results, please use a full-body photo from the front.");
    }
  }

  return {
    ...result,
    valid: result.issues.length === 0,
  };
}

/**
 * Check product/garment image
 */
async function validateGarmentImage(buffer, mimetype) {
  const result = await checkImageSafety(buffer, mimetype);

  // Garment images should be clear product photos
  if (result.metadata) {
    const { width, height } = result.metadata;

    if (width < 200 || height < 200) {
      result.issues.push("Garment image too small. Minimum 200x200px required.");
    }
  }

  return {
    ...result,
    valid: result.issues.length === 0,
  };
}

/**
 * Log guardrail event for monitoring
 */
function logGuardrailEvent(eventType, details) {
  const timestamp = new Date().toISOString();
  console.log(`[GUARDRAIL] ${timestamp} | ${eventType} | ${JSON.stringify(details)}`);
}

/**
 * Check if filename contains blocked keywords
 * Basic check - not foolproof but catches obvious cases
 */
function checkFilename(filename) {
  const lowerFilename = filename.toLowerCase();
  const foundKeywords = BLOCKED_KEYWORDS.filter((keyword) =>
    lowerFilename.includes(keyword)
  );

  if (foundKeywords.length > 0) {
    return {
      allowed: false,
      reason: `Filename contains inappropriate terms: ${foundKeywords.join(", ")}`,
    };
  }

  return { allowed: true };
}

module.exports = {
  checkImageSafety,
  validateUserPhoto,
  validateGarmentImage,
  checkFilename,
  logGuardrailEvent,
  BLOCKED_KEYWORDS,
  MIN_IMAGE_QUALITY,
};