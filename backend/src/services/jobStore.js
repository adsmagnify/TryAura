/**
 * Generation job store — Postgres when available, in-memory otherwise.
 */
const { v4: uuidv4 } = require("uuid");
const { env } = require("../config/env");
const { logger } = require("../lib/logger");

const memoryJobs = new Map();

function usePostgres() {
  const url = env.databaseUrl || "";
  return url.startsWith("postgres");
}

function rowToJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    shop: row.shop,
    status: row.status,
    product_id: row.product_id,
    product_type: row.product_type,
    customer_id: row.customer_id,
    session_id: row.session_id,
    person_image_url: row.person_image_url,
    garment_image_url: row.garment_image_url,
    person_image_key: row.person_image_key,
    result_image_url: row.result_image_url,
    result_image_key: row.result_image_key,
    provider_task_id: row.provider_task_id,
    attempt_count: row.attempt_count,
    max_attempts: row.max_attempts,
    error_message: row.error_message,
    processing_time_ms: row.processing_time_ms,
    created_at: row.created_at,
    completed_at: row.completed_at,
    next_retry_at: row.next_retry_at,
  };
}

function toPublicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    shop: job.shop,
    productId: job.product_id,
    sessionId: job.session_id,
    output: job.status === "completed" ? job.result_image_url : undefined,
    error: job.status === "failed" ? job.error_message : undefined,
    processingTimeMs: job.processing_time_ms,
    createdAt: job.created_at,
    completedAt: job.completed_at,
  };
}

// ── Postgres ────────────────────────────────────────────────────
async function pgQuery(text, params) {
  const { query } = require("../lib/db");
  return query(text, params);
}

async function createJobPostgres(payload) {
  const { rows } = await pgQuery(
    `INSERT INTO generation_jobs (
      shop, product_id, product_type, customer_id, session_id,
      person_image_url, garment_image_url, person_image_key,
      idempotency_key, max_attempts, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'queued')
    ON CONFLICT (shop, idempotency_key) WHERE idempotency_key IS NOT NULL
    DO UPDATE SET updated_at = now()
    RETURNING *`,
    [
      payload.shop,
      payload.productId || null,
      payload.productType || null,
      payload.customerId || null,
      payload.sessionId || null,
      payload.personImageUrl,
      payload.garmentImageUrl,
      payload.personImageKey || null,
      payload.idempotencyKey || null,
      env.worker.maxAttempts,
    ]
  );
  return rowToJob(rows[0]);
}

// ── In-memory ───────────────────────────────────────────────────
function createJobMemory(payload) {
  const id = uuidv4();
  const existing = payload.idempotencyKey
    ? [...memoryJobs.values()].find(
        (j) => j.shop === payload.shop && j.idempotency_key === payload.idempotencyKey
      )
    : null;
  if (existing) return existing;

  const job = {
    id,
    shop: payload.shop,
    status: "queued",
    product_id: payload.productId,
    product_type: payload.productType,
    customer_id: payload.customerId,
    session_id: payload.sessionId,
    person_image_url: payload.personImageUrl,
    garment_image_url: payload.garmentImageUrl,
    person_image_key: payload.personImageKey,
    result_image_url: null,
    provider_task_id: null,
    attempt_count: 0,
    max_attempts: env.worker.maxAttempts,
    error_message: null,
    processing_time_ms: null,
    created_at: new Date().toISOString(),
    completed_at: null,
    next_retry_at: null,
  };
  memoryJobs.set(id, job);
  return job;
}

async function createJob(payload) {
  if (usePostgres()) {
    try {
      return await createJobPostgres(payload);
    } catch (err) {
      logger.warn({ err: err.message }, "Postgres job create failed, using memory");
    }
  }
  return createJobMemory(payload);
}

async function getJobById(id, shop) {
  if (usePostgres()) {
    try {
      const { rows } = await pgQuery(
        `SELECT * FROM generation_jobs WHERE id = $1 AND shop = $2`,
        [id, shop]
      );
      if (rows[0]) return rowToJob(rows[0]);
    } catch {
      /* fall through */
    }
  }
  const job = memoryJobs.get(id);
  if (job && job.shop === shop) return job;
  return null;
}

async function claimNextJobs(limit) {
  if (usePostgres()) {
    try {
      const jobRepo = require("../repositories/generationJob.repository");
      return await jobRepo.claimNextJobs(limit);
    } catch {
      /* fall through */
    }
  }

  const claimed = [];
  for (const job of memoryJobs.values()) {
    if (claimed.length >= limit) break;
    if (job.status !== "queued" && job.status !== "retrying") continue;
    if (job.next_retry_at && new Date(job.next_retry_at) > new Date()) continue;
    job.status = "processing";
    job.attempt_count = (job.attempt_count || 0) + 1;
    claimed.push(job);
  }
  return claimed;
}

async function markCompleted(id, data) {
  if (usePostgres()) {
    try {
      const jobRepo = require("../repositories/generationJob.repository");
      return await jobRepo.markCompleted(id, data);
    } catch {
      /* fall through */
    }
  }
  const job = memoryJobs.get(id);
  if (!job) return null;
  job.status = "completed";
  job.result_image_url = data.resultImageUrl;
  job.processing_time_ms = data.processingTimeMs;
  job.completed_at = new Date().toISOString();
  job.error_message = null;
  return job;
}

async function markFailed(id, data) {
  if (usePostgres()) {
    try {
      const jobRepo = require("../repositories/generationJob.repository");
      return await jobRepo.markFailed(id, data);
    } catch {
      /* fall through */
    }
  }
  const job = memoryJobs.get(id);
  if (!job) return null;
  const shouldRetry = data.retryable && job.attempt_count < job.max_attempts;
  job.status = shouldRetry ? "retrying" : "failed";
  job.error_message = data.errorMessage;
  if (!shouldRetry) job.completed_at = new Date().toISOString();
  else {
    const backoff = env.worker.retryBaseMs * Math.pow(2, job.attempt_count - 1);
    job.next_retry_at = new Date(Date.now() + backoff).toISOString();
    job.status = "queued";
  }
  return job;
}

async function setProviderTaskId(id, taskId) {
  if (usePostgres()) {
    try {
      const jobRepo = require("../repositories/generationJob.repository");
      return await jobRepo.setProviderTaskId(id, taskId);
    } catch {
      /* fall through */
    }
  }
  const job = memoryJobs.get(id);
  if (job) job.provider_task_id = taskId;
}

module.exports = {
  createJob,
  getJobById,
  claimNextJobs,
  markCompleted,
  markFailed,
  setProviderTaskId,
  toPublicJob,
};
