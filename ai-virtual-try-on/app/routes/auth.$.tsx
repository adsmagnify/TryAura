import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

async function registerShopWithBackend(shop: string) {
  const backendUrl = (
    process.env.TRYON_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
  const apiSecret = process.env.API_SECRET || "";
  if (!apiSecret) return;

  try {
    await fetch(`${backendUrl}/api/admin/settings?shop=${encodeURIComponent(shop)}`, {
      headers: { "x-tryon-api-key": apiSecret },
    });
  } catch {
    // Non-blocking — merchant dashboard loader will retry
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await registerShopWithBackend(session.shop);
  return null;
};

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
