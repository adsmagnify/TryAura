-- Shopify session OAuth fields (safe if columns already exist from db push)
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "refreshTokenExpires" TIMESTAMP(3);
