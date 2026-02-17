import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getDLocalPaymentStatus } from "@/lib/dlocal";

/**
 * Webhook handler for dLocal Go payment notifications.
 * dLocal Go sends notifications when payment status changes.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify the webhook signature if dLocal Go provides one
    // For now, we check the payment status directly with dLocal Go API

    const body = await req.json();
    const paymentId = body.payment_id || body.id;

    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
    }

    // Find the payment in our database
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.providerPaymentId, paymentId));

    if (!payment) {
      console.log(`Webhook: Payment not found for ${paymentId}`);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Skip if already completed
    if (payment.status === "completed") {
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    // Verify payment status with dLocal Go API
    const status = await getDLocalPaymentStatus(paymentId);

    if (status.status === "PAID" && payment.status !== "completed") {
      // Update payment to completed
      await db
        .update(payments)
        .set({
          status: "completed",
          providerPayerId: status.payer?.email || null,
          completedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      // Add credits to user
      await db
        .update(users)
        .set({
          credits: sql`${users.credits} + ${payment.creditsGranted}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, payment.userId));

      console.log(`Webhook: Payment ${paymentId} completed, credits added`);
      return NextResponse.json({ success: true, message: "Payment processed" });
    }

    if (status.status === "REJECTED" || status.status === "CANCELLED") {
      await db
        .update(payments)
        .set({ status: "failed" })
        .where(eq(payments.id, payment.id));

      return NextResponse.json({ success: true, message: "Payment marked as failed" });
    }

    // For other statuses (PENDING, etc.), just acknowledge
    return NextResponse.json({ success: true, message: "Notification received" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

/**
 * GET handler for dLocal Go webhook verification (if needed).
 * Some payment providers verify webhooks with a GET request first.
 */
export async function GET(req: NextRequest) {
  const paymentId = req.nextUrl.searchParams.get("payment_id");

  if (!paymentId) {
    return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
  }

  try {
    const status = await getDLocalPaymentStatus(paymentId);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Webhook GET error:", error);
    return NextResponse.json(
      { error: "Failed to get payment status" },
      { status: 500 }
    );
  }
}
