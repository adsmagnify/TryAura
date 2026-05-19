const pino = require("pino");
const { env } = require("../config/env");

const logger = pino({
  level: env.log.level,
  ...(env.log.pretty && {
    transport: { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } },
  }),
  base: { service: "tryaura-backend" },
  redact: {
    paths: ["accessToken", "access_token", "req.headers.authorization", "req.headers['x-tryon-api-key']"],
    censor: "[REDACTED]",
  },
});

function createRequestLogger(req) {
  return logger.child({
    requestId: req.headers["x-request-id"] || req.id,
    shop: req.shop || req.headers["x-shopify-shop-domain"] || req.query?.shop,
    method: req.method,
    path: req.path,
  });
}

module.exports = { logger, createRequestLogger };
