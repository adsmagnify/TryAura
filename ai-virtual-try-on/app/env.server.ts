/**
 * Validates required production env vars at startup.
 */
function assertDatabaseUrl(name: string, value: string | undefined) {
    if (!value) return;
    if (value.startsWith("https://") || value.startsWith("http://")) {
      throw new Error(
        `${name} must be a Supabase Postgres connection string (postgresql://...), ` +
          `not your Render app URL. Fix in Render → tryaura-app → Environment.`
      );
    }
    if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
      throw new Error(`${name} must start with postgresql:// — check Render environment variables.`);
    }
  }
  
  export function getAppUrl(): string {
    const raw = process.env.SHOPIFY_APP_URL || "";
    if (!raw) {
      throw new Error(
        "SHOPIFY_APP_URL is not set. In Render, link it from RENDER_EXTERNAL_URL or set manually."
      );
    }
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw.replace(/\/$/, "");
    }
    return `https://${raw.replace(/\/$/, "")}`;
  }
  
  export function validateProductionEnv() {
    if (process.env.NODE_ENV !== "production") return;
  
    assertDatabaseUrl("DATABASE_URL", process.env.DATABASE_URL);
    assertDatabaseUrl("DIRECT_URL", process.env.DIRECT_URL);
  
    if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
      throw new Error("SHOPIFY_API_KEY and SHOPIFY_API_SECRET are required.");
    }
  }
  
  validateProductionEnv();
  