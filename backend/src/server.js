require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const path = require("path");
const { randomUUID } = require("crypto");
const { env, validateProduction } = require("./config/env");
const { logger } = require("./lib/logger");
const { startJobWorker } = require("./workers/jobProcessor");

validateProduction();

const app = express();
const PORT = env.port;
const TEMP_DIR = path.join(__dirname, "../temp");

// Request ID
app.use((req, res, next) => {
  req.id = req.headers["x-request-id"] || randomUUID();
  res.setHeader("x-request-id", req.id);
  res.setHeader("ngrok-skip-browser-warning", "true");
  logger.info({ reqId: req.id, method: req.method, url: req.url });
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "frame-ancestors": ["https://admin.shopify.com", "https://*.myshopify.com"],
        "img-src": ["'self'", "data:", "https://*"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const allowedOrigins = [
  /\.myshopify\.com$/,
  env.backendUrl,
  env.frontendUrl,
  process.env.SHOPIFY_APP_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const ok = allowedOrigins.some((o) =>
        o instanceof RegExp ? o.test(origin) : origin === o || origin.startsWith(String(o))
      );
      if (ok || env.nodeEnv === "development") return callback(null, true);
      return callback(new Error("CORS not allowed"));
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-tryon-api-key", "idempotency-key", "x-shopify-shop-domain"],
    credentials: true,
  })
);

app.use(cookieParser());

// Webhooks need raw body — mount before json parser
app.use("/api/webhooks", require("./routes/webhooks"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Public temp uploads (NanoBanana fetches person images from here in dev)
app.use(
  "/temp",
  express.static(TEMP_DIR, {
    maxAge: env.upload.ttlSeconds * 1000,
    setHeaders(res) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  })
);

app.use("/api/products", require("./routes/products"));
app.use("/api/tryon", require("./routes/tryon"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/platform", require("./routes/platform"));
app.use("/auth", require("./routes/auth"));

// Health
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
    provider: env.aiProvider,
    sessionStorage: require("./services/sessionStore").storageMode(),
    asyncJobs: true,
  });
});

// Optional Vite proxy — only when running backend-only dev (NOT with `shopify app dev`).
// Use `shopify app dev` for the embedded UI; run backend with `npm run dev` on port 3001.
const viteProxyTarget = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173";
const enableViteProxy = process.env.PROXY_TO_VITE === "true";

if (env.nodeEnv === "development" && enableViteProxy) {
  const { createProxyMiddleware } = require("http-proxy-middleware");
  logger.info({ target: viteProxyTarget }, "Proxying UI to Vite (PROXY_TO_VITE=true)");
  app.use(
    "/",
    createProxyMiddleware({
      target: viteProxyTarget,
      changeOrigin: true,
      ws: true,
      pathFilter: (pathname) =>
        !pathname.startsWith("/api") &&
        !pathname.startsWith("/auth") &&
        !pathname.startsWith("/health") &&
        !pathname.startsWith("/temp"),
    })
  );
} else {
  app.get("/", (_req, res) => {
    res.json({
      success: true,
      message: "TryAura API is running. Use `shopify app dev` for the embedded admin UI.",
    });
  });
}

app.use((err, req, res, _next) => {
  logger.error({ err: err.message, reqId: req.id, stack: env.nodeEnv === "development" ? err.stack : undefined });
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT, env: env.nodeEnv }, "TryAura backend started");
  startJobWorker();
});

module.exports = app;
