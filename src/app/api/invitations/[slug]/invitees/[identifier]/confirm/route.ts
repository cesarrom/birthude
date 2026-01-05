import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; identifier: string }> }
) {
  const { slug, identifier } = await params;

  try {
    const inv = await db.query.invitations.findFirst({
      where: eq(schema.invitations.slug, slug),
    });

    if (!inv) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    const invitee = await db.query.invitees.findFirst({
      where: and(
        eq(schema.invitees.invitationId, inv.id),
        eq(schema.invitees.identifier, decodeURIComponent(identifier))
      ),
    });

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
