const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const BASE = "https://api.nanobananaapi.ai/api/v1/nanobanana";

async function pollForResult(taskId, maxWaitMs = 120000) {
  const f = await fetch;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 4000));
    const res = await f(`${BASE}/record-info?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${process.env.NANOBANANA_API_KEY}` }
    });
    const data = await res.json();
    console.log(`[NanaBanana] Status: ${data.data?.successFlag}`);
    if (data.data?.successFlag === 1) return data.data.response.resultImageUrl;
    if (data.data?.successFlag === 2 || data.data?.successFlag === 3) {
      throw new Error(`Generation failed: ${data.data.errorMessage}`);
    }
  }
  throw new Error("NanaBanana timed out after 120s");
}

async function downloadImage(url) {
  const f = await fetch;
  const res = await f(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const buffer = await res.arrayBuffer();
  return `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`;
}

const TRYON_PROMPT =
  "Virtual try-on: dress the person from the first image in the exact garment shown in the second image. Keep the person's face, hair, skin tone, body shape and pose exactly the same. Only change the clothing. Make it photorealistic and natural.";

async function submitTryOn(personImageUrl, garmentImageUrl) {
  const f = await fetch;
  try {
    const res = await f(`${BASE}/generate-pro`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NANOBANANA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: TRYON_PROMPT,
        imageUrls: [personImageUrl, garmentImageUrl],
        resolution: "1K",
        aspectRatio: "2:3",
      }),
    });
    const data = await res.json();
    if (!data.data?.taskId) {
      return { error: "No taskId returned: " + JSON.stringify(data) };
    }
    return { taskId: data.data.taskId };
  } catch (err) {
    return { error: err.message };
  }
}

async function pollProviderResult(taskId, maxWaitMs = 120000) {
  return pollForResult(taskId, maxWaitMs);
}

async function downloadResultBuffer(url) {
  const f = await fetch;
  const res = await f(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** @deprecated sync path — use submitTryOn + worker for production */
async function runTryOn(personImageUrl, garmentImageUrl) {
  const { taskId, error } = await submitTryOn(personImageUrl, garmentImageUrl);
  if (error) return { error, provider: "nanobanana" };

  try {
    const resultUrl = await pollProviderResult(taskId);
    const base64Image = await downloadImage(resultUrl);
    return { resultUrl: base64Image, provider: "nanobanana" };
  } catch (err) {
    return { error: err.message, provider: "nanobanana" };
  }
}

module.exports = {
  runTryOn,
  submitTryOn,
  pollProviderResult,
  downloadResultBuffer,
  pollForResult,
};