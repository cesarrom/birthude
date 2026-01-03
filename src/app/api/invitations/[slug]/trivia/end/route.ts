import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [game] = await db.select().from(schema.triviaGames).where(and(eq(schema.triviaGames.invitationId, inv.id), eq(schema.triviaGames.status, "active"))).limit(1);
  if (!game) return NextResponse.json({ error: "No active game" }, { status: 400 });

  // Calculate winner
  // Join answers -> questions -> game
  // Count isWinner=true per invitee
  const results = await db.execute(sql`
    SELECT a.invitee_id, COUNT(*) as wins
    FROM trivia_answers a
    JOIN trivia_questions q ON a.question_id = q.id
    WHERE q.game_id = ${game.id} AND a.is_winner = TRUE
    GROUP BY a.invitee_id
    ORDER BY wins DESC
    LIMIT 1
  `);

  let winnerId = null;
  if (results.rows.length > 0) {
      winnerId = results.rows[0].invitee_id;
      // Get invitee details
      const [invitee] = await db.select().from(schema.invitees).where(eq(schema.invitees.id, winnerId as string));
      if (invitee) {
          await db.update(schema.invitations).set({ raffleWinnerIdentifier: invitee.identifier }).where(eq(schema.invitations.id, inv.id));
      }
  }

  await db.update(schema.triviaGames).set({ status: "finished" }).where(eq(schema.triviaGames.id, game.id));

  return NextResponse.json({ winnerId });
}
