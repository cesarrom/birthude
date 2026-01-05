import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; identifier: string }> }
) {
  const { slug, identifier } = await params;

  try {
    const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);

    if (!inv) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    const [invitee] = await db.select().from(schema.invitees).where(and(
        eq(schema.invitees.invitationId, inv.id),
        eq(schema.invitees.identifier, decodeURIComponent(identifier))
      )).limit(1);

    if (!invitee) {
      return NextResponse.json({ error: "Invitee not found" }, { status: 404 });
    }

    await db
      .update(schema.invitees)
      .set({ isConfirmed: true })
      .where(eq(schema.invitees.id, invitee.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Confirm assistance error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
