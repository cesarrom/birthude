import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  
  // 1. Get Invitation
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check timing: event must have started at least 1 min ago
  const now = new Date();
  const eventStart = new Date(inv.eventAt);
  const oneMinuteAfterStart = new Date(eventStart.getTime() + 60 * 1000);

  if (now < oneMinuteAfterStart) {
    return NextResponse.json({ error: "Raffle is locked until 1 min after event start" }, { status: 403 });
  }

  // 2. Get all invitees
  const invitees = await db.select().from(schema.invitees).where(eq(schema.invitees.invitationId, inv.id));
  
  if (invitees.length === 0) {
    return NextResponse.json({ error: "No invitees to draw from" }, { status: 400 });
  }

  // 3. Pick random
  const winner = invitees[Math.floor(Math.random() * invitees.length)];

  // 4. Update Invitation
  await db.update(schema.invitations)
    .set({ raffleWinnerIdentifier: winner.identifier })
    .where(eq(schema.invitations.id, inv.id));

  return NextResponse.json({ winnerIdentifier: winner.identifier });
}
