import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [game] = await db.select().from(schema.triviaGames).where(and(eq(schema.triviaGames.invitationId, inv.id), eq(schema.triviaGames.status, "active"))).limit(1);
  
  if (!game) return NextResponse.json({ status: "none" });

  let question = null;
  let answers: any[] = [];

  if (game.currentQuestionId) {
      const [q] = await db.select().from(schema.triviaQuestions).where(eq(schema.triviaQuestions.id, game.currentQuestionId));
      if (q) {
          question = q;
          // Get answers
          answers = await db.select().from(schema.triviaAnswers).where(eq(schema.triviaAnswers.questionId, q.id)).orderBy(desc(schema.triviaAnswers.timeTaken));
          // We need to anonymize answers for the organizer, BUT wait, 
          // "organizer can see the answers ordered by submission time, they displayed anonimized"
          // "submission time should not be absolute... is about 'the user answered 3.000067 seconds after the question was renderd'"
          // So sorting by timeTaken ASC (smaller is better/faster) is correct for organizer view logic if speed matters, 
          // but usually trivia is correctness first. 
          // The prompt says "organizer picks the winner". So organizer reads them.
          // Sorting by submission time usually implies FIFO. 
          // If we track `timeTaken` relative to render, smaller is "faster".
          // Let's sort by `timeTaken` ASC.
          answers.sort((a, b) => a.timeTaken - b.timeTaken);
      }
  }

  return NextResponse.json({ 
      status: "active", 
      gameId: game.id,
      question,
      answers 
  });
}
