/**
 * dLocal Go API integration for server-side payment creation and status checking.
 * Uses dLocal Go REST API v1.
 */

const DLOCAL_GO_API_BASE =
  process.env.DLOCAL_GO_ENV === "live"
    ? "https://api.dlocalgo.com"
    : "https://api-sbx.dlocalgo.com";

function getAuthHeader(): string {
  const apiKey = process.env.DLOCAL_GO_API_KEY;
  const secretKey = process.env.DLOCAL_GO_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error("dLocal Go credentials not configured");
  }

  // dLocal Go uses Bearer auth with format: <API_KEY>:<SECRET_KEY>
  return `Bearer ${apiKey}:${secretKey}`;
}

export interface CreatePaymentParams {
  packageId: string;
  packageName: string;
  priceUsd: number; // in cents
  credits: number;
  userId: string;
}

export interface CreatePaymentResult {
  paymentId: string;
  redirectUrl: string;
}

/**
 * Creates a dLocal Go payment for a package purchase.
 * Note: No country is provided - user will select from list in dLocal Go checkout.
 */
export async function createDLocalPayment(
  params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  const authHeader = getAuthHeader();
  const priceFormatted = (params.priceUsd / 100).toFixed(2);
  const nextAuthUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const response = await fetch(`${DLOCAL_GO_API_BASE}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Number(priceFormatted),
      currency: "USD",
      // No country - user will select from list in dLocal Go checkout
      success_url: `${nextAuthUrl}/buy?success=true&payment_id={payment_id}`,
      back_url: `${nextAuthUrl}/buy?cancelled=true`,
      notification_url: `${nextAuthUrl}/api/payments/webhook`,
      // Optional: add metadata to track the purchase
      description: `${params.packageName} - ${params.credits} invitation credits`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create dLocal Go payment: ${error}`);
  }

  const data = await response.json();

  if (!data.id || !data.redirect_url) {
    throw new Error("Invalid response from dLocal Go: missing payment id or redirect_url");
  }

  return {
    paymentId: data.id,
    redirectUrl: data.redirect_url,
  };
}

export interface PaymentStatusResult {
  status: "PENDING" | "PAID" | "REJECTED" | "CANCELLED" | "REFUNDED" | string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  paymentMethodType?: string;
  createdAt: string;
  updatedAt: string;
  payer?: {
    name?: string;
    email?: string;
    document?: string;
  };
}

/**
 * Gets the status of a dLocal Go payment.
 */
export async function getDLocalPaymentStatus(
  paymentId: string
): Promise<PaymentStatusResult> {
  const authHeader = getAuthHeader();

  const response = await fetch(
    `${DLOCAL_GO_API_BASE}/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: authHeader,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get dLocal Go payment status: ${error}`);
  }

  return response.json();
}

/**
 * Checks if a payment is completed (paid).
 */
export async function isPaymentCompleted(paymentId: string): Promise<boolean> {
  try {
    const status = await getDLocalPaymentStatus(paymentId);
    return status.status === "PAID";
  } catch {
    return false;
  }
}
