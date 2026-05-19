/**
 * Run all SQL migrations in supabase/migrations (use DIRECT_URL / port 5432).
 * Usage: npm run db:migrate
 */
require("dotenv").config();
require("../src/lib/dbUrl");

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const url = process.env.DIRECT_URL || process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DIRECT_URL or DATABASE_URL");
  process.exit(1);
}

const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

async function main() {
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log("Applying:", file);
      await pool.query(sql);
      console.log("✅", file);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
