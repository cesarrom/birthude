import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { questionId, inviteeIdentifier, content, timeTaken } = await req.json();
  
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [invitee] = await db.select().from(schema.invitees).where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, inviteeIdentifier))).limit(1);
  if (!invitee) return NextResponse.json({ error: "Invitee not found" }, { status: 404 });

  const [question] = await db.select().from(schema.triviaQuestions).where(eq(schema.triviaQuestions.id, questionId)).limit(1);
  if (!question || question.status !== "open") return NextResponse.json({ error: "Question closed" }, { status: 400 });

  // Check if already answered
  const [existing] = await db.select().from(schema.triviaAnswers).where(and(eq(schema.triviaAnswers.questionId, questionId), eq(schema.triviaAnswers.inviteeId, invitee.id))).limit(1);
  if (existing) return NextResponse.json({ error: "Already answered" }, { status: 400 });

  await db.insert(schema.triviaAnswers).values({
      questionId,
      inviteeId: invitee.id,
      content,
      timeTaken: parseFloat(timeTaken),
      isWinner: false
  });

  return NextResponse.json({ ok: true });
}
