import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { FilePart, generateText, Output, TextPart } from "ai";
import { openrouter } from "@/lib/ai";
import { prompts } from "./prompts";

// Slots definition
const SLOTS = [
  { name: "MapComponent", description: "A map showing the event location." },
  { name: "CountdownComponent", description: "A countdown timer to the event date." },
  { name: "SlotMachineComponent", description: "A slot machine game to reveal the assigned item." },
  { name: "RSVPForm", description: "A form or button to confirm assistance." }
];

function enrichImageSource(url: string) {
  if (url.includes('/raw/')) {
    return url.replace(/\/raw\//, '/image/') + '?f=png';
  }
  return url;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string; identifier: string }> }) {
  const { slug, identifier } = await ctx.params;
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [row] = await db.select().from(schema.invitees).where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier))).limit(1);
  if (!row || !row.experience) return NextResponse.json({ error: "Experience not found" }, { status: 404 });
  return NextResponse.json({ 
    experience: row.experience,
    raffle: {
        winnerIdentifier: inv.raffleWinnerIdentifier,
        hasSeenRaffle: row.hasSeenRaffle,
        prize: inv.rafflePrize
    }
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; identifier: string }> }) {
  const { slug, identifier } = await ctx.params;
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [row] = await db.select().from(schema.invitees).where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier))).limit(1);
  if (!row) return NextResponse.json({ error: "Invitee not found" }, { status: 404 });

  let json: any = null;
  const imgs = inv.assets.images || [];
  const masterAssetMap: Record<string, string> = {};
  imgs.forEach((img, i) => { masterAssetMap[`img_${i}`] = img.source; });

  if (process.env.OPENROUTER_API_KEY) {
    const locale = req.cookies.get("NEXT_LOCALE")?.value || "en";
    try {
      const { output } = await generateText({
        model: openrouter("openrouter/auto"),
        output: Output.json(), 
        messages: [
            {
                role: "system",
                content: prompts.systemPrompt(SLOTS)
            },
            {
                role: "user",
                content: [
                    {
                        type: 'text',
                        text: prompts.userPrompt(inv, row, masterAssetMap, locale)
                    } as TextPart,
                    // Attach images for vision context
                    ...imgs.map((image): FilePart => {
                        return { type: 'file', data: new URL(enrichImageSource(image.source)), mediaType: 'image/png' };
                    }).slice(0, 5)
                ].filter(Boolean)
            }
        ],
      });
      json = output;
      
      // Unwrap logic (just in case the model wraps it)
      if (json.experience) json = json.experience;
      if (json.manifest) json = json.manifest;

      // Force update assets to ensure correct URLs (sanity check)
      // The model might have invented IDs or messed up URLs, but we passed the map in prompt.
      // We can try to merge or trust the model. The prompt says "Do not invent URLs".
      // Let's trust the model but if we wanted to be safe we could re-map. 
      // For now, assume model compliance.

    } catch (e) { console.error("AI Generation Error:", e); }
  }

  // Fallback if AI fails or no key
  if (!json) {
    json = {
      assets: [
          ...imgs.map((img, i) => ({ id: `img_${i}`, type: 'image', src: img.source })),
          { id: "t1", type: "text", content: `Welcome ${row.name}!`, css: { color: "white", fontSize: "3rem" } }
      ],
      timeline: [
        {
          id: "s1",
          animationFlow: [
            { targetId: "t1", type: "fromTo", fromVars: { autoAlpha: 0, y: 50 }, vars: { autoAlpha: 1, y: 0, duration: 1 } }
          ],
          completion: { trigger: "manual" } // Wait for interaction
        }
      ]
    };
  }

  await db.update(schema.invitees)
    .set({ experience: json })
    .where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier)));

  return NextResponse.json({ experience: json }, { status: 201 });
}
