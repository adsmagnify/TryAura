import { useMemo, useState } from "react";
import { type ActionFunctionArgs, type LoaderFunctionArgs, useRouteError } from "react-router";
import { useFetcher, useLoaderData, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "~/shopify.server";
import { isDevAdminEmail } from "~/platform.server";

type DashboardSettings = {
  enabled: boolean;
  aiProvider: string;
  buttonText: string;
  buttonColor: string;
  maxDailyRequests: number;
  watermarkEnabled: boolean;
  processingMessage: string;
};

type DashboardStats = {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  successRate: number;
  averageProcessingTimeMs: number;
  dailyUsed?: number;
  monthlyUsed?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
};

type UsageInfo = {
  dailyUsed: number;
  monthlyUsed: number;
};

type ActivityItem = {
  id: string;
  status: string;
  productId?: string | null;
  customerId?: string | null;
  sessionId?: string | null;
  error?: string | null;
  processingTimeMs?: number | null;
  createdAt?: string;
  completedAt?: string | null;
};

type ActivityLog = {
  id: string;
  time: string;
  productLabel: string;
  status: string;
  statusLabel: string;
  duration?: string;
  error?: string;
};

type DashboardResponse = {
  ok: boolean;
  message: string;
};

type BackendStatus = "connected" | "unauthorized" | "unreachable";

type TabName = "dashboard" | "settings" | "install" | "logs";

function formatActivityTime(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatActivityStatus(status: string) {
  switch (status) {
    case "completed":
      return { label: "Success", tone: "ok" as const };
    case "failed":
      return { label: "Failed", tone: "fail" as const };
    case "processing":
      return { label: "Processing", tone: "pending" as const };
    case "queued":
      return { label: "Queued", tone: "pending" as const };
    case "retrying":
      return { label: "Retrying", tone: "pending" as const };
    default:
      return { label: status, tone: "pending" as const };
  }
}

function mapActivityItem(item: ActivityItem): ActivityLog {
  const status = formatActivityStatus(item.status);
  return {
    id: item.id,
    time: formatActivityTime(item.createdAt),
    productLabel: item.productId ? `Product ${item.productId}` : "Try-on job",
    status: item.status,
    statusLabel: status.label,
    duration: item.processingTimeMs ? `${Math.round(item.processingTimeMs / 1000)}s` : undefined,
    error: item.error || undefined,
  };
}
const defaultSettings: DashboardSettings = {
  enabled: true,
  aiProvider: "nanobanana",
  buttonText: "Try This Dress",
  buttonColor: "#1a1a2e",
  maxDailyRequests: 100,
  watermarkEnabled: false,
  processingMessage: "Our AI is styling you...",
};

const defaultStats: DashboardStats = {
  totalJobs: 0,
  successfulJobs: 0,
  failedJobs: 0,
  successRate: 0,
  averageProcessingTimeMs: 0,
};

function getBackendUrl() {
  return (
    process.env.TRYON_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.PUBLIC_BACKEND_URL ||
    "http://127.0.0.1:3001"
  );
}

function getApiKey() {
  return process.env.API_SECRET || process.env.TRYON_API_SECRET || "";
}

async function fetchBackend(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const apiKey = getApiKey();
  if (apiKey) {
    headers.set("x-tryon-api-key", apiKey);
  }
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${getBackendUrl()}${path}`, {
    ...init,
    headers,
  });

  return response;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const shopQuery = `?shop=${encodeURIComponent(shop)}`;
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab");
  const initialTab: TabName =
    tab === "settings" || tab === "install" || tab === "logs" || tab === "dashboard"
      ? tab
      : "dashboard";

  let settings = defaultSettings;
  let stats = defaultStats;
  let usage: UsageInfo = { dailyUsed: 0, monthlyUsed: 0 };
  let activity: ActivityItem[] = [];
  let backendStatus: BackendStatus = "unreachable";

  try {
    const [healthRes, settingsRes, statsRes, activityRes] = await Promise.all([
      fetchBackend("/health"),
      fetchBackend(`/api/admin/settings${shopQuery}`),
      fetchBackend(`/api/admin/stats${shopQuery}`),
      fetchBackend(`/api/admin/activity${shopQuery}`),
    ]);

    if (healthRes.ok) {
      backendStatus = "connected";
    }

    if (settingsRes.status === 401 || statsRes.status === 401) {
      backendStatus = "unauthorized";
    }

    if (settingsRes.ok) {
      const settingsPayload = (await settingsRes.json()) as {
        settings?: DashboardSettings;
        usage?: UsageInfo;
      };
      if (settingsPayload.settings) settings = settingsPayload.settings;
      if (settingsPayload.usage) usage = settingsPayload.usage;
      backendStatus = "connected";
    }

    if (statsRes.ok) {
      const statsPayload = (await statsRes.json()) as { stats?: DashboardStats };
      if (statsPayload.stats) stats = statsPayload.stats;
      backendStatus = "connected";
    }

    if (activityRes.ok) {
      const activityPayload = (await activityRes.json()) as { activity?: ActivityItem[] };
      activity = activityPayload.activity || [];
    }
  } catch (_error) {
    backendStatus = "unreachable";
  }

  return {
    shop,
    settings,
    stats,
    usage,
    activity,
    backendStatus,
    backendUrl: getBackendUrl(),
    initialTab,
    isDevAdmin: isDevAdminEmail(session.email),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopQuery = `?shop=${encodeURIComponent(session.shop)}`;

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "save-settings") {
    const payload: Partial<DashboardSettings> = {
      enabled: formData.get("enabled") === "on",
      aiProvider: String(formData.get("aiProvider") || "nanobanana"),
      buttonText: String(formData.get("buttonText") || defaultSettings.buttonText),
      buttonColor: String(formData.get("buttonColor") || defaultSettings.buttonColor),
      maxDailyRequests: Number(formData.get("maxDailyRequests") || defaultSettings.maxDailyRequests),
      watermarkEnabled: formData.get("watermarkEnabled") === "on",
      processingMessage: String(
        formData.get("processingMessage") || defaultSettings.processingMessage,
      ),
    };

    const response = await fetchBackend(`/api/admin/settings${shopQuery}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { ok: false, message: "Could not save settings. Check backend/API key." } satisfies DashboardResponse;
    }

    return { ok: true, message: "Settings saved for your store." } satisfies DashboardResponse;
  }

  if (intent === "reset-settings") {
    const response = await fetchBackend(`/api/admin/settings/reset${shopQuery}`, {
      method: "POST",
    });
    if (!response.ok) {
      return { ok: false, message: "Could not reset settings." } satisfies DashboardResponse;
    }
    return { ok: true, message: "Settings reset to defaults." } satisfies DashboardResponse;
  }

  return { ok: false, message: "Unknown action." } satisfies DashboardResponse;
};

