import { useState } from "react";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  useFetcher,
  useLoaderData,
  Link,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useRouteError } from "react-router";
import { authenticate } from "~/shopify.server";
import { fetchPlatformBackend, getBackendUrl, isDevAdmin } from "~/platform.server";

type ShopRow = {
  shop: string;
  settings: {
    enabled: boolean;
    plan: string;
    maxDailyRequests: number;
    monthlyGenerationLimit: number;
    platformNotes: string | null;
  };
  usage: { dailyUsed: number; monthlyUsed: number };
  stats: { totalJobs: number; successfulJobs: number; failedJobs: number };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (!isDevAdmin(session)) {
    return {
      accessDenied: true as const,
      shop: session.shop,
      sessionEmail: session.email || null,
    };
  }

  let shops: ShopRow[] = [];
  try {
    const res = await fetchPlatformBackend("/api/platform/shops");
    if (res.ok) {
      const payload = (await res.json()) as { shops?: ShopRow[] };
      shops = payload.shops || [];
    }
  } catch {
    shops = [];
  }

  return {
    accessDenied: false as const,
    shops,
    backendUrl: getBackendUrl(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  if (!isDevAdmin(session)) {
    return { ok: false, message: "You do not have platform admin access." };
  }

  const form = await request.formData();
  const shop = String(form.get("shop") || "");
  const intent = String(form.get("intent") || "update");

  if (intent === "update" && shop) {
    const res = await fetchPlatformBackend(`/api/platform/shops/${encodeURIComponent(shop)}`, {
      method: "PATCH",
      body: JSON.stringify({
        enabled: form.get("enabled") === "on",
        plan: String(form.get("plan") || "free"),
        maxDailyRequests: Number(form.get("maxDailyRequests") || 100),
        monthlyGenerationLimit: Number(form.get("monthlyGenerationLimit") || 500),
        platformNotes: String(form.get("platformNotes") || ""),
      }),
    });
    if (!res.ok) {
      return { ok: false, message: "Could not update shop limits." };
    }
    return { ok: true, message: `Updated limits for ${shop}.` };
  }

  return { ok: false, message: "Unknown action." };
};

export default function PlatformDashboard() {
  const data = useLoaderData<typeof loader>();

  if (data.accessDenied) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Platform access denied</h1>
        <p>Your account is not authorized for the platform admin dashboard.</p>
        <p style={{ color: "#666", fontSize: 14 }}>
          Shop: <code>{data.shop}</code>
          {data.sessionEmail ? (
            <>
              <br />
              Email: <code>{data.sessionEmail}</code>
            </>
          ) : (
            <>
              <br />
              No staff email on this session (common with offline tokens).
            </>
          )}
        </p>
        <p style={{ fontSize: 14 }}>
          Ask the app owner to add your email to <code>DEV_ADMIN_EMAILS</code> or this shop to{" "}
          <code>DEV_ADMIN_SHOPS</code> on Render, then redeploy tryaura-app.
        </p>
        <Link to="/" style={{ color: "#1a1a2e" }}>
          ← Back to merchant dashboard
        </Link>
      </div>
    );
  }

  const { shops, backendUrl } = data;
  const fetcher = useFetcher<typeof action>();
  const [selectedShop, setSelectedShop] = useState<string | null>(shops[0]?.shop || null);

  const selected = shops.find((s) => s.shop === selectedShop) || null;
  const [monthlyLimit, setMonthlyLimit] = useState(selected?.settings.monthlyGenerationLimit || 500);
  const [dailyLimit, setDailyLimit] = useState(selected?.settings.maxDailyRequests || 100);
  const [plan, setPlan] = useState(selected?.settings.plan || "free");
  const [notes, setNotes] = useState(selected?.settings.platformNotes || "");
  const [enabled, setEnabled] = useState(selected?.settings.enabled ?? true);

  const selectShop = (shop: string) => {
    const row = shops.find((s) => s.shop === shop);
    setSelectedShop(shop);
    if (row) {
      setMonthlyLimit(row.settings.monthlyGenerationLimit);
      setDailyLimit(row.settings.maxDailyRequests);
      setPlan(row.settings.plan);
      setNotes(row.settings.platformNotes || "");
      setEnabled(row.settings.enabled);
    }
  };

  const saveShop = () => {
    if (!selectedShop) return;
    const form = new FormData();
    form.set("intent", "update");
    form.set("shop", selectedShop);
    form.set("enabled", enabled ? "on" : "off");
    form.set("plan", plan);
    form.set("maxDailyRequests", String(dailyLimit));
    form.set("monthlyGenerationLimit", String(monthlyLimit));
    form.set("platformNotes", notes);
    fetcher.submit(form, { method: "post" });
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>TryAura Platform Admin</h1>
          <p style={{ margin: "8px 0 0", color: "#666" }}>
            Dev dashboard — control generation quotas per store
          </p>
        </div>
        <Link to="/" style={{ color: "#1a1a2e" }}>
          ← Merchant dashboard
        </Link>
      </div>

      <p style={{ color: "#666", fontSize: 14 }}>
        Backend: <code>{backendUrl}</code>
      </p>

      {fetcher.data ? (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            borderRadius: 8,
            background: fetcher.data.ok ? "#ecfdf5" : "#fef2f2",
            color: fetcher.data.ok ? "#065f46" : "#991b1b",
          }}
        >
          {fetcher.data.message}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <th style={{ padding: 12 }}>Store</th>
                <th style={{ padding: 12 }}>Plan</th>
                <th style={{ padding: 12 }}>Monthly</th>
                <th style={{ padding: 12 }}>Today</th>
                <th style={{ padding: 12 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {shops.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, color: "#666" }}>
                    No shops yet. Install TryAura on a dev store first.
                  </td>
                </tr>
              ) : (
                shops.map((row) => (
                  <tr
                    key={row.shop}
                    onClick={() => selectShop(row.shop)}
                    style={{
                      cursor: "pointer",
                      background: row.shop === selectedShop ? "#eff6ff" : "transparent",
                      borderTop: "1px solid #e5e7eb",
                    }}
                  >
                    <td style={{ padding: 12 }}>{row.shop}</td>
                    <td style={{ padding: 12 }}>{row.settings.plan}</td>
                    <td style={{ padding: 12 }}>
                      {row.usage.monthlyUsed} / {row.settings.monthlyGenerationLimit}
                    </td>
                    <td style={{ padding: 12 }}>
                      {row.usage.dailyUsed} / {row.settings.maxDailyRequests}
                    </td>
                    <td style={{ padding: 12 }}>{row.settings.enabled ? "Active" : "Disabled"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Edit quotas</h2>
          {selected ? (
            <>
              <p style={{ fontSize: 13, color: "#666" }}>{selected.shop}</p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Store enabled
              </label>
              <label style={{ display: "block", marginBottom: 12, fontSize: 14 }}>
                Plan
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                >
                  <option value="free">free</option>
                  <option value="starter">starter</option>
                  <option value="pro">pro</option>
                  <option value="enterprise">enterprise</option>
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 12, fontSize: 14 }}>
                Monthly generation limit
                <input
                  type="number"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12, fontSize: 14 }}>
                Max daily requests (merchant cap)
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 16, fontSize: 14 }}>
                Internal notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                />
              </label>
              <button
                type="button"
                onClick={saveShop}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background: "#1a1a2e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Save platform limits
              </button>
            </>
          ) : (
            <p style={{ color: "#666" }}>Select a store from the table.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = boundary.headers;
