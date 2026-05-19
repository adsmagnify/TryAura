import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // This handles the root URL
  index("routes/_index.tsx"),
  // Shopify embedded navigation can occasionally hit /& during reloads; treat it as dashboard.
  route("&", "routes/_index.tsx", { id: "ampersand-index" }),
  // This handles the Shopify-specific /app URL
  route("app", "routes/_index.tsx", { id: "app-index" }),
  // This handles all auth-related requests (like session-token)
  route("auth/*", "routes/auth.$.tsx"),
] satisfies RouteConfig;
