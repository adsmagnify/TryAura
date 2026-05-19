import { useState } from "react";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Form,
  useActionData,
} from "react-router";
import { Button, Card, FormLayout, Page, Text, TextField } from "@shopify/polaris";
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";
import { login } from "../shopify.server";

function shopLoginError(error?: LoginErrorType) {
  if (error === LoginErrorType.MissingShop) return "Enter your shop domain";
  if (error === LoginErrorType.InvalidShop) return "Enter a valid .myshopify.com domain";
  return undefined;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await login(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await login(request);
  return errors;
};

export default function AuthLogin() {
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");

  return (
    <Page narrowWidth>
      <Card>
        <Form method="post">
          <FormLayout>
            <Text variant="headingMd" as="h1">
              Log in to TryAura
            </Text>
            <TextField
              type="text"
              name="shop"
              label="Shop domain"
              helpText="e.g. my-store.myshopify.com"
              value={shop}
              onChange={setShop}
              autoComplete="on"
              error={shopLoginError(actionData?.shop)}
            />
            <Button submit variant="primary">
              Continue
            </Button>
          </FormLayout>
        </Form>
      </Card>
    </Page>
  );
}
