import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { answerId } = await req.json();
  
  await db.update(schema.triviaAnswers).set({ isWinner: true }).where(eq(schema.triviaAnswers.id, answerId));
  
  // Close the question associated with this answer
  const [ans] = await db.select().from(schema.triviaAnswers).where(eq(schema.triviaAnswers.id, answerId)).limit(1);
  if (ans) {
      await db.update(schema.triviaQuestions).set({ status: "closed" }).where(eq(schema.triviaQuestions.id, ans.questionId));
  }

  return NextResponse.json({ ok: true });
}
