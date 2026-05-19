/**
 * Production session storage — Prisma + Supabase Postgres.
 * Replace SharedSessionStorage in shopify.server.ts when DATABASE_URL is set.
 */
import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import prisma from "./db.server";

export class PostgresSessionStorage implements SessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    await prisma.session.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope ?? null,
        expires: session.expires ?? null,
        accessToken: session.accessToken ?? "",
        userId: session.onlineAccessInfo?.associated_user?.id
          ? BigInt(session.onlineAccessInfo.associated_user.id)
          : null,
        firstName: session.onlineAccessInfo?.associated_user?.first_name ?? null,
        lastName: session.onlineAccessInfo?.associated_user?.last_name ?? null,
        email: session.onlineAccessInfo?.associated_user?.email ?? null,
        accountOwner: session.onlineAccessInfo?.associated_user?.account_owner ?? false,
        locale: session.onlineAccessInfo?.associated_user?.locale ?? null,
        collaborator: session.onlineAccessInfo?.associated_user?.collaborator ?? false,
      },
      update: {
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope ?? null,
        expires: session.expires ?? null,
        accessToken: session.accessToken ?? "",
      },
    });
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const row = await prisma.session.findUnique({ where: { id } });
    if (!row) return undefined;

    return new Session({
      id: row.id,
      shop: row.shop,
      state: row.state,
      isOnline: row.isOnline,
      scope: row.scope ?? undefined,
      expires: row.expires ?? undefined,
      accessToken: row.accessToken,
    });
  }

  async deleteSession(id: string): Promise<boolean> {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    await prisma.session.deleteMany({ where: { id: { in: ids } } });
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const rows = await prisma.session.findMany({ where: { shop } });
    return rows.map(
      (row) =>
        new Session({
          id: row.id,
          shop: row.shop,
          state: row.state,
          isOnline: row.isOnline,
          scope: row.scope ?? undefined,
          expires: row.expires ?? undefined,
          accessToken: row.accessToken,
        })
    );
  }
}
