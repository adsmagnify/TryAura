var _a;
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, UNSAFE_withComponentProps, useLoaderData, useLocation, Meta, Links, ScrollRestoration, Scripts, Outlet, useFetcher, Link, UNSAFE_withErrorBoundaryProps, useRouteError, useActionData, Form } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { AppProvider, Page, Card, FormLayout, Text, TextField, Button } from "@shopify/polaris";
import { AppProvider as AppProvider$1 } from "@shopify/shopify-app-react-router/react";
import { useState, useMemo } from "react";
import { shopifyApp, ApiVersion, boundary, LoginErrorType } from "@shopify/shopify-app-react-router/server";
import "@shopify/shopify-api/adapters/node";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
const streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders
    });
  }
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");
    let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
    let timeoutId = setTimeout(
      () => abort(),
      streamTimeout + 1e3
    );
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              clearTimeout(timeoutId);
              timeoutId = void 0;
              callback();
            }
          });
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          pipe(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
async function loader$4({
  request
}) {
  const url = new URL(request.url);
  const isLogin = url.pathname === "/auth/login";
  return {
    apiKey: process.env.SHOPIFY_API_KEY ?? "",
    isLogin
  };
}
const root = UNSAFE_withComponentProps(function App() {
  const {
    apiKey,
    isLogin
  } = useLoaderData();
  const location = useLocation();
  const showLoginShell = isLogin || location.pathname === "/auth/login";
  const outlet = /* @__PURE__ */ jsx(Outlet, {});
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width,initial-scale=1"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      children: [showLoginShell ? /* @__PURE__ */ jsx(AppProvider, {
        i18n: {},
        children: outlet
      }) : /* @__PURE__ */ jsx(AppProvider$1, {
        embedded: true,
        apiKey,
        children: outlet
      }), /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: root,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
function assertDatabaseUrl(name, value) {
  if (!value) return;
  if (value.startsWith("https://") || value.startsWith("http://")) {
    throw new Error(
      `${name} must be a Supabase Postgres connection string (postgresql://...), not your Render app URL. Fix in Render → tryaura-app → Environment.`
    );
  }
  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
    throw new Error(`${name} must start with postgresql:// — check Render environment variables.`);
  }
}
function getAppUrl() {
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
function validateProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;
  assertDatabaseUrl("DATABASE_URL", process.env.DATABASE_URL);
  assertDatabaseUrl("DIRECT_URL", process.env.DIRECT_URL);
  if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
    throw new Error("SHOPIFY_API_KEY and SHOPIFY_API_SECRET are required.");
  }
}
validateProductionEnv();
let prisma;
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}
const prisma$1 = prisma;
function createSessionStorage() {
  return new PrismaSessionStorage(prisma$1);
}
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  apiVersion: ApiVersion.January25,
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  appUrl: getAppUrl(),
  authPathPrefix: "/auth",
  sessionStorage: createSessionStorage(),
  isEmbeddedApp: true
});
const authenticate = shopify.authenticate;
shopify.unauthenticated;
const login = shopify.login;
shopify.registerWebhooks;
shopify.sessionStorage;
function getDevAdminEmails() {
  return (process.env.DEV_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}
function getDevAdminShops() {
  return (process.env.DEV_ADMIN_SHOPS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function isDevAdminEmail(email) {
  if (!email) return false;
  return getDevAdminEmails().includes(email.toLowerCase());
}
function isDevAdmin(session) {
  if (session.email && isDevAdminEmail(session.email)) return true;
  if (session.shop && getDevAdminShops().includes(session.shop.toLowerCase())) return true;
  return false;
}
function getPlatformAdminSecret() {
  return process.env.PLATFORM_ADMIN_SECRET || "";
}
function getBackendUrl$1() {
  return (process.env.TRYON_BACKEND_URL || process.env.BACKEND_URL || process.env.PUBLIC_BACKEND_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
}
async function fetchPlatformBackend(path, init) {
  const headers2 = new Headers(init == null ? void 0 : init.headers);
  const secret = getPlatformAdminSecret();
  if (secret) {
    headers2.set("x-platform-admin-key", secret);
  }
  headers2.set("Content-Type", "application/json");
  return fetch(`${getBackendUrl$1()}${path}`, { ...init, headers: headers2 });
}
function formatActivityTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}
function formatActivityStatus(status) {
  switch (status) {
    case "completed":
      return {
        label: "Success",
        tone: "ok"
      };
    case "failed":
      return {
        label: "Failed",
        tone: "fail"
      };
    case "processing":
      return {
        label: "Processing",
        tone: "pending"
      };
    case "queued":
      return {
        label: "Queued",
        tone: "pending"
      };
    case "retrying":
      return {
        label: "Retrying",
        tone: "pending"
      };
    default:
      return {
        label: status,
        tone: "pending"
      };
  }
}
function mapActivityItem(item) {
  const status = formatActivityStatus(item.status);
  return {
    id: item.id,
    time: formatActivityTime(item.createdAt),
    productLabel: item.productId ? `Product ${item.productId}` : "Try-on job",
    status: item.status,
    statusLabel: status.label,
    duration: item.processingTimeMs ? `${Math.round(item.processingTimeMs / 1e3)}s` : void 0,
    error: item.error || void 0
  };
}
const defaultSettings = {
  enabled: true,
  aiProvider: "nanobanana",
  buttonText: "Try This Dress",
  buttonColor: "#1a1a2e",
  maxDailyRequests: 100,
  watermarkEnabled: false,
  processingMessage: "Our AI is styling you..."
};
const defaultStats = {
  totalJobs: 0,
  successfulJobs: 0,
  failedJobs: 0,
  successRate: 0,
  averageProcessingTimeMs: 0
};
function getBackendUrl() {
  return process.env.TRYON_BACKEND_URL || process.env.BACKEND_URL || process.env.PUBLIC_BACKEND_URL || "http://127.0.0.1:3001";
}
function getApiKey() {
  return process.env.API_SECRET || process.env.TRYON_API_SECRET || "";
}
async function fetchBackend(path, init) {
  const headers2 = new Headers(init == null ? void 0 : init.headers);
  const apiKey = getApiKey();
  if (apiKey) {
    headers2.set("x-tryon-api-key", apiKey);
  }
  headers2.set("Content-Type", "application/json");
  const response = await fetch(`${getBackendUrl()}${path}`, {
    ...init,
    headers: headers2
  });
  return response;
}
const loader$3 = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const shop = session.shop;
  const shopQuery = `?shop=${encodeURIComponent(shop)}`;
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab");
  const initialTab = tab === "settings" || tab === "install" || tab === "logs" || tab === "dashboard" ? tab : "dashboard";
  let settings = defaultSettings;
  let stats = defaultStats;
  let usage = {
    dailyUsed: 0,
    monthlyUsed: 0
  };
  let activity = [];
  let backendStatus = "unreachable";
  try {
    const [healthRes, settingsRes, statsRes, activityRes] = await Promise.all([fetchBackend("/health"), fetchBackend(`/api/admin/settings${shopQuery}`), fetchBackend(`/api/admin/stats${shopQuery}`), fetchBackend(`/api/admin/activity${shopQuery}`)]);
    if (healthRes.ok) {
      backendStatus = "connected";
    }
    if (settingsRes.status === 401 || statsRes.status === 401) {
      backendStatus = "unauthorized";
    }
    if (settingsRes.ok) {
      const settingsPayload = await settingsRes.json();
      if (settingsPayload.settings) settings = settingsPayload.settings;
      if (settingsPayload.usage) usage = settingsPayload.usage;
      backendStatus = "connected";
    }
    if (statsRes.ok) {
      const statsPayload = await statsRes.json();
      if (statsPayload.stats) stats = statsPayload.stats;
      backendStatus = "connected";
    }
    if (activityRes.ok) {
      const activityPayload = await activityRes.json();
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
    isDevAdmin: isDevAdmin(session)
  };
};
const action$2 = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  const shopQuery = `?shop=${encodeURIComponent(session.shop)}`;
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent === "save-settings") {
    const payload = {
      enabled: formData.get("enabled") === "on",
      aiProvider: String(formData.get("aiProvider") || "nanobanana"),
      buttonText: String(formData.get("buttonText") || defaultSettings.buttonText),
      buttonColor: String(formData.get("buttonColor") || defaultSettings.buttonColor),
      maxDailyRequests: Number(formData.get("maxDailyRequests") || defaultSettings.maxDailyRequests),
      watermarkEnabled: formData.get("watermarkEnabled") === "on",
      processingMessage: String(formData.get("processingMessage") || defaultSettings.processingMessage)
    };
    const response = await fetchBackend(`/api/admin/settings${shopQuery}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return {
        ok: false,
        message: "Could not save settings. Check backend/API key."
      };
    }
    return {
      ok: true,
      message: "Settings saved for your store."
    };
  }
  if (intent === "reset-settings") {
    const response = await fetchBackend(`/api/admin/settings/reset${shopQuery}`, {
      method: "POST"
    });
    if (!response.ok) {
      return {
        ok: false,
        message: "Could not reset settings."
      };
    }
    return {
      ok: true,
      message: "Settings reset to defaults."
    };
  }
  return {
    ok: false,
    message: "Unknown action."
  };
};
const _index = UNSAFE_withComponentProps(function Index() {
  const {
    shop,
    settings,
    stats,
    usage,
    activity,
    backendStatus,
    backendUrl,
    initialTab,
    isDevAdmin: isDevAdmin2
  } = useLoaderData();
  const fetcher = useFetcher();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const selectedProvider = "nanobanana";
  const [buttonText, setButtonText] = useState(settings.buttonText || "Try This Dress 👗");
  const [buttonColor, setButtonColor] = useState(settings.buttonColor || "#1a1a2e");
  const [enabled, setEnabled] = useState(settings.enabled);
  const [watermarkEnabled, setWatermarkEnabled] = useState(settings.watermarkEnabled);
  const [maxDailyRequests, setMaxDailyRequests] = useState(settings.maxDailyRequests || 100);
  const [processingMessage, setProcessingMessage] = useState(settings.processingMessage || "Our AI is styling you...");
  const actionData = fetcher.data;
  const activityLogs = useMemo(() => activity.map(mapActivityItem), [activity]);
  const csvData = useMemo(() => {
    const rows = [["time", "product", "status", "duration_sec", "error"], ...activityLogs.map((log) => [log.time, log.productLabel, log.statusLabel, log.duration || "", log.error || ""])];
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
  <\/script>
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
  const tabTitleMap = {
    dashboard: "Dashboard",
    settings: "Settings",
    install: "Installation Guide",
    logs: "Activity Logs"
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
    fetcher.submit(form, {
      method: "post"
    });
  };
  const resetSettings = () => {
    const form = new FormData();
    form.set("intent", "reset-settings");
    fetcher.submit(form, {
      method: "post"
    });
  };
  const tabHref = (tab) => {
    const params = new URLSearchParams(location.search);
    params.set("tab", tab);
    return `${location.pathname}?${params.toString()}`;
  };
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsx("style", {
      children: dashboardStyles
    }), /* @__PURE__ */ jsxs("div", {
      className: "shell",
      children: [/* @__PURE__ */ jsxs("aside", {
        className: "sidebar",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "sidebar-logo",
          children: [/* @__PURE__ */ jsx("h1", {
            children: "👗 Virtual Try-On"
          }), /* @__PURE__ */ jsx("p", {
            children: "Shopify Plugin Admin"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-sm text-muted",
            style: {
              marginTop: 8
            },
            children: shop
          })]
        }), /* @__PURE__ */ jsxs("nav", {
          className: "sidebar-nav",
          children: [/* @__PURE__ */ jsxs("a", {
            className: `nav-item ${activeTab === "dashboard" ? "active" : ""}`,
            href: tabHref("dashboard"),
            onClick: (event) => {
              event.preventDefault();
              setActiveTab("dashboard");
            },
            children: [/* @__PURE__ */ jsx("span", {
              className: "icon",
              children: "📊"
            }), " Dashboard"]
          }), /* @__PURE__ */ jsxs("a", {
            className: `nav-item ${activeTab === "settings" ? "active" : ""}`,
            href: tabHref("settings"),
            onClick: (event) => {
              event.preventDefault();
              setActiveTab("settings");
            },
            children: [/* @__PURE__ */ jsx("span", {
              className: "icon",
              children: "⚙️"
            }), " Settings"]
          }), /* @__PURE__ */ jsxs("a", {
            className: `nav-item ${activeTab === "install" ? "active" : ""}`,
            href: tabHref("install"),
            onClick: (event) => {
              event.preventDefault();
              setActiveTab("install");
            },
            children: [/* @__PURE__ */ jsx("span", {
              className: "icon",
              children: "🔌"
            }), " Installation"]
          }), /* @__PURE__ */ jsxs("a", {
            className: `nav-item ${activeTab === "logs" ? "active" : ""}`,
            href: tabHref("logs"),
            onClick: (event) => {
              event.preventDefault();
              setActiveTab("logs");
            },
            children: [/* @__PURE__ */ jsx("span", {
              className: "icon",
              children: "📋"
            }), " Activity Logs"]
          }), isDevAdmin2 ? /* @__PURE__ */ jsxs(Link, {
            className: "nav-item",
            to: "/platform",
            children: [/* @__PURE__ */ jsx("span", {
              className: "icon",
              children: "🛠️"
            }), " Platform Admin"]
          }) : null]
        }), /* @__PURE__ */ jsx("div", {
          className: "sidebar-footer",
          children: "v1.0.0 · AI Try-On Plugin"
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "main",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "topbar",
          children: [/* @__PURE__ */ jsx("h2", {
            children: tabTitleMap[activeTab]
          }), /* @__PURE__ */ jsxs("div", {
            className: "topbar-actions",
            children: [/* @__PURE__ */ jsxs("span", {
              className: `badge ${enabled ? "badge-green" : "badge-red"}`,
              children: [/* @__PURE__ */ jsx("span", {
                className: "dot"
              }), " ", enabled ? "Plugin Active" : "Plugin Disabled"]
            }), activeTab === "settings" ? /* @__PURE__ */ jsx("button", {
              className: "btn btn-primary btn-sm",
              onClick: saveSettings,
              children: "💾 Save Changes"
            }) : null]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "content",
          children: [activeTab === "dashboard" ? /* @__PURE__ */ jsxs("div", {
            id: "tab-dashboard",
            children: [actionData ? /* @__PURE__ */ jsx("div", {
              className: `alert ${actionData.ok ? "alert-success" : "alert-error"}`,
              children: actionData.message
            }) : null, backendStatus === "unreachable" ? /* @__PURE__ */ jsx("div", {
              className: "alert alert-error",
              children: "⚠ Backend not reachable. Connect backend to sync settings."
            }) : null, backendStatus === "unauthorized" ? /* @__PURE__ */ jsxs("div", {
              className: "alert alert-info",
              children: ["ℹ Backend is reachable, but admin API auth failed. Set matching ", /* @__PURE__ */ jsx("code", {
                style: {
                  fontFamily: "monospace"
                },
                children: "API_SECRET"
              }), " for frontend and backend."]
            }) : null, backendStatus === "connected" ? /* @__PURE__ */ jsxs("div", {
              className: "alert alert-success",
              children: ["✓ Backend connected at ", backendUrl]
            }) : null, /* @__PURE__ */ jsxs("div", {
              className: "stats-grid",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "stat-card",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "stat-label",
                  children: "Total Try-Ons"
                }), /* @__PURE__ */ jsx("div", {
                  className: "stat-value",
                  children: stats.totalJobs
                }), /* @__PURE__ */ jsx("div", {
                  className: "stat-change",
                  children: stats.totalJobs === 0 ? "No try-ons yet" : "Live from backend"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "stat-card",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "stat-label",
                  children: "Success Rate"
                }), /* @__PURE__ */ jsx("div", {
                  className: "stat-value",
                  children: `${stats.successRate}%`
                }), /* @__PURE__ */ jsx("div", {
                  className: "stat-change",
                  children: stats.totalJobs === 0 ? "—" : "Live from backend"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "stat-card",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "stat-label",
                  children: "Avg. Processing"
                }), /* @__PURE__ */ jsx("div", {
                  className: "stat-value",
                  children: stats.averageProcessingTimeMs ? `${Math.round(stats.averageProcessingTimeMs / 1e3)}s` : "—"
                }), /* @__PURE__ */ jsx("div", {
                  className: "stat-change",
                  children: stats.totalJobs === 0 ? "—" : "Live from backend"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "stat-card",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "stat-label",
                  children: "Failed Jobs"
                }), /* @__PURE__ */ jsx("div", {
                  className: "stat-value",
                  children: stats.failedJobs
                }), /* @__PURE__ */ jsx("div", {
                  className: "stat-change",
                  children: stats.totalJobs === 0 ? "—" : "Live from backend"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "stat-card",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "stat-label",
                  children: "Daily Usage"
                }), /* @__PURE__ */ jsxs("div", {
                  className: "stat-value",
                  children: [usage.dailyUsed, " / ", stats.dailyLimit ?? settings.maxDailyRequests]
                }), /* @__PURE__ */ jsx("div", {
                  className: "stat-change",
                  children: "Resets daily"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "stat-card",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "stat-label",
                  children: "Monthly Usage"
                }), /* @__PURE__ */ jsxs("div", {
                  className: "stat-value",
                  children: [usage.monthlyUsed, " / ", stats.monthlyLimit ?? "—"]
                }), /* @__PURE__ */ jsx("div", {
                  className: "stat-change",
                  children: "Set by TryAura platform"
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "card",
              children: [/* @__PURE__ */ jsx("div", {
                className: "card-header",
                children: /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "card-title",
                    children: "Plugin Controls"
                  }), /* @__PURE__ */ jsx("div", {
                    className: "card-subtitle",
                    children: "Quickly enable or disable features store-wide"
                  })]
                })
              }), /* @__PURE__ */ jsxs("div", {
                className: "toggle-row",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "toggle-info",
                  children: [/* @__PURE__ */ jsx("h4", {
                    children: "Virtual Try-On Button"
                  }), /* @__PURE__ */ jsx("p", {
                    children: 'Show "Try This Dress" button on all product pages'
                  })]
                }), /* @__PURE__ */ jsxs("label", {
                  className: "toggle",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "checkbox",
                    checked: enabled,
                    onChange: (e) => setEnabled(e.target.checked)
                  }), /* @__PURE__ */ jsx("span", {
                    className: "toggle-track"
                  })]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "toggle-row",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "toggle-info",
                  children: [/* @__PURE__ */ jsx("h4", {
                    children: "Mobile Support"
                  }), /* @__PURE__ */ jsx("p", {
                    children: "Display button and modal on mobile devices"
                  })]
                }), /* @__PURE__ */ jsxs("label", {
                  className: "toggle",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "checkbox",
                    defaultChecked: true
                  }), /* @__PURE__ */ jsx("span", {
                    className: "toggle-track"
                  })]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "toggle-row",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "toggle-info",
                  children: [/* @__PURE__ */ jsx("h4", {
                    children: "Download Button"
                  }), /* @__PURE__ */ jsx("p", {
                    children: "Allow customers to download their try-on result"
                  })]
                }), /* @__PURE__ */ jsxs("label", {
                  className: "toggle",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "checkbox",
                    defaultChecked: true
                  }), /* @__PURE__ */ jsx("span", {
                    className: "toggle-track"
                  })]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "toggle-row",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "toggle-info",
                  children: [/* @__PURE__ */ jsx("h4", {
                    children: "Result Watermark"
                  }), /* @__PURE__ */ jsx("p", {
                    children: "Add your store name watermark to generated images"
                  })]
                }), /* @__PURE__ */ jsxs("label", {
                  className: "toggle",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "checkbox",
                    checked: watermarkEnabled,
                    onChange: (e) => setWatermarkEnabled(e.target.checked)
                  }), /* @__PURE__ */ jsx("span", {
                    className: "toggle-track"
                  })]
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "card",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "card-header",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "card-title",
                  children: "Recent Activity"
                }), /* @__PURE__ */ jsx("a", {
                  className: "btn btn-ghost btn-sm",
                  href: tabHref("logs"),
                  onClick: (event) => {
                    event.preventDefault();
                    setActiveTab("logs");
                  },
                  children: "View All →"
                })]
              }), activityLogs.length === 0 ? /* @__PURE__ */ jsxs("p", {
                className: "text-muted text-sm",
                children: ["No try-ons yet for ", shop, "."]
              }) : activityLogs.slice(0, 4).map((log) => /* @__PURE__ */ jsx(ActivityRow, {
                log,
                compact: true
              }, log.id))]
            })]
          }) : null, activeTab === "settings" ? /* @__PURE__ */ jsxs("div", {
            id: "tab-settings",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "card",
              children: [/* @__PURE__ */ jsx("div", {
                className: "card-header",
                children: /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "card-title",
                    children: "AI Provider"
                  }), /* @__PURE__ */ jsx("div", {
                    className: "card-subtitle",
                    children: "Choose your AI processing backend"
                  })]
                })
              }), /* @__PURE__ */ jsx("div", {
                className: "provider-grid",
                children: /* @__PURE__ */ jsxs("div", {
                  className: `provider-option ${"selected"}`,
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "provider-check",
                    children: "✓"
                  }), /* @__PURE__ */ jsx("h4", {
                    children: "🍌 Nano Banana Pro"
                  }), /* @__PURE__ */ jsx("p", {
                    children: "Exclusive model · Production quality · Optimized latency"
                  })]
                })
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-muted",
                style: {
                  marginBottom: 16
                },
                children: "More models coming soon."
              }), /* @__PURE__ */ jsxs("div", {
                className: "form-row",
                children: [/* @__PURE__ */ jsxs("label", {
                  className: "form-label",
                  children: ["API Key ", /* @__PURE__ */ jsx("span", {
                    children: "(stored securely server-side)"
                  })]
                }), /* @__PURE__ */ jsx("input", {
                  type: "text",
                  placeholder: "Enter your Nano Banana Pro API key"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "alert alert-info",
                style: {
                  marginBottom: 0
                },
                children: ["ℹ API keys are stored in your backend ", /* @__PURE__ */ jsx("code", {
                  style: {
                    fontFamily: "monospace"
                  },
                  children: ".env"
                }), " file and never exposed to the browser."]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "card",
              children: [/* @__PURE__ */ jsx("div", {
                className: "card-header",
                children: /* @__PURE__ */ jsx("div", {
                  className: "card-title",
                  children: "Button Appearance"
                })
              }), /* @__PURE__ */ jsxs("div", {
                className: "form-grid-2",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "form-row",
                  style: {
                    marginBottom: 0
                  },
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "form-label",
                    children: "Button Label"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "text",
                    value: buttonText,
                    onChange: (e) => setButtonText(e.target.value)
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "form-row",
                  style: {
                    marginBottom: 0
                  },
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "form-label",
                    children: "Button Colour"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "color",
                    value: buttonColor,
                    onChange: (e) => setButtonColor(e.target.value)
                  })]
                })]
              }), /* @__PURE__ */ jsx("div", {
                className: "mt-2 text-sm text-muted",
                children: "Preview:"
              }), /* @__PURE__ */ jsx("div", {
                style: {
                  marginTop: 10
                },
                children: /* @__PURE__ */ jsx("button", {
                  id: "btn-preview",
                  style: {
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
                    fontFamily: "inherit"
                  },
                  children: buttonText
                })
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "card",
              children: [/* @__PURE__ */ jsx("div", {
                className: "card-header",
                children: /* @__PURE__ */ jsx("div", {
                  className: "card-title",
                  children: "Limits & Messages"
                })
              }), /* @__PURE__ */ jsxs("div", {
                className: "form-grid-2",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "form-row",
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "form-label",
                    children: "Max Daily Requests"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "number",
                    value: maxDailyRequests,
                    onChange: (e) => setMaxDailyRequests(Number(e.target.value)),
                    min: 1,
                    max: 1e4
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "form-row",
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "form-label",
                    children: "Max File Size (MB)"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "number",
                    defaultValue: 10,
                    min: 1,
                    max: 20
                  })]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "form-row",
                children: [/* @__PURE__ */ jsxs("label", {
                  className: "form-label",
                  children: ["Processing Message ", /* @__PURE__ */ jsx("span", {
                    children: "(shown while AI works)"
                  })]
                }), /* @__PURE__ */ jsx("input", {
                  type: "text",
                  value: processingMessage,
                  onChange: (e) => setProcessingMessage(e.target.value)
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "form-row",
                style: {
                  marginBottom: 0
                },
                children: [/* @__PURE__ */ jsxs("label", {
                  className: "form-label",
                  children: ["Error Message ", /* @__PURE__ */ jsx("span", {
                    children: "(shown on failure)"
                  })]
                }), /* @__PURE__ */ jsx("input", {
                  type: "text",
                  defaultValue: "Something went wrong. Please try a clearer photo."
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              style: {
                display: "flex",
                justifyContent: "flex-end",
                gap: 10
              },
              children: [/* @__PURE__ */ jsx("button", {
                className: "btn btn-ghost",
                onClick: resetSettings,
                children: "Reset to Defaults"
              }), /* @__PURE__ */ jsx("button", {
                className: "btn btn-primary",
                onClick: saveSettings,
                children: "💾 Save Settings"
              })]
            })]
          }) : null, activeTab === "install" ? /* @__PURE__ */ jsxs("div", {
            id: "tab-install",
            children: [/* @__PURE__ */ jsx("div", {
              className: "alert alert-info",
              children: "📌 Follow these steps to add the Virtual Try-On plugin to your Shopify theme."
            }), /* @__PURE__ */ jsxs("div", {
              className: "card",
              children: [/* @__PURE__ */ jsx("div", {
                className: "card-title",
                style: {
                  marginBottom: 16
                },
                children: "Step 1 — Upload the Plugin File"
              }), /* @__PURE__ */ jsxs("p", {
                className: "text-sm text-muted",
                style: {
                  marginBottom: 14
                },
                children: ["In your Shopify admin, go to ", /* @__PURE__ */ jsx("strong", {
                  children: "Online Store → Themes → Actions → Edit Code"
                }), ". Under ", /* @__PURE__ */ jsx("strong", {
                  children: "Assets"
                }), ", upload the file ", /* @__PURE__ */ jsx("code", {
                  style: {
                    fontFamily: "monospace"
                  },
                  children: "tryon-widget.js"
                }), "."]
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-muted",
                children: "You can download the latest plugin file here:"
              }), /* @__PURE__ */ jsx("div", {
                style: {
                  marginTop: 12
                },
                children: /* @__PURE__ */ jsx("a", {
                  href: "/tryon-widget.js",
                  download: true,
                  className: "btn btn-primary",
                  children: "⬇ Download tryon-widget.js"
                })
              })]
            }), /* @__PURE__ */ jsx(CodeCard, {
              title: "Step 2 — Add the Liquid Snippet",
              text: "Create a new snippet called tryon-button.liquid and paste this code:",
              code: liquidSnippet
            }), /* @__PURE__ */ jsx(CodeCard, {
              title: "Step 3 — Render in Product Template",
              text: "In your product template (e.g. sections/main-product.liquid), add this line just after your Add-to-Cart button block:",
              code: renderSnippet
            }), /* @__PURE__ */ jsx(CodeCard, {
              title: "Step 4 — Configure Theme Settings",
              text: "Add these settings to your config/settings_schema.json:",
              code: schemaSnippet
            })]
          }) : null, activeTab === "logs" ? /* @__PURE__ */ jsx("div", {
            id: "tab-logs",
            children: /* @__PURE__ */ jsxs("div", {
              className: "card",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "card-header",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "card-title",
                  children: "Activity Log"
                }), /* @__PURE__ */ jsx("a", {
                  className: "btn btn-ghost btn-sm",
                  href: csvHref,
                  download: "tryon-activity.csv",
                  children: "⬇ Export CSV"
                })]
              }), /* @__PURE__ */ jsx("div", {
                children: activityLogs.length === 0 ? /* @__PURE__ */ jsxs("p", {
                  className: "text-muted text-sm",
                  children: ["No activity for ", shop, " yet."]
                }) : activityLogs.map((log) => /* @__PURE__ */ jsx(ActivityRow, {
                  log
                }, log.id))
              })]
            })
          }) : null]
        })]
      })]
    })]
  });
});
function ActivityRow({
  log,
  compact = false
}) {
  const tone = formatActivityStatus(log.status).tone;
  const badgeClass = tone === "ok" ? "badge-green" : tone === "fail" ? "badge-red" : "badge-amber";
  return /* @__PURE__ */ jsxs("div", {
    className: "log-row",
    children: [/* @__PURE__ */ jsx("div", {
      className: `log-status ${tone}`
    }), /* @__PURE__ */ jsxs("div", {
      style: {
        flex: 1
      },
      children: [/* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("strong", {
          children: log.productLabel
        }), !compact && log.error ? /* @__PURE__ */ jsxs(Fragment, {
          children: [" — ", log.error]
        }) : null]
      }), /* @__PURE__ */ jsxs("div", {
        className: "log-meta",
        children: [log.time, log.duration ? ` · ${log.duration}` : ""]
      }), compact && log.error ? /* @__PURE__ */ jsx("div", {
        className: "text-sm",
        style: {
          color: "var(--red)"
        },
        children: log.error
      }) : null]
    }), /* @__PURE__ */ jsx("span", {
      className: `badge ${badgeClass}`,
      children: log.statusLabel
    })]
  });
}
function CodeCard({
  title,
  text,
  code
}) {
  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
  };
  return /* @__PURE__ */ jsxs("div", {
    className: "card",
    children: [/* @__PURE__ */ jsx("div", {
      className: "card-title",
      style: {
        marginBottom: 16
      },
      children: title
    }), /* @__PURE__ */ jsx("p", {
      className: "text-sm text-muted",
      style: {
        marginBottom: 14
      },
      children: text
    }), /* @__PURE__ */ jsxs("div", {
      className: "code-block",
      style: {
        position: "relative"
      },
      children: [/* @__PURE__ */ jsx("button", {
        className: "copy-btn",
        onClick: copyCode,
        children: "Copy"
      }), /* @__PURE__ */ jsx("pre", {
        children: code
      })]
    })]
  });
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
const ErrorBoundary$2 = UNSAFE_withErrorBoundaryProps(function ErrorBoundary() {
  return boundary.error(useRouteError());
});
const headers$2 = boundary.headers;
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary: ErrorBoundary$2,
  action: action$2,
  default: _index,
  headers: headers$2,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const loader$2 = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  if (!isDevAdmin(session)) {
    return {
      accessDenied: true,
      shop: session.shop,
      sessionEmail: session.email || null
    };
  }
  let shops = [];
  try {
    const res = await fetchPlatformBackend("/api/platform/shops");
    if (res.ok) {
      const payload = await res.json();
      shops = payload.shops || [];
    }
  } catch {
    shops = [];
  }
  return {
    accessDenied: false,
    shops,
    backendUrl: getBackendUrl$1()
  };
};
const action$1 = async ({
  request
}) => {
  const {
    session
  } = await authenticate.admin(request);
  if (!isDevAdmin(session)) {
    return {
      ok: false,
      message: "You do not have platform admin access."
    };
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
        platformNotes: String(form.get("platformNotes") || "")
      })
    });
    if (!res.ok) {
      return {
        ok: false,
        message: "Could not update shop limits."
      };
    }
    return {
      ok: true,
      message: `Updated limits for ${shop}.`
    };
  }
  return {
    ok: false,
    message: "Unknown action."
  };
};
const platform = UNSAFE_withComponentProps(function PlatformDashboard() {
  var _a2;
  const data = useLoaderData();
  if (data.accessDenied) {
    return /* @__PURE__ */ jsxs("div", {
      style: {
        padding: 24,
        fontFamily: "system-ui, sans-serif"
      },
      children: [/* @__PURE__ */ jsx("h1", {
        children: "Platform access denied"
      }), /* @__PURE__ */ jsx("p", {
        children: "Your account is not authorized for the platform admin dashboard."
      }), /* @__PURE__ */ jsxs("p", {
        style: {
          color: "#666",
          fontSize: 14
        },
        children: ["Shop: ", /* @__PURE__ */ jsx("code", {
          children: data.shop
        }), data.sessionEmail ? /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("br", {}), "Email: ", /* @__PURE__ */ jsx("code", {
            children: data.sessionEmail
          })]
        }) : /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("br", {}), "No staff email on this session (common with offline tokens)."]
        })]
      }), /* @__PURE__ */ jsxs("p", {
        style: {
          fontSize: 14
        },
        children: ["Ask the app owner to add your email to ", /* @__PURE__ */ jsx("code", {
          children: "DEV_ADMIN_EMAILS"
        }), " or this shop to", " ", /* @__PURE__ */ jsx("code", {
          children: "DEV_ADMIN_SHOPS"
        }), " on Render, then redeploy tryaura-app."]
      }), /* @__PURE__ */ jsx(Link, {
        to: "/",
        style: {
          color: "#1a1a2e"
        },
        children: "← Back to merchant dashboard"
      })]
    });
  }
  const {
    shops,
    backendUrl
  } = data;
  const fetcher = useFetcher();
  const [selectedShop, setSelectedShop] = useState(((_a2 = shops[0]) == null ? void 0 : _a2.shop) || null);
  const selected = shops.find((s) => s.shop === selectedShop) || null;
  const [monthlyLimit, setMonthlyLimit] = useState((selected == null ? void 0 : selected.settings.monthlyGenerationLimit) || 500);
  const [dailyLimit, setDailyLimit] = useState((selected == null ? void 0 : selected.settings.maxDailyRequests) || 100);
  const [plan, setPlan] = useState((selected == null ? void 0 : selected.settings.plan) || "free");
  const [notes, setNotes] = useState((selected == null ? void 0 : selected.settings.platformNotes) || "");
  const [enabled, setEnabled] = useState((selected == null ? void 0 : selected.settings.enabled) ?? true);
  const selectShop = (shop) => {
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
    fetcher.submit(form, {
      method: "post"
    });
  };
  return /* @__PURE__ */ jsxs("div", {
    style: {
      padding: 24,
      fontFamily: "system-ui, sans-serif",
      maxWidth: 1200,
      margin: "0 auto"
    },
    children: [/* @__PURE__ */ jsxs("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24
      },
      children: [/* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("h1", {
          style: {
            margin: 0,
            fontSize: 28
          },
          children: "TryAura Platform Admin"
        }), /* @__PURE__ */ jsx("p", {
          style: {
            margin: "8px 0 0",
            color: "#666"
          },
          children: "Dev dashboard — control generation quotas per store"
        })]
      }), /* @__PURE__ */ jsx(Link, {
        to: "/",
        style: {
          color: "#1a1a2e"
        },
        children: "← Merchant dashboard"
      })]
    }), /* @__PURE__ */ jsxs("p", {
      style: {
        color: "#666",
        fontSize: 14
      },
      children: ["Backend: ", /* @__PURE__ */ jsx("code", {
        children: backendUrl
      })]
    }), fetcher.data ? /* @__PURE__ */ jsx("div", {
      style: {
        padding: 12,
        marginBottom: 16,
        borderRadius: 8,
        background: fetcher.data.ok ? "#ecfdf5" : "#fef2f2",
        color: fetcher.data.ok ? "#065f46" : "#991b1b"
      },
      children: fetcher.data.message
    }) : null, /* @__PURE__ */ jsxs("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: 24
      },
      children: [/* @__PURE__ */ jsx("div", {
        style: {
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden"
        },
        children: /* @__PURE__ */ jsxs("table", {
          style: {
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14
          },
          children: [/* @__PURE__ */ jsx("thead", {
            children: /* @__PURE__ */ jsxs("tr", {
              style: {
                background: "#f9fafb",
                textAlign: "left"
              },
              children: [/* @__PURE__ */ jsx("th", {
                style: {
                  padding: 12
                },
                children: "Store"
              }), /* @__PURE__ */ jsx("th", {
                style: {
                  padding: 12
                },
                children: "Plan"
              }), /* @__PURE__ */ jsx("th", {
                style: {
                  padding: 12
                },
                children: "Monthly"
              }), /* @__PURE__ */ jsx("th", {
                style: {
                  padding: 12
                },
                children: "Today"
              }), /* @__PURE__ */ jsx("th", {
                style: {
                  padding: 12
                },
                children: "Status"
              })]
            })
          }), /* @__PURE__ */ jsx("tbody", {
            children: shops.length === 0 ? /* @__PURE__ */ jsx("tr", {
              children: /* @__PURE__ */ jsx("td", {
                colSpan: 5,
                style: {
                  padding: 24,
                  color: "#666"
                },
                children: "No shops yet. Install TryAura on a dev store first."
              })
            }) : shops.map((row) => /* @__PURE__ */ jsxs("tr", {
              onClick: () => selectShop(row.shop),
              style: {
                cursor: "pointer",
                background: row.shop === selectedShop ? "#eff6ff" : "transparent",
                borderTop: "1px solid #e5e7eb"
              },
              children: [/* @__PURE__ */ jsx("td", {
                style: {
                  padding: 12
                },
                children: row.shop
              }), /* @__PURE__ */ jsx("td", {
                style: {
                  padding: 12
                },
                children: row.settings.plan
              }), /* @__PURE__ */ jsxs("td", {
                style: {
                  padding: 12
                },
                children: [row.usage.monthlyUsed, " / ", row.settings.monthlyGenerationLimit]
              }), /* @__PURE__ */ jsxs("td", {
                style: {
                  padding: 12
                },
                children: [row.usage.dailyUsed, " / ", row.settings.maxDailyRequests]
              }), /* @__PURE__ */ jsx("td", {
                style: {
                  padding: 12
                },
                children: row.settings.enabled ? "Active" : "Disabled"
              })]
            }, row.shop))
          })]
        })
      }), /* @__PURE__ */ jsxs("div", {
        style: {
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20
        },
        children: [/* @__PURE__ */ jsx("h2", {
          style: {
            marginTop: 0,
            fontSize: 18
          },
          children: "Edit quotas"
        }), selected ? /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("p", {
            style: {
              fontSize: 13,
              color: "#666"
            },
            children: selected.shop
          }), /* @__PURE__ */ jsxs("label", {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16
            },
            children: [/* @__PURE__ */ jsx("input", {
              type: "checkbox",
              checked: enabled,
              onChange: (e) => setEnabled(e.target.checked)
            }), "Store enabled"]
          }), /* @__PURE__ */ jsxs("label", {
            style: {
              display: "block",
              marginBottom: 12,
              fontSize: 14
            },
            children: ["Plan", /* @__PURE__ */ jsxs("select", {
              value: plan,
              onChange: (e) => setPlan(e.target.value),
              style: {
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: 8
              },
              children: [/* @__PURE__ */ jsx("option", {
                value: "free",
                children: "free"
              }), /* @__PURE__ */ jsx("option", {
                value: "starter",
                children: "starter"
              }), /* @__PURE__ */ jsx("option", {
                value: "pro",
                children: "pro"
              }), /* @__PURE__ */ jsx("option", {
                value: "enterprise",
                children: "enterprise"
              })]
            })]
          }), /* @__PURE__ */ jsxs("label", {
            style: {
              display: "block",
              marginBottom: 12,
              fontSize: 14
            },
            children: ["Monthly generation limit", /* @__PURE__ */ jsx("input", {
              type: "number",
              value: monthlyLimit,
              onChange: (e) => setMonthlyLimit(Number(e.target.value)),
              style: {
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: 8
              }
            })]
          }), /* @__PURE__ */ jsxs("label", {
            style: {
              display: "block",
              marginBottom: 12,
              fontSize: 14
            },
            children: ["Max daily requests (merchant cap)", /* @__PURE__ */ jsx("input", {
              type: "number",
              value: dailyLimit,
              onChange: (e) => setDailyLimit(Number(e.target.value)),
              style: {
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: 8
              }
            })]
          }), /* @__PURE__ */ jsxs("label", {
            style: {
              display: "block",
              marginBottom: 16,
              fontSize: 14
            },
            children: ["Internal notes", /* @__PURE__ */ jsx("textarea", {
              value: notes,
              onChange: (e) => setNotes(e.target.value),
              rows: 3,
              style: {
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: 8
              }
            })]
          }), /* @__PURE__ */ jsx("button", {
            type: "button",
            onClick: saveShop,
            style: {
              width: "100%",
              padding: "10px 16px",
              background: "#1a1a2e",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600
            },
            children: "Save platform limits"
          })]
        }) : /* @__PURE__ */ jsx("p", {
          style: {
            color: "#666"
          },
          children: "Select a store from the table."
        })]
      })]
    })]
  });
});
const ErrorBoundary$1 = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2() {
  return boundary.error(useRouteError());
});
const headers$1 = boundary.headers;
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary: ErrorBoundary$1,
  action: action$1,
  default: platform,
  headers: headers$1,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
function shopLoginError(error) {
  if (error === LoginErrorType.MissingShop) return "Enter your shop domain";
  if (error === LoginErrorType.InvalidShop) return "Enter a valid .myshopify.com domain";
  return void 0;
}
const loader$1 = async ({
  request
}) => {
  await login(request);
  return null;
};
const action = async ({
  request
}) => {
  const errors = await login(request);
  return errors;
};
const auth_login = UNSAFE_withComponentProps(function AuthLogin() {
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  return /* @__PURE__ */ jsx(Page, {
    narrowWidth: true,
    children: /* @__PURE__ */ jsx(Card, {
      children: /* @__PURE__ */ jsx(Form, {
        method: "post",
        children: /* @__PURE__ */ jsxs(FormLayout, {
          children: [/* @__PURE__ */ jsx(Text, {
            variant: "headingMd",
            as: "h1",
            children: "Log in to TryAura"
          }), /* @__PURE__ */ jsx(TextField, {
            type: "text",
            name: "shop",
            label: "Shop domain",
            helpText: "e.g. my-store.myshopify.com",
            value: shop,
            onChange: setShop,
            autoComplete: "on",
            error: shopLoginError(actionData == null ? void 0 : actionData.shop)
          }), /* @__PURE__ */ jsx(Button, {
            submit: true,
            variant: "primary",
            children: "Continue"
          })]
        })
      })
    })
  });
});
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: auth_login,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
const loader = async ({
  request
}) => {
  await authenticate.admin(request);
  return null;
};
const ErrorBoundary3 = UNSAFE_withErrorBoundaryProps(function ErrorBoundary4() {
  return boundary.error(useRouteError());
});
const headers = (headersArgs) => boundary.headers(headersArgs);
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary: ErrorBoundary3,
  headers,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-10IOWIqu.js", "imports": ["/assets/chunk-5KNZJZUH-C21ORtGP.js", "/assets/index-BnGKNj8E.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/root-B8yv4SJk.js", "imports": ["/assets/chunk-5KNZJZUH-C21ORtGP.js", "/assets/index-BnGKNj8E.js", "/assets/context-DgrDjp5N.js"], "css": ["/assets/root-x1cbIzLV.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/_index-BcYRItR_.js", "imports": ["/assets/chunk-5KNZJZUH-C21ORtGP.js", "/assets/types-D0aIzRCm.js", "/assets/index-CR7vH6Gl.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "ampersand-index": { "id": "ampersand-index", "parentId": "root", "path": "&", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/_index-BcYRItR_.js", "imports": ["/assets/chunk-5KNZJZUH-C21ORtGP.js", "/assets/types-D0aIzRCm.js", "/assets/index-CR7vH6Gl.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "app-index": { "id": "app-index", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/_index-BcYRItR_.js", "imports": ["/assets/chunk-5KNZJZUH-C21ORtGP.js", "/assets/types-D0aIzRCm.js", "/assets/index-CR7vH6Gl.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/platform": { "id": "routes/platform", "parentId": "root", "path": "platform", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/platform-STXW9Itu.js", "imports": ["/assets/chunk-5KNZJZUH-C21ORtGP.js", "/assets/types-D0aIzRCm.js", "/assets/index-CR7vH6Gl.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/auth.login-6QC3hyrn.js", "imports": ["/assets/chunk-5KNZJZUH-C21ORtGP.js", "/assets/types-D0aIzRCm.js", "/assets/context-DgrDjp5N.js", "/assets/index-BnGKNj8E.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": true, "module": "/assets/auth._-Baqtl1oz.js", "imports": ["/assets/chunk-5KNZJZUH-C21ORtGP.js", "/assets/types-D0aIzRCm.js", "/assets/index-CR7vH6Gl.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-2c019857.js", "version": "2c019857", "sri": void 0 };
const assetsBuildDirectory = "build\\client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "v8_passThroughRequests": false, "unstable_trailingSlashAwareDataRequests": false, "unstable_previewServerPrerendering": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route3
  },
  "ampersand-index": {
    id: "ampersand-index",
    parentId: "root",
    path: "&",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "app-index": {
    id: "app-index",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/platform": {
    id: "routes/platform",
    parentId: "root",
    path: "platform",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
