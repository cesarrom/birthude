import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { openrouter } from "@/lib/ai";
import { generateText } from "ai";
import { store } from "@/lib/store";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let inv: any;
  try {
    [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  } catch {
    inv = store.getBySlug(slug);
  }
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raffleLine = inv.rafflePrize ? `Raffle prize: ${inv.rafflePrize}.` : "No raffle.";
  const prompt = `Create a visually stunning, shareable birthday invitation. Theme: ${inv.theme}. Title: ${inv.title}. Description: ${inv.description ?? ""}. Location: ${inv.location}. Date: ${inv.eventAt.toISOString()}. Items to bring: ${inv.items.join(", ")}. ${raffleLine} Include suggestions for animations, graphic motifs, colors, and optional audio snippets. Return JSON with fields: title, subtitle, colorPalette (array), hero (description), sections (array of {title, body}), styleHints (array), and optional audioIdea.`;

  let text = "";
  if (process.env.OPENROUTER_API_KEY) {
    const result = await generateText({ model: openrouter("google/gemini-3-flash-preview"), prompt });
    text = result.text;
  }

  let content: any;
  try {
    content = JSON.parse(text);
  } catch {
    content = { title: inv.title, subtitle: inv.theme, colorPalette: ["#ff67a1", "#2b2d42", "#fff"], hero: "Playful animated confetti and balloons.", sections: [{ title: "Details", body: `${inv.location} on ${new Date(inv.eventAt).toLocaleString()}` }], styleHints: ["rounded shapes", "soft shadows", "slot-machine animation for item assignment"], audioIdea: "Cheerful synth pop jingle" };
  }

  return NextResponse.json({ content });
}