/**
 * PayPal REST API integration for server-side order creation and capture.
 * Uses PayPal Orders API v2.
 */

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get PayPal access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

export interface CreateOrderParams {
  packageId: string;
  packageName: string;
  priceUsd: number; // in cents
  credits: number;
}

export interface CreateOrderResult {
  orderId: string;
  approvalUrl: string;
}

/**
 * Creates a PayPal order for a package purchase.
 */
export async function createPayPalOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const accessToken = await getAccessToken();
  const priceFormatted = (params.priceUsd / 100).toFixed(2);

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.packageId,
          description: `${params.packageName} - ${params.credits} invitation credits`,
          amount: {
            currency_code: "USD",
            value: priceFormatted,
          },
        },
      ],
      application_context: {
        brand_name: "Birthude",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${process.env.NEXTAUTH_URL}/buy?success=true`,
        cancel_url: `${process.env.NEXTAUTH_URL}/buy?cancelled=true`,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PayPal order: ${error}`);
  }

  const data = await response.json();
  const approvalUrl = data.links.find((l: { rel: string }) => l.rel === "approve")?.href;

  if (!approvalUrl) {
    throw new Error("PayPal approval URL not found in response");
  }

  return {
    orderId: data.id,
    approvalUrl,
  };
}

export interface CaptureOrderResult {
  success: boolean;
  payerId?: string;
  payerEmail?: string;
  captureId?: string;
  error?: string;
}

/**
 * Captures a PayPal order after user approval.
 */
export async function capturePayPalOrder(orderId: string): Promise<CaptureOrderResult> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error: `Capture failed: ${error}` };
  }

  const data = await response.json();

  if (data.status !== "COMPLETED") {
    return { success: false, error: `Order status: ${data.status}` };
  }

  return {
    success: true,
    payerId: data.payer?.payer_id,
    payerEmail: data.payer?.email_address,
    captureId: data.purchase_units?.[0]?.payments?.captures?.[0]?.id,
  };
}

/**
 * Gets details of a PayPal order.
 */
export async function getPayPalOrder(orderId: string) {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get order: ${await response.text()}`);
  }

  return response.json();
}
