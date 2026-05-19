const { query, withTransaction } = require("../lib/db");
const { env } = require("../config/env");

async function createJob({
  shop,
  productId,
  productType,
  customerId,
  sessionId,
  personImageUrl,
  garmentImageUrl,
  personImageKey,
  garmentImageKey,
  idempotencyKey,
}) {
  const { rows } = await query(
    `INSERT INTO generation_jobs (
      shop, product_id, product_type, customer_id, session_id,
      person_image_url, garment_image_url, person_image_key, garment_image_key,
      idempotency_key, max_attempts, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'queued')
    ON CONFLICT (shop, idempotency_key) WHERE idempotency_key IS NOT NULL
    DO UPDATE SET updated_at = now()
    RETURNING *`,
    [
      shop,
      productId || null,
      productType || null,
      customerId || null,
      sessionId || null,
      personImageUrl,
      garmentImageUrl,
      personImageKey || null,
      garmentImageKey || null,
      idempotencyKey || null,
      env.worker.maxAttempts,
    ]
  );
  return rows[0];
}

async function getJobById(id, shop) {
  const { rows } = await query(
    `SELECT * FROM generation_jobs WHERE id = $1 AND shop = $2`,
    [id, shop]
  );
  return rows[0] || null;
}

async function claimNextJobs(limit = 3) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM generation_jobs
       WHERE status IN ('queued', 'retrying')
         AND (next_retry_at IS NULL OR next_retry_at <= now())
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );

    if (!rows.length) return [];

    const ids = rows.map((r) => r.id);
    await client.query(
      `UPDATE generation_jobs
       SET status = 'processing', started_at = now(), attempt_count = attempt_count + 1, updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    return rows.map((r) => ({ ...r, status: "processing" }));
  });
}

async function markCompleted(id, { resultImageUrl, resultImageKey, providerTaskId, processingTimeMs }) {
  const { rows } = await query(
    `UPDATE generation_jobs SET
      status = 'completed',
      result_image_url = $2,
      result_image_key = $3,
      provider_task_id = $4,
      processing_time_ms = $5,
      completed_at = now(),
      error_message = NULL,
      updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, resultImageUrl, resultImageKey || null, providerTaskId || null, processingTimeMs || null]
  );
  return rows[0];
}

async function markFailed(id, { errorMessage, errorCode, retryable }) {
  const { rows: current } = await query(`SELECT * FROM generation_jobs WHERE id = $1`, [id]);
  const job = current[0];
  if (!job) return null;

  const shouldRetry = retryable && job.attempt_count < job.max_attempts;
  const nextStatus = shouldRetry ? "retrying" : "failed";
  const backoffMs = env.worker.retryBaseMs * Math.pow(2, job.attempt_count - 1);

  const { rows } = await query(
    `UPDATE generation_jobs SET
      status = $2::generation_job_status,
      error_message = $3,
      error_code = $4,
      next_retry_at = CASE WHEN $2 = 'retrying' THEN now() + ($5 || ' milliseconds')::interval ELSE NULL END,
      completed_at = CASE WHEN $2 = 'failed' THEN now() ELSE NULL END,
      updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, nextStatus, errorMessage, errorCode || null, String(backoffMs)]
  );
  return rows[0];
}

async function setProviderTaskId(id, taskId) {
  await query(
    `UPDATE generation_jobs SET provider_task_id = $2, updated_at = now() WHERE id = $1`,
    [id, taskId]
  );
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

module.exports = {
  createJob,
  getJobById,
  claimNextJobs,
  markCompleted,
  markFailed,
  setProviderTaskId,
  toPublicJob,
};
