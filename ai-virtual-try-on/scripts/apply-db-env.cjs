/**
 * Derives DIRECT_URL from Supabase DATABASE_URL (pooler :6543 → direct :5432).
 * Run before Prisma CLI during build/setup.
 */
function deriveDirectUrl(databaseUrl) {
  if (!databaseUrl || typeof databaseUrl !== "string") return undefined;

  try {
    const url = new URL(databaseUrl);
    if (url.port === "6543") {
      url.port = "5432";
    }
    url.searchParams.delete("pgbouncer");
    return url.toString();
  } catch {
    return databaseUrl
      .replace(":6543/", ":5432/")
      .replace(/[?&]pgbouncer=true/g, "")
      .replace(/\?$/, "");
  }
}

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = deriveDirectUrl(process.env.DATABASE_URL);
}

module.exports = { deriveDirectUrl };
