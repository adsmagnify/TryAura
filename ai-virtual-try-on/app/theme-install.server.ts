/** Storefront install: app embed deep link, shop metafields, theme status. */

export const TRYON_EMBED_BLOCK_HANDLE = "tryon-embed";

export type StorefrontInstallStatus = {
  apiUrlConfigured: boolean;
  embedEnabled: boolean;
  themeEditorUrl: string;
};

type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

function parseSettingsData(content: string): { embedEnabled: boolean } {
  try {
    const data = JSON.parse(content) as {
      current?: {
        blocks?: Record<string, { type?: string; disabled?: boolean }>;
      };
    };
    const blocks = data.current?.blocks || {};
    for (const block of Object.values(blocks)) {
      const type = block.type || "";
      if (
        type.includes("/blocks/tryon-embed/") ||
        type.includes("tryon-embed")
      ) {
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

export async function syncShopApiMetafield(
  admin: AdminGraphql,
  backendUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const shopRes = await admin.graphql(`#graphql
    query ShopId {
      shop {
        id
      }
    }
  `);
  const shopJson = (await shopRes.json()) as {
    data?: { shop?: { id?: string } };
    errors?: { message: string }[];
  };
  const shopId = shopJson.data?.shop?.id;
  if (!shopId) {
    return {
      ok: false,
      error: shopJson.errors?.[0]?.message || "Could not load shop id",
    };
  }

  const setRes = await admin.graphql(
    `#graphql
    mutation SetTryAuraApiUrl($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { key }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "tryaura",
            key: "api_url",
            type: "single_line_text_field",
            value: backendUrl,
          },
        ],
      },
    },
  );

  const setJson = (await setRes.json()) as {
    data?: {
      metafieldsSet?: {
        userErrors?: { message: string }[];
      };
    };
    errors?: { message: string }[];
  };

  const userError =
    setJson.data?.metafieldsSet?.userErrors?.[0]?.message ||
    setJson.errors?.[0]?.message;
  if (userError) {
    return { ok: false, error: userError };
  }
  return { ok: true };
}

export async function getStorefrontInstallStatus(
  admin: AdminGraphql,
  shop: string,
  backendUrl: string,
): Promise<StorefrontInstallStatus> {
  let apiUrlConfigured = false;
  let embedEnabled = false;

  try {
    const metaRes = await admin.graphql(`#graphql
      query TryAuraShopMetafield {
        shop {
          metafield(namespace: "tryaura", key: "api_url") {
            value
          }
        }
      }
    `);
    const metaJson = (await metaRes.json()) as {
      data?: { shop?: { metafield?: { value?: string } } };
    };
    const value = metaJson.data?.shop?.metafield?.value?.trim();
    apiUrlConfigured = Boolean(value && value.length > 0);
  } catch {
    apiUrlConfigured = Boolean(backendUrl);
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
    const themeJson = (await themeRes.json()) as {
      data?: {
        themes?: {
          nodes?: Array<{
            files?: {
              nodes?: Array<{
                body?: { content?: string };
              }>;
            };
          }>;
        };
      };
    };
    const content =
      themeJson.data?.themes?.nodes?.[0]?.files?.nodes?.[0]?.body?.content;
    if (content) {
      embedEnabled = parseSettingsData(content).embedEnabled;
    }
  } catch {
    embedEnabled = false;
  }

  return {
    apiUrlConfigured,
    embedEnabled,
    themeEditorUrl: buildThemeEditorActivateUrl(shop),
  };
}
