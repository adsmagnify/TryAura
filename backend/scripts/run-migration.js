/**
 * Run pending SQL migrations in supabase/migrations (uses DIRECT_URL / port 5432).
 * Tracks applied files in _schema_migrations so redeploys are safe.
 * Usage: npm run db:migrate
 */
require("dotenv").config();
require("../src/lib/dbUrl");

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const url = process.env.DIRECT_URL || process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL (DIRECT_URL is auto-derived from it)");
  process.exit(1);
}

const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query("SELECT filename FROM _schema_migrations");
  return new Set(rows.map((row) => row.filename));
}

async function markApplied(client, filename) {
  await client.query(
    "INSERT INTO _schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
    [filename]
  );
}

async function getPublicTables(client) {
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  return new Set(rows.map((row) => row.tablename));
}

/** Seed tracking for DBs created before _schema_migrations existed. */
async function bootstrapExistingSchema(client, files) {
  const applied = await getAppliedMigrations(client);
  if (applied.size > 0) return;

  const tables = await getPublicTables(client);
  if (tables.size === 0) return;

  const legacyMarkers = {
    "001_initial_schema.sql": "shop_sessions",
    "001_jobs_and_webhooks.sql": "generation_jobs",
    "002_shop_settings.sql": "shop_settings",
  };

  for (const file of files) {
    const marker = legacyMarkers[file];
    if (marker && tables.has(marker)) {
      console.log("Bootstrap: already applied (legacy):", file);
      await markApplied(client, file);
    }
  }
}

async function main() {
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  try {
    await ensureMigrationsTable(client);
    await bootstrapExistingSchema(client, files);
    const applied = await getAppliedMigrations(client);

    for (const file of files) {
      if (applied.has(file)) {
        console.log("Skipping (already applied):", file);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log("Applying:", file);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await markApplied(client, file);
        await client.query("COMMIT");
        console.log("✅", file);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
