import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // This handles the root URL
  index("routes/_index.tsx"),
  // Shopify embedded navigation can occasionally hit /& during reloads; treat it as dashboard.
  route("&", "routes/_index.tsx", { id: "ampersand-index" }),
  // This handles the Shopify-specific /app URL
  route("app", "routes/_index.tsx", { id: "app-index" }),
  // Login form — must use shopify.login(), not authenticate.admin()
  route("auth/login", "routes/auth.login.tsx"),
  // OAuth callback and other auth paths
  route("auth/*", "routes/auth.$.tsx"),
] satisfies RouteConfig;
