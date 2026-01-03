import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { content } = await req.json();
  
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [game] = await db.select().from(schema.triviaGames).where(and(eq(schema.triviaGames.invitationId, inv.id), eq(schema.triviaGames.status, "active"))).limit(1);
  if (!game) return NextResponse.json({ error: "No active game" }, { status: 400 });

  // Close previous question if any
  if (game.currentQuestionId) {
      await db.update(schema.triviaQuestions).set({ status: "closed" }).where(eq(schema.triviaQuestions.id, game.currentQuestionId));
  }

  const [question] = await db.insert(schema.triviaQuestions).values({
      gameId: game.id,
      content,
      status: "open"
  }).returning();

  await db.update(schema.triviaGames).set({ currentQuestionId: question.id }).where(eq(schema.triviaGames.id, game.id));

  return NextResponse.json({ questionId: question.id });
}