export default function Index() {
  const { shop, settings, stats, usage, activity, backendStatus, backendUrl, initialTab, isDevAdmin } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabName>(initialTab);
  const selectedProvider = "nanobanana";
  const [buttonText, setButtonText] = useState(settings.buttonText || "Try This Dress 👗");
  const [buttonColor, setButtonColor] = useState(settings.buttonColor || "#1a1a2e");
  const [enabled, setEnabled] = useState(settings.enabled);
  const [watermarkEnabled, setWatermarkEnabled] = useState(settings.watermarkEnabled);
  const [maxDailyRequests, setMaxDailyRequests] = useState(settings.maxDailyRequests || 100);
  const [processingMessage, setProcessingMessage] = useState(
    settings.processingMessage || "Our AI is styling you...",
  );

  const actionData = fetcher.data;

  const activityLogs = useMemo(() => activity.map(mapActivityItem), [activity]);

  const csvData = useMemo(() => {
    const rows = [
      ["time", "product", "status", "duration_sec", "error"],
      ...activityLogs.map((log) => [
        log.time,
        log.productLabel,
        log.statusLabel,
        log.duration || "",
        log.error || "",
      ]),
    ];
    return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  }, [activityLogs]);

  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvData)}`;

  const liquidSnippet = `{% if settings.tryon_enabled != false %}
  <script>
    window.TRYON_BACKEND_URL = {{ settings.tryon_api_url | default: shop.metafields.tryaura.api_url | json }};
    window.TryOnConfig = {
      apiUrl: window.TRYON_BACKEND_URL,
      productId: {{ product.id | json }},
    };
  </script>
  {{ 'tryon-widget.js' | asset_url | script_tag }}
{% endif %}`;

  const renderSnippet = `{% render 'tryon-button' %}`;

  const schemaSnippet = `{
  "name": "Virtual Try-On",
  "settings": [
    {
      "type": "checkbox",
      "id": "tryon_enabled",
      "label": "Enable Virtual Try-On",
      "default": true
    },
    {
      "type": "text",
      "id": "tryon_api_url",
      "label": "Backend API URL",
      "placeholder": "https://your-backend.com"
    }
  ]
}`;

  const tabTitleMap: Record<TabName, string> = {
    dashboard: "Dashboard",
    settings: "Settings",
    install: "Installation Guide",
    logs: "Activity Logs",
  };

  const saveSettings = () => {
    const form = new FormData();
    form.set("intent", "save-settings");
    form.set("enabled", enabled ? "on" : "off");
    form.set("watermarkEnabled", watermarkEnabled ? "on" : "off");
    form.set("aiProvider", selectedProvider);
    form.set("buttonText", buttonText);
    form.set("buttonColor", buttonColor);
    form.set("maxDailyRequests", String(maxDailyRequests));
    form.set("processingMessage", processingMessage);
    fetcher.submit(form, { method: "post" });
  };

  const resetSettings = () => {
    const form = new FormData();
    form.set("intent", "reset-settings");
    fetcher.submit(form, { method: "post" });
  };

  const tabHref = (tab: TabName) => {
    const params = new URLSearchParams(location.search);
    params.set("tab", tab);
    return `${location.pathname}?${params.toString()}`;
  };

  return (
    <div>
      <style>{dashboardStyles}</style>
      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <h1>👗 Virtual Try-On</h1>
            <p>Shopify Plugin Admin</p>
            <p className="text-sm text-muted" style={{ marginTop: 8 }}>{shop}</p>
          </div>
          <nav className="sidebar-nav">
            <a
              className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
              href={tabHref("dashboard")}
              onClick={(event) => {
                event.preventDefault();
                setActiveTab("dashboard");
              }}
            >
              <span className="icon">📊</span> Dashboard
            </a>
            <a
              className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
              href={tabHref("settings")}
              onClick={(event) => {
                event.preventDefault();
                setActiveTab("settings");
              }}
            >
              <span className="icon">⚙️</span> Settings
            </a>
            <a
              className={`nav-item ${activeTab === "install" ? "active" : ""}`}
              href={tabHref("install")}
              onClick={(event) => {
                event.preventDefault();
                setActiveTab("install");
              }}
            >
              <span className="icon">🔌</span> Installation
            </a>
            <a
              className={`nav-item ${activeTab === "logs" ? "active" : ""}`}
              href={tabHref("logs")}
              onClick={(event) => {
                event.preventDefault();
                setActiveTab("logs");
              }}
            >
              <span className="icon">📋</span> Activity Logs
            </a>
            {isDevAdmin ? (
              <a className="nav-item" href="/platform">
                <span className="icon">🛠️</span> Platform Admin
              </a>
            ) : null}
          </nav>
          <div className="sidebar-footer">v1.0.0 · AI Try-On Plugin</div>
        </aside>

        <div className="main">
          <div className="topbar">
            <h2>{tabTitleMap[activeTab]}</h2>
            <div className="topbar-actions">
              <span className={`badge ${enabled ? "badge-green" : "badge-red"}`}>
                <span className="dot"></span> {enabled ? "Plugin Active" : "Plugin Disabled"}
              </span>
              {activeTab === "settings" ? (
                <button className="btn btn-primary btn-sm" onClick={saveSettings}>
                  💾 Save Changes
                </button>
              ) : null}
            </div>
          </div>

          <div className="content">
            {activeTab === "dashboard" ? (
              <div id="tab-dashboard">
                {actionData ? (
                  <div className={`alert ${actionData.ok ? "alert-success" : "alert-error"}`}>{actionData.message}</div>
                ) : null}

                {backendStatus === "unreachable" ? (
                  <div className="alert alert-error">⚠ Backend not reachable. Connect backend to sync settings.</div>
                ) : null}

                {backendStatus === "unauthorized" ? (
                  <div className="alert alert-info">ℹ Backend is reachable, but admin API auth failed. Set matching <code style={{ fontFamily: "monospace" }}>API_SECRET</code> for frontend and backend.</div>
                ) : null}

                {backendStatus === "connected" ? (
                  <div className="alert alert-success">✓ Backend connected at {backendUrl}</div>
                ) : null}

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Total Try-Ons</div>
                    <div className="stat-value">{stats.totalJobs}</div>
                    <div className="stat-change">{stats.totalJobs === 0 ? "No try-ons yet" : "Live from backend"}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Success Rate</div>
                    <div className="stat-value">{`${stats.successRate}%`}</div>
                    <div className="stat-change">{stats.totalJobs === 0 ? "—" : "Live from backend"}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Avg. Processing</div>
                    <div className="stat-value">
                      {stats.averageProcessingTimeMs
                        ? `${Math.round(stats.averageProcessingTimeMs / 1000)}s`
                        : "—"}
                    </div>
                    <div className="stat-change">{stats.totalJobs === 0 ? "—" : "Live from backend"}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Failed Jobs</div>
                    <div className="stat-value">{stats.failedJobs}</div>
                    <div className="stat-change">{stats.totalJobs === 0 ? "—" : "Live from backend"}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Daily Usage</div>
                    <div className="stat-value">
                      {usage.dailyUsed} / {stats.dailyLimit ?? settings.maxDailyRequests}
                    </div>
                    <div className="stat-change">Resets daily</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Monthly Usage</div>
                    <div className="stat-value">
                      {usage.monthlyUsed} / {stats.monthlyLimit ?? "—"}
                    </div>
                    <div className="stat-change">Set by TryAura platform</div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">Plugin Controls</div>
                      <div className="card-subtitle">Quickly enable or disable features store-wide</div>
                    </div>
                  </div>

                  <div className="toggle-row">
                    <div className="toggle-info">
                      <h4>Virtual Try-On Button</h4>
                      <p>Show "Try This Dress" button on all product pages</p>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                      <span className="toggle-track"></span>
                    </label>
                  </div>

                  <div className="toggle-row">
                    <div className="toggle-info">
                      <h4>Mobile Support</h4>
                      <p>Display button and modal on mobile devices</p>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked />
                      <span className="toggle-track"></span>
                    </label>
                  </div>

                  <div className="toggle-row">
                    <div className="toggle-info">
                      <h4>Download Button</h4>
                      <p>Allow customers to download their try-on result</p>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked />
                      <span className="toggle-track"></span>
                    </label>
                  </div>

                  <div className="toggle-row">
                    <div className="toggle-info">
                      <h4>Result Watermark</h4>
                      <p>Add your store name watermark to generated images</p>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" checked={watermarkEnabled} onChange={(e) => setWatermarkEnabled(e.target.checked)} />
                      <span className="toggle-track"></span>
                    </label>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Recent Activity</div>
                    <a
                      className="btn btn-ghost btn-sm"
                      href={tabHref("logs")}
                      onClick={(event) => {
                        event.preventDefault();
                        setActiveTab("logs");
                      }}
                    >
                      View All →
                    </a>
                  </div>
                  {activityLogs.length === 0 ? (
                    <p className="text-muted text-sm">No try-ons yet for {shop}.</p>
                  ) : (
                    activityLogs.slice(0, 4).map((log) => (
                      <ActivityRow key={log.id} log={log} compact />
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "settings" ? (
              <div id="tab-settings">
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">AI Provider</div>
                      <div className="card-subtitle">Choose your AI processing backend</div>
                    </div>
                  </div>

                  <div className="provider-grid">
                    <div className={`provider-option ${selectedProvider === "nanobanana" ? "selected" : ""}`}>
                      <div className="provider-check">✓</div>
                      <h4>🍌 Nano Banana Pro</h4>
                      <p>Exclusive model · Production quality · Optimized latency</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                    More models coming soon.
                  </p>

                  <div className="form-row">
                    <label className="form-label">API Key <span>(stored securely server-side)</span></label>
                    <input type="text" placeholder="Enter your Nano Banana Pro API key" />
                  </div>

                  <div className="alert alert-info" style={{ marginBottom: 0 }}>
                    ℹ API keys are stored in your backend <code style={{ fontFamily: "monospace" }}>.env</code> file and never exposed to the browser.
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><div className="card-title">Button Appearance</div></div>
                  <div className="form-grid-2">
                    <div className="form-row" style={{ marginBottom: 0 }}>
                      <label className="form-label">Button Label</label>
                      <input type="text" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
                    </div>
                    <div className="form-row" style={{ marginBottom: 0 }}>
                      <label className="form-label">Button Colour</label>
                      <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} />
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted">Preview:</div>
                  <div style={{ marginTop: 10 }}>
                    <button
                      id="btn-preview"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "12px 24px",
                        background: buttonColor,
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "default",
                        fontFamily: "inherit",
                      }}
                    >
                      {buttonText}
                    </button>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><div className="card-title">Limits & Messages</div></div>
                  <div className="form-grid-2">
                    <div className="form-row">
                      <label className="form-label">Max Daily Requests</label>
                      <input
                        type="number"
                        value={maxDailyRequests}
                        onChange={(e) => setMaxDailyRequests(Number(e.target.value))}
                        min={1}
                        max={10000}
                      />
                    </div>
                    <div className="form-row">
                      <label className="form-label">Max File Size (MB)</label>
                      <input type="number" defaultValue={10} min={1} max={20} />
                    </div>
                  </div>
                  <div className="form-row">
                    <label className="form-label">Processing Message <span>(shown while AI works)</span></label>
                    <input
                      type="text"
                      value={processingMessage}
                      onChange={(e) => setProcessingMessage(e.target.value)}
                    />
                  </div>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <label className="form-label">Error Message <span>(shown on failure)</span></label>
                    <input type="text" defaultValue="Something went wrong. Please try a clearer photo." />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="btn btn-ghost" onClick={resetSettings}>Reset to Defaults</button>
                  <button className="btn btn-primary" onClick={saveSettings}>💾 Save Settings</button>
                </div>
              </div>
            ) : null}

            {activeTab === "install" ? (
              <div id="tab-install">
                <div className="alert alert-info">📌 Follow these steps to add the Virtual Try-On plugin to your Shopify theme.</div>
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 16 }}>Step 1 — Upload the Plugin File</div>
                  <p className="text-sm text-muted" style={{ marginBottom: 14 }}>
                    In your Shopify admin, go to <strong>Online Store → Themes → Actions → Edit Code</strong>. Under <strong>Assets</strong>, upload the file <code style={{ fontFamily: "monospace" }}>tryon-widget.js</code>.
                  </p>
                  <p className="text-sm text-muted">You can download the latest plugin file here:</p>
                  <div style={{ marginTop: 12 }}>
                    <a href="/tryon-widget.js" download className="btn btn-primary">⬇ Download tryon-widget.js</a>
                  </div>
                </div>

                <CodeCard title="Step 2 — Add the Liquid Snippet" text="Create a new snippet called tryon-button.liquid and paste this code:" code={liquidSnippet} />
                <CodeCard title="Step 3 — Render in Product Template" text="In your product template (e.g. sections/main-product.liquid), add this line just after your Add-to-Cart button block:" code={renderSnippet} />
                <CodeCard title="Step 4 — Configure Theme Settings" text="Add these settings to your config/settings_schema.json:" code={schemaSnippet} />
              </div>
            ) : null}

            {activeTab === "logs" ? (
              <div id="tab-logs">
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Activity Log</div>
                    <a className="btn btn-ghost btn-sm" href={csvHref} download="tryon-activity.csv">⬇ Export CSV</a>
                  </div>
                  <div>
                    {activityLogs.length === 0 ? (
                      <p className="text-muted text-sm">No activity for {shop} yet.</p>
                    ) : (
                      activityLogs.map((log) => <ActivityRow key={log.id} log={log} />)
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ log, compact = false }: { log: ActivityLog; compact?: boolean }) {
  const tone = formatActivityStatus(log.status).tone;
  const badgeClass =
    tone === "ok" ? "badge-green" : tone === "fail" ? "badge-red" : "badge-amber";

  return (
    <div className="log-row">
      <div className={`log-status ${tone}`}></div>
      <div style={{ flex: 1 }}>
        <div>
          <strong>{log.productLabel}</strong>
          {!compact && log.error ? <> — {log.error}</> : null}
        </div>
        <div className="log-meta">
          {log.time}
          {log.duration ? ` · ${log.duration}` : ""}
        </div>
        {compact && log.error ? (
          <div className="text-sm" style={{ color: "var(--red)" }}>{log.error}</div>
        ) : null}
      </div>
      <span className={`badge ${badgeClass}`}>{log.statusLabel}</span>
    </div>
  );
}

function CodeCard({ title, text, code }: { title: string; text: string; code: string }) {
  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
  };

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 16 }}>{title}</div>
      <p className="text-sm text-muted" style={{ marginBottom: 14 }}>{text}</p>
      <div className="code-block" style={{ position: "relative" }}>
        <button className="copy-btn" onClick={copyCode}>Copy</button>
        <pre>{code}</pre>
      </div>
    </div>
  );
}

const dashboardStyles = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #f4f5f7;
  --surface: #ffffff;
  --surface-2: #f9fafb;
  --border: #e5e7eb;
  --text: #111827;
  --text-2: #6b7280;
  --text-3: #9ca3af;
  --accent: #1a1a2e;
  --accent-hover: #2d2d4e;
  --green: #16a34a;
  --green-bg: #f0fdf4;
  --green-border: #bbf7d0;
  --red: #dc2626;
  --red-bg: #fef2f2;
  --amber: #d97706;
  --amber-bg: #fffbeb;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
}
body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; font-size: 15px; line-height: 1.6; }
.shell { display: flex; min-height: 100vh; }
.sidebar { width: 240px; background: var(--accent); color: #fff; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
.sidebar-logo { padding: 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.sidebar-logo h1 { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
.sidebar-logo p { font-size: 12px; opacity: 0.55; margin-top: 2px; }
.sidebar-nav { padding: 12px 10px; flex: 1; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.15s; color: rgba(255,255,255,0.7); margin-bottom: 2px; }
.nav-item:hover { background: rgba(255,255,255,0.1); color: #fff; }
.nav-item.active { background: rgba(255,255,255,0.15); color: #fff; }
.nav-item .icon { font-size: 16px; width: 20px; text-align: center; }
.sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: rgba(255,255,255,0.4); }
.main { margin-left: 240px; flex: 1; display: flex; flex-direction: column; }
.topbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
.topbar h2 { font-size: 18px; font-weight: 600; }
.topbar-actions { display: flex; gap: 10px; align-items: center; }
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
.badge-green { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-amber { background: var(--amber-bg); color: var(--amber); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.content { padding: 32px; flex: 1; }
.card { background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow); padding: 24px; margin-bottom: 20px; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-subtitle { font-size: 13px; color: var(--text-2); margin-top: 2px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); }
.stat-label { font-size: 12px; color: var(--text-2); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
.stat-value { font-size: 30px; font-weight: 700; margin: 6px 0 4px; letter-spacing: -0.02em; font-family: 'DM Mono', monospace; }
.stat-change { font-size: 12px; color: var(--text-3); }
.stat-change.up { color: var(--green); }
.toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--border); }
.toggle-row:last-child { border-bottom: none; padding-bottom: 0; }
.toggle-info h4 { font-size: 14px; font-weight: 600; }
.toggle-info p { font-size: 13px; color: var(--text-2); margin-top: 2px; }
.toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-track { position: absolute; inset: 0; background: #d1d5db; border-radius: 12px; cursor: pointer; transition: background 0.2s; }
.toggle input:checked + .toggle-track { background: var(--green); }
.toggle-track::after { content: ''; position: absolute; width: 18px; height: 18px; background: #fff; border-radius: 50%; top: 3px; left: 3px; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
.toggle input:checked + .toggle-track::after { transform: translateX(20px); }
.form-row { margin-bottom: 20px; }
label.form-label { display: block; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
label.form-label span { color: var(--text-3); font-weight: 400; }
input[type="text"], input[type="number"], input[type="color"], select, textarea { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; font-size: 14px; color: var(--text); background: var(--surface); transition: border-color 0.15s, box-shadow 0.15s; outline: none; }
input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(26,26,46,0.08); }
input[type="color"] { padding: 4px; height: 40px; cursor: pointer; }
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.btn { padding: 10px 20px; border-radius: var(--radius-sm); font-family: inherit; font-size: 14px; font-weight: 600; border: none; cursor: pointer; transition: background 0.15s, transform 0.1s, box-shadow 0.15s; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
.btn:active { transform: translateY(1px); }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); box-shadow: 0 4px 12px rgba(26,26,46,0.25); }
.btn-ghost { background: transparent; color: var(--text-2); border: 1px solid var(--border); }
.btn-ghost:hover { background: var(--surface-2); }
.btn-sm { padding: 6px 14px; font-size: 13px; }
.alert { display: flex; gap: 12px; padding: 14px 16px; border-radius: var(--radius-sm); font-size: 14px; margin-bottom: 20px; }
.alert-success { background: var(--green-bg); border: 1px solid var(--green-border); color: var(--green); }
.alert-error { background: var(--red-bg); border: 1px solid #fecaca; color: var(--red); }
.alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; }
.provider-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.provider-option { border: 2px solid var(--border); border-radius: var(--radius); padding: 16px; cursor: pointer; transition: border-color 0.15s, background 0.15s; position: relative; }
.provider-option.selected { border-color: var(--accent); background: #f8f8fc; }
.provider-option h4 { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.provider-option p { font-size: 12px; color: var(--text-2); }
.provider-check { position: absolute; top: 12px; right: 12px; width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 11px; display: none; align-items: center; justify-content: center; }
.provider-option.selected .provider-check { display: flex; }
.code-block { background: #1e1e2e; color: #cdd6f4; border-radius: var(--radius-sm); padding: 16px; font-family: 'DM Mono', monospace; font-size: 13px; line-height: 1.7; overflow-x: auto; position: relative; }
.copy-btn { position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.1); color: #cdd6f4; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; font-family: inherit; transition: background 0.15s; }
.copy-btn:hover { background: rgba(255,255,255,0.2); }
.log-row { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.log-row:last-child { border-bottom: none; }
.log-status { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.log-status.ok { background: var(--green); }
.log-status.fail { background: var(--red); }
.log-status.pending { background: var(--amber); }
.log-meta { color: var(--text-3); font-size: 12px; font-family: 'DM Mono', monospace; }
.text-muted { color: var(--text-2); }
.text-sm { font-size: 13px; }
.mt-2 { margin-top: 8px; }
@media (max-width: 900px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .sidebar { display: none; }
  .main { margin-left: 0; }
}
@media (max-width: 580px) {
  .stats-grid { grid-template-columns: 1fr; }
  .form-grid-2 { grid-template-columns: 1fr; }
  .provider-grid { grid-template-columns: 1fr; }
  .content { padding: 20px 16px; }
}
`;

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = boundary.headers;