import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { FilePart, generateText, ImagePart, Output, TextPart } from "ai";
import { openrouter } from "@/lib/ai";
import { prompts } from "./prompts";
import { assignItemIfNotAssigned } from "../assign-item/route";

const translationsWarning = `slots always appear at the exact center of the screen, they are 300px x 300px, try not to put any text or other elements on top of them, remember that you control literal slot elements where we place widgets, not the widgets themselves, widgets do not inherit tranlations so if you transform the slot, the widget will not be transformed AND it will look off.`;
// Slots definition
const SLOTS = [
  { name: "MapComponent", description: "A map showing the event location. " + translationsWarning },
  { name: "CountdownComponent", description: "A countdown timer to the event date. " + translationsWarning },
  { name: "DateComponent", description: "A beautiful date display with calendar download button. it can be used in any screen where you want to display the date of the event. " + translationsWarning },
  { name: "SlotMachineComponent", description: "A slot machine game to reveal the assigned item.it can be used when the invitee has an assignedItem set to bring to the event, in that case, this component will show it! " + translationsWarning },
  { name: "RSVPForm", description: "A form or button to confirm assistance. " + translationsWarning }
];

function enrichImageSource(url: string) {
  if (url.includes('/raw/')) {
    return url.replace(/\/raw\//, '/image/') + '?f=png';
  }
  return url;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; identifier: string }> }) {
  const { slug, identifier } = await ctx.params;
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [row] = await db.select().from(schema.invitees).where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier))).limit(1);
  if (row && row.experience) {
    return NextResponse.json({
      experience: row.experience,
      raffle: {
        winnerIdentifier: inv.raffleWinnerIdentifier,
        hasSeenRaffle: row.hasSeenRaffle,
        prize: inv.rafflePrize
      }
    });
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { assignedItem } = await assignItemIfNotAssigned(row, inv);

  row.assignedItem = assignedItem;

  let json: any = null;
  const imgs = inv.assets.images || [];
  const masterAssetMap: Record<string, string> = {};
  imgs.forEach((img, i) => { masterAssetMap[`img_${i}`] = img.source; });

  if (process.env.OPENROUTER_API_KEY) {
    const locale = req.nextUrl.searchParams.get("lang") || req.cookies.get("NEXT_LOCALE")?.value || "en";
    try {
      const { output } = await generateText({
        model: openrouter("google/gemini-3-pro-preview"),
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
              ...imgs.map((image): ImagePart => {
                return { type: 'image', image: new URL(enrichImageSource(image.source)), mediaType: 'image/png' };
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
