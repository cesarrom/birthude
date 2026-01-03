import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check if active game exists
  const [existing] = await db.select().from(schema.triviaGames).where(and(eq(schema.triviaGames.invitationId, inv.id), eq(schema.triviaGames.status, "active"))).limit(1);
  
  if (existing) {
      return NextResponse.json({ gameId: existing.id });
  }

  const [game] = await db.insert(schema.triviaGames).values({
      invitationId: inv.id,
      status: "active"
  }).returning();

  return NextResponse.json({ gameId: game.id });
}
