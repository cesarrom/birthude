import { NextResponse } from "next/server";
import { db } from "@/db";
import { invitationPackages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const packages = await db
      .select()
      .from(invitationPackages)
      .where(eq(invitationPackages.isActive, true))
      .orderBy(invitationPackages.credits);

    return NextResponse.json(packages);
  } catch (error) {
    console.error("Get packages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch packages" },
      { status: 500 }
    );
  }
}
