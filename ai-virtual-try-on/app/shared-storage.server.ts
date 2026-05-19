import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import fs from "fs";
import path from "path";

const TOKENS_FILE = path.join(process.cwd(), "..", "backend", "tokens.json");

export class SharedSessionStorage implements SessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    try {
      let data: any = {};
      if (fs.existsSync(TOKENS_FILE)) {
        data = JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));
      }
      
      data[session.shop] = {
        accessToken: session.accessToken,
        scope: session.scope,
        expiresAt: session.expires?.getTime(),
        id: session.id,
        state: session.state,
        isOnline: session.isOnline,
      };

      fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      return false;
    }
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const shop = id.replace("offline_", "");
    
    try {
      if (!fs.existsSync(TOKENS_FILE)) return undefined;
      const data = JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));
      const shopData = data[shop];

      if (!shopData) return undefined;

      return new Session({
        id: id,
        shop: shop,
        state: shopData.state || "shared-state",
        isOnline: shopData.isOnline || false,
        accessToken: shopData.accessToken,
        scope: shopData.scope,
        expires: shopData.expiresAt ? new Date(shopData.expiresAt) : undefined,
      });
    } catch (error) {
      return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    const shop = id.replace("offline_", "");
    try {
      if (!fs.existsSync(TOKENS_FILE)) return true;
      const data = JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));
      delete data[shop];
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    for (const id of ids) await this.deleteSession(id);
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const session = await this.loadSession(`offline_${shop}`);
    return session ? [session] : [];
  }
}
