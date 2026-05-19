const { env } = require("../config/env");
const { logger } = require("../lib/logger");
const jobStore = require("../services/jobStore");
const stats = require("../services/stats");
const { submitTryOn, pollProviderResult, downloadResultBuffer } = require("../services/aiProvider");
const objectStorage = require("../services/objectStorage");

let intervalHandle = null;
let processing = false;

async function processJob(job) {
  const log = logger.child({ jobId: job.id, shop: job.shop });
  const start = Date.now();

  try {
    const { taskId, error: submitError } = await submitTryOn(job.person_image_url, job.garment_image_url);
    if (submitError) throw new Error(submitError);

    await jobStore.setProviderTaskId(job.id, taskId);

    const resultUrl = await pollProviderResult(taskId);
    const buffer = await downloadResultBuffer(resultUrl);

    let resultImageUrl;
    const uploaded = await objectStorage.uploadResult(buffer);
    resultImageUrl = typeof uploaded === "string" ? uploaded : uploaded.url;
    const resultImageKey = typeof uploaded === "string" ? null : uploaded.key;

    await jobStore.markCompleted(job.id, {
      resultImageUrl,
      resultImageKey,
      providerTaskId: taskId,
      processingTimeMs: Date.now() - start,
    });

    stats.recordJobSuccess(Date.now() - start, job.product_type || "unknown");
    log.info({ processingTimeMs: Date.now() - start }, "Job completed");
  } catch (err) {
    const retryable =
      err.retryable !== false &&
      !/invalid|rejected|guardrail|not allowed|no taskid/i.test(err.message);

    await jobStore.markFailed(job.id, {
      errorMessage: err.message,
      errorCode: "GENERATION_ERROR",
      retryable,
    });

    stats.recordJobFailure(err.message, job.product_type || "unknown");
    log.error({ err: err.message, retryable }, "Job failed");
  }
}

async function tick() {
  if (!env.enableJobWorker) return;
  if (processing) return;

  processing = true;
  try {
    const jobs = await jobStore.claimNextJobs(env.worker.batchSize);
    await Promise.all(jobs.map(processJob));
  } catch (err) {
    logger.error({ err: err.message }, "Worker tick error");
  } finally {
    processing = false;
  }
}

function startJobWorker() {
  if (!env.enableJobWorker) {
    logger.info("Job worker disabled");
    return;
  }
  if (intervalHandle) return;

  logger.info({ intervalMs: env.worker.intervalMs }, "Job worker started");
  intervalHandle = setInterval(tick, env.worker.intervalMs);
  tick();
}

function stopJobWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { startJobWorker, stopJobWorker, processJob, tick };
