import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { payments, invitationPackages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userPayments = await db
      .select({
        id: payments.id,
        status: payments.status,
        amountUsd: payments.amountUsd,
        creditsGranted: payments.creditsGranted,
        createdAt: payments.createdAt,
        completedAt: payments.completedAt,
        packageName: invitationPackages.name,
      })
      .from(payments)
      .leftJoin(invitationPackages, eq(payments.packageId, invitationPackages.id))
      .where(eq(payments.userId, session.user.id))
      .orderBy(desc(payments.createdAt));

    return NextResponse.json(userPayments);
  } catch (error) {
    console.error("Get payments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    );
  }
}
