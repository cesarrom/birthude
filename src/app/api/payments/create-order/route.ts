import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { invitationPackages, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createDLocalPayment } from "@/lib/dlocal";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { packageId } = await req.json();

    if (!packageId) {
      return NextResponse.json({ error: "Package ID is required" }, { status: 400 });
    }

    // Get the package
    const [pkg] = await db
      .select()
      .from(invitationPackages)
      .where(eq(invitationPackages.id, packageId));

    if (!pkg || !pkg.isActive) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Create dLocal Go payment
    const { paymentId, redirectUrl } = await createDLocalPayment({
      packageId: pkg.id,
      packageName: pkg.name,
      priceUsd: pkg.priceUsd,
      credits: pkg.credits,
      userId: session.user.id,
    });

    // Create pending payment record
    await db.insert(payments).values({
      userId: session.user.id,
      packageId: pkg.id,
      providerPaymentId: paymentId,
      status: "pending",
      amountUsd: pkg.priceUsd,
      creditsGranted: pkg.credits,
    });

    return NextResponse.json({ paymentId, redirectUrl });
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}
