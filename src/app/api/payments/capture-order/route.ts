import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { payments, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getDLocalPaymentStatus } from "@/lib/dlocal";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { paymentId } = await req.json();

    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
    }

    // Find the pending payment
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.providerPaymentId, paymentId));

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (payment.status === "completed") {
      return NextResponse.json({
        success: true,
        message: "Payment already processed",
        credits: payment.creditsGranted
      });
    }

    // Check payment status from dLocal Go
    const status = await getDLocalPaymentStatus(paymentId);

    if (status.status !== "PAID") {
      await db
        .update(payments)
        .set({ status: "failed" })
        .where(eq(payments.id, payment.id));

      return NextResponse.json({
        error: `Payment status: ${status.status}`
      }, { status: 400 });
    }

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
      .where(eq(users.id, session.user.id));

    return NextResponse.json({
      success: true,
      credits: payment.creditsGranted,
      message: `Added ${payment.creditsGranted} credits to your account!`,
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
