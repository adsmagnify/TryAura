import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
} from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import "@shopify/polaris/build/esm/styles.css";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const isLogin = url.pathname === "/auth/login";
  return {
    apiKey: process.env.SHOPIFY_API_KEY ?? "",
    isLogin,
  };
}

export default function App() {
  const { apiKey, isLogin } = useLoaderData<typeof loader>();
  const location = useLocation();
  const showLoginShell = isLogin || location.pathname === "/auth/login";

  const outlet = <Outlet />;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {showLoginShell ? (
          <PolarisAppProvider i18n={{}}>{outlet}</PolarisAppProvider>
        ) : (
          <ShopifyAppProvider embedded apiKey={apiKey}>
            {outlet}
          </ShopifyAppProvider>
        )}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
