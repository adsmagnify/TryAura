/**
 * Run SQL migrations against DATABASE_URL_DIRECT (not pooler).
 * Usage: DATABASE_URL_DIRECT=postgresql://... node scripts/run-migration.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL_DIRECT or DATABASE_URL");
  process.exit(1);
}

const migrationPath = path.join(__dirname, "..", "supabase", "migrations", "001_jobs_and_webhooks.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

async function main() {
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(sql);
    console.log("✅ Migration applied:", migrationPath);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
