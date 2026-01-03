import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { generateText } from "ai";
import { openrouter } from "@/lib/ai";

function slotPrompt(inv: any, invitee: any) {
  return `Design a single inline SVG for a playful casino slot-machine frame themed for a ${inv.theme} birthday invitation.
Requirements:
- Return ONLY SVG markup as a string.
- width=256 height=128 viewBox="0 0 256 128".
- Use rounded corners, subtle gradients, and decorative details.
- Foreground frame with space for three reels (we will animate reels in CSS).
- Palette inspired by: ${JSON.stringify(inv.theme)} and ${JSON.stringify(inv.assets?.images ?? [])}.
Personalization: for ${invitee.name ?? invitee.identifier}.
No external references, all shapes inline.`;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string; identifier: string }> }) {
  const { slug, identifier } = await ctx.params;
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [row] = await db.select().from(schema.invitees).where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier))).limit(1);
  if (!row) return NextResponse.json({ error: "Invitee not found" }, { status: 404 });
  const exp: any = row.experience;
  if (exp?.slotSvg) return NextResponse.json({ slotSvg: exp.slotSvg });
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ slug: string; identifier: string }> }) {
  const { slug, identifier } = await ctx.params;
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [row] = await db.select().from(schema.invitees).where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier))).limit(1);
  if (!row) return NextResponse.json({ error: "Invitee not found" }, { status: 404 });

  let svg = "";
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const { text } = await generateText({ model: openrouter("openrouter/auto"), prompt: slotPrompt(inv, row) });
      if (String(text).trim().startsWith("<svg")) svg = String(text).trim();
    } catch {}
  }
  if (!svg) {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="128" viewBox="0 0 256 128"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ff67a1"/><stop offset="1" stop-color="#6c5ce7"/></linearGradient></defs><rect x="4" y="4" rx="16" ry="16" width="248" height="120" fill="url(#g)" stroke="#fff" stroke-opacity="0.6"/><rect x="24" y="32" rx="10" ry="10" width="208" height="64" fill="#ffffff22" stroke="#fff" stroke-opacity="0.4"/><rect x="36" y="40" rx="6" ry="6" width="56" height="48" fill="#00000022"/><rect x="100" y="40" rx="6" ry="6" width="56" height="48" fill="#00000022"/><rect x="164" y="40" rx="6" ry="6" width="56" height="48" fill="#00000022"/><circle cx="230" cy="24" r="6" fill="#fff"/></svg>`;
  }

  const exp = { ...(row.experience as any ?? {}), slotSvg: svg };
  await db.update(schema.invitees)
    .set({ experience: exp })
    .where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier)));

  return NextResponse.json({ slotSvg: svg }, { status: 201 });
}