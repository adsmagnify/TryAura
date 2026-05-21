import type { LoaderFunctionArgs } from "react-router";

function getBackendUrl() {
  return (
    process.env.TRYON_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.PUBLIC_BACKEND_URL ||
    "https://tryaura-api.onrender.com"
  ).replace(/\/$/, "");
}

/** Public config for storefront widget (CORS). */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop")?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (!shop || !shop.includes(".myshopify.com")) {
    return Response.json(
      { success: false, error: "Valid shop query param required" },
      { status: 400, headers: corsHeaders() },
    );
  }

  return Response.json(
    {
      success: true,
      apiUrl: getBackendUrl(),
      shop,
    },
    { headers: corsHeaders() },
  );
};

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=300",
  };
}

export const headers = corsHeaders;
