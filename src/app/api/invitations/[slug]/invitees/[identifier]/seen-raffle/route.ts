import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; identifier: string }> }) {
  const { slug, identifier } = await ctx.params;
  
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(schema.invitees)
    .set({ hasSeenRaffle: true })
    .where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier)));

  return NextResponse.json({ ok: true });
}
