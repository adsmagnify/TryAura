/** Storefront install: app embed deep link, shop metafields, theme status. */

export const TRYON_EMBED_BLOCK_HANDLE = "tryon-embed";

/** Default API URL baked into theme embed when metafield sync is unavailable. */
export const DEFAULT_STOREFRONT_API_URL =
  process.env.TRYON_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://tryaura-api.onrender.com";

export type StorefrontInstallStatus = {
  apiUrlConfigured: boolean;
  embedEnabled: boolean;
  themeEditorUrl: string;
  apiUrl: string;
};

type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type GraphqlPayload = {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

async function parseGraphqlResponse(
  response: Response,
): Promise<{ ok: boolean; json: GraphqlPayload; error?: string }> {
  const json = (await response.json()) as GraphqlPayload;
  if (!response.ok) {
    const msg =
      json.errors?.[0]?.message ||
      `Shopify API returned ${response.status}${response.status === 403 ? " — re-open the app from Shopify Admin to grant updated permissions, or use the default API URL in the theme embed." : ""}`;
    return { ok: false, json, error: msg };
  }
  if (json.errors?.length) {
    return { ok: false, json, error: json.errors[0].message };
  }
  return { ok: true, json };
}

function parseSettingsData(content: string): { embedEnabled: boolean } {
  try {
    const data = JSON.parse(content) as {
      current?: {
        blocks?: Record<string, { type?: string; disabled?: boolean }>;
      };
    };
    const blocks = data.current?.blocks || {};
    for (const block of Object.values(blocks)) {
      const type = (block.type || "").toLowerCase();
      if (type.includes("tryon-embed") || type.includes("virtual-try-on")) {
        return { embedEnabled: block.disabled !== true };
      }
    }
  } catch {
    /* ignore parse errors */
  }
  return { embedEnabled: false };
}

export function buildThemeEditorActivateUrl(shop: string): string {
  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const params = new URLSearchParams({
    context: "apps",
    template: "product",
    activateAppId: `${apiKey}/${TRYON_EMBED_BLOCK_HANDLE}`,
  });
  return `https://${shop}/admin/themes/current/editor?${params.toString()}`;
}

/** Sync backend URL to app-owned shop metafield (requires write_metafields + reinstall). */
export async function syncShopApiMetafield(
  admin: AdminGraphql,
  backendUrl: string,
): Promise<{ ok: boolean; error?: string; warning?: string }> {
  const shopRes = await admin.graphql(`#graphql
    query ShopId {
      shop {
        id
      }
    }
  `);
  const shopParsed = await parseGraphqlResponse(shopRes);
  if (!shopParsed.ok) {
    return {
      ok: true,
      warning:
        shopParsed.error ||
        "Could not reach Shopify API. The theme embed default API URL will still work on your storefront.",
    };
  }

  const shopId = (shopParsed.json.data?.shop as { id?: string } | undefined)?.id;
  if (!shopId) {
    return {
      ok: true,
      warning: "Could not read shop id. Theme embed uses its built-in default API URL.",
    };
  }

  const setRes = await admin.graphql(
    `#graphql
    mutation SetTryAuraApiUrl($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { key namespace }
        userErrors { field message code }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "$app",
            key: "api_url",
            type: "single_line_text_field",
            value: backendUrl,
          },
        ],
      },
    },
  );

  const setParsed = await parseGraphqlResponse(setRes);
  const userErrors = (
    setParsed.json.data?.metafieldsSet as
      | { userErrors?: { message: string }[] }
      | undefined
  )?.userErrors;

  if (!setParsed.ok || userErrors?.length) {
    const detail = userErrors?.[0]?.message || setParsed.error;
    const is403 =
      setRes.status === 403 ||
      (detail && /access|permission|403/i.test(detail));

    if (is403) {
      return {
        ok: true,
        warning:
          "API URL metafield could not be saved (missing permission). Reinstall the app from Shopify Admin → Apps to approve new permissions. Your storefront still uses the default URL configured in the theme embed.",
      };
    }
    return {
      ok: false,
      error: detail || "Could not save shop configuration.",
    };
  }

  return { ok: true };
}

export async function getStorefrontInstallStatus(
  admin: AdminGraphql,
  shop: string,
  backendUrl: string,
): Promise<StorefrontInstallStatus> {
  const apiUrl = backendUrl.replace(/\/$/, "") || DEFAULT_STOREFRONT_API_URL;
  let apiUrlConfigured = false;
  let embedEnabled = false;

  try {
    const metaRes = await admin.graphql(`#graphql
      query TryAuraShopMetafields {
        shop {
          appApiUrl: metafield(namespace: "$app", key: "api_url") {
            value
          }
          legacyApiUrl: metafield(namespace: "tryaura", key: "api_url") {
            value
          }
        }
      }
    `);
    const metaParsed = await parseGraphqlResponse(metaRes);
    if (metaParsed.ok) {
      const shopData = metaParsed.json.data?.shop as
        | {
            appApiUrl?: { value?: string };
            legacyApiUrl?: { value?: string };
          }
        | undefined;
      const value =
        shopData?.appApiUrl?.value?.trim() ||
        shopData?.legacyApiUrl?.value?.trim() ||
        "";
      apiUrlConfigured = value.length > 0;
    }
  } catch {
    apiUrlConfigured = false;
  }

  // Theme embed ships with DEFAULT_STOREFRONT_API_URL — counts as configured for merchants
  if (!apiUrlConfigured && apiUrl) {
    apiUrlConfigured = true;
  }

  try {
    const themeRes = await admin.graphql(`#graphql
      query MainThemeSettings {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            id
            files(filenames: ["config/settings_data.json"]) {
              nodes {
                body {
                  ... on OnlineStoreThemeFileBodyText {
                    content
                  }
                }
              }
            }
          }
        }
      }
    `);
    const themeParsed = await parseGraphqlResponse(themeRes);
    if (themeParsed.ok) {
      const themes = themeParsed.json.data?.themes as
        | {
            nodes?: Array<{
              files?: {
                nodes?: Array<{
                  body?: { content?: string };
                }>;
              };
            }>;
          }
        | undefined;
      const content = themes?.nodes?.[0]?.files?.nodes?.[0]?.body?.content;
      if (content) {
        embedEnabled = parseSettingsData(content).embedEnabled;
      }
    }
  } catch {
    embedEnabled = false;
  }

  return {
    apiUrlConfigured,
    embedEnabled,
    themeEditorUrl: buildThemeEditorActivateUrl(shop),
    apiUrl,
  };
}
