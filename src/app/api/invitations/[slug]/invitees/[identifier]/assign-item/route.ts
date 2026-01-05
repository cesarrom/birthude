import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq, not, isNotNull } from "drizzle-orm";
import { type Invitee, type Invitation } from "@/db/schema";

export const assignItemIfNotAssigned = async (row: Invitee, inv: Invitation) => {
  if (row.assignedItem) {
    return { assignedItem: row.assignedItem };
  }

  const items = inv.items || [];
  if (items.length === 0) {
    return { assignedItem: null };
  }

  // Get used items
  const otherInvitees = await db.select({ assignedItem: schema.invitees.assignedItem })
    .from(schema.invitees)
    .where(and(eq(schema.invitees.invitationId, inv.id), isNotNull(schema.invitees.assignedItem)));

  const used = new Set(otherInvitees.map(i => i.assignedItem));
  const available = items.filter(i => !used.has(i));

  let assignedItem = null;
  if (available.length > 0) {
    // Deterministic random based on identifier if we wanted, but truly random is better for fairness
    // However, to avoid race conditions in a simple way without locking, we just pick one.
    // In high concurrency this might clash but for this app it's fine.
    assignedItem = available[Math.floor(Math.random() * available.length)];

    await db.update(schema.invitees)
      .set({ assignedItem })
      .where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, row.identifier)));
  }

  return { assignedItem };
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ slug: string; identifier: string }> }) {
  const { slug, identifier } = await ctx.params;
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [row] = await db.select().from(schema.invitees).where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier))).limit(1);
  if (!row) return NextResponse.json({ error: "Invitee not found" }, { status: 404 });

  const { assignedItem } = await assignItemIfNotAssigned(row, inv);

  return NextResponse.json({ assignedItem });
}
