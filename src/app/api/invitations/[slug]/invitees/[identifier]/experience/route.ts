import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { FilePart, generateText, ModelMessage, Output, TextPart } from "ai";
import { openrouter } from "@/lib/ai";
import type { Invitation, Invitee } from "@/db/schema";
import { z } from "zod";
import zodToJsonSchema from 'zod-to-json-schema';

// New GSAP-based schema
const tweenSchema = z.object({
  from: z.record(z.string(), z.any()).optional(),
  to: z.record(z.string(), z.any()).optional(),
  duration: z.number().optional(),
  delay: z.number().optional(),
  ease: z.string().optional(),
  yoyo: z.boolean().optional(),
  repeat: z.number().optional(),
});

const legacyActionSchema = z.object({
  type: z.string(),
  target: z.record(z.string(), z.any()).optional(),
  targetScale: z.number().optional(),
  duration: z.number().optional(),
  ease: z.string().optional(),
  intensity: z.number().optional(),
  speed: z.number().optional(),
  y_amplitude: z.number().optional(),
});

const experienceSchema = z.object({
  projectSettings: z.object({
    aspectRatio: z.string().optional(),
    defaultDuration: z.number().optional(),
  }).optional(),
  screens: z.array(z.object({
    id: z.string(),
    duration: z.number().optional(),
    bg: z.string().optional(),
    titleColor: z.string().optional(),
    textColor: z.string().optional(),
    buttonColor: z.string().optional(),
    buttonTextColor: z.string().optional(),
    text: z.string().optional(),
    title: z.string().optional(),
    actors: z.array(z.object({
      assetId: z.string(),
      uniqueId: z.string(),
      type: z.enum(['image', 'svg', 'emoji', 'text']).optional(),
      content: z.string().optional(),
      layout: z.record(z.string(), z.any()),
      actions: z.object({
        entrance: z.union([legacyActionSchema, z.array(tweenSchema)]).optional(),
        exit: z.union([legacyActionSchema, z.array(tweenSchema)]).optional(),
        idle: z.union([legacyActionSchema, z.array(tweenSchema)]).optional(),
      }).optional(),
    })).optional(),
  })),
  assets: z.record(z.string(), z.string()),
});

const schemaAsTypeString = JSON.stringify(
  zodToJsonSchema(experienceSchema as any, {
    name: 'ExperienceSchema',
    $refStrategy: 'none',
  })
);

function enrichImageSource(url: string) {
  if (url.includes('/raw/')) {
    return url.replace(/\/raw\//, '/image/') + '?f=png';
  }
  return url;
}

function buildPrompt(inv: Invitation, invitee: Invitee, locale: string = "en"): ModelMessage[] {
  // Map invitation assets to a simplified list for the AI
  const assetMap = [
    ...(inv.assets?.images ?? []).map((img, i) => ({ id: `img_${i}`, type: 'image', url: img.source, name: img.name })),
    // Add some default SVGs or emojis if needed as "virtual" assets
  ];

  const assetListString = assetMap.map(a => `${a.id}: ${a.name} (${a.type}) - ${a.url}`).join('\n');

  return [
    {
      role: "user",
      content: [
        {
          type: 'text',
          text: `Design a 6-screen (important, there are 6 screens) rewind experience for ${invitee.name ?? invitee.identifier}. Return ONLY JSON, Not additional characters, not event "json\`\`\`...\`\`\`" because your response is going directly to JSON.parse function, follow this schema:
${schemaAsTypeString}

CRITICAL: You MUST write witty, warm, and personalized copy for the "title" and "text" fields of EACH screen.
- Use the invitee's name (${invitee.name ?? invitee.identifier}).
- Make it feel like a story.
- "title" should be short and punchy.
- "text" can be a sentence or two.
- **LANGUAGE**: Generate ALL content in language code: "${locale}".

CRITICAL LAYOUT & ASSET INSTRUCTIONS:
- Use MULTIPLE images (3-5) per screen to create a dynamic collage. Do NOT just use 1 image.
- Reuse available assets! You can use the same "img_X" multiple times in different positions or screens.
- DISTRIBUTE elements across the WHOLE screen (top-left, center, bottom-right, etc.). Do not cluster everything at the top-left.
- Use PERCENTAGE-based positioning for "layout" (e.g., top: "20%", left: "50%", width: "30%") to ensure responsiveness. Avoid fixed pixels like "20px".
- Create overlapping effects by varying z-index and positions.

CRITICAL VISUALS:
- Provide a unique, vibrant "bg" (background) for EACH screen. 
- Use hex codes (e.g., "#FF5733") or linear-gradients (e.g., "linear-gradient(45deg, #FF9A9E, #FECFEF)").
- Match the background to the screen's mood.
- Do NOT use plain black or dark gray unless it fits a specific "night" theme.
- **COLORS**: You MUST provide:
  - "titleColor": High contrast against the bg.
  - "textColor": High contrast against the bg.
  - "buttonColor": A color that stands out from the bg.
  - "buttonTextColor": High contrast against the buttonColor.

The schema defines a GSAP-compatible animation timeline.
- "screens": 6 Sequential containers.
- "actors": Elements on the screen.
- "layout": Initial CSS styles (top, left, width, opacity, transform, etc.).
- "actions": Animations. "entrance" runs at start. "idle" loops. "exit" runs at end.
- "assets": Map of assetId to URL.

Available Assets (use these IDs):
${assetListString}
You can also create text/emoji actors by setting type="text"/"emoji" and content="...".

Screens to generate:
1. Greeting (Hi [name], you're invited to [event])
2. Date (Save the date: [date])
3. Details (Theme: [theme] at [location])
4. Items (Bring: [items...] - SKIP this screen if "items" list in Context is empty)
5. Prize (Win: [prize] - skip if prize is null)
6. Closing (We'll be waiting!)

you can vary the copy a bit for each screen, based on the information provided in context but keep the core message.

Context: ${JSON.stringify({ invitation: { title: inv.title, theme: inv.theme, eventAt: inv.eventAt, location: inv.location, items: inv.items, rafflePrize: inv.rafflePrize }, invitee: { name: invitee.name, identifier: invitee.identifier, age: invitee.age } })}`
        } as TextPart,
        // We still attach images for vision capabilities if needed, though we rely on the asset list above
        ...inv.assets.images.map((image): FilePart => {
           // Basic URL fixup for bytescale if needed
           return { type: 'file', data: new URL(enrichImageSource(image.source)), mediaType: 'image/png' };
        }).slice(0, 5) // Limit to 5 context images
      ].filter(Boolean)
    },
  ];
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
        output: Output.json(), // Use flexible JSON output as strict object schema causes hallucinations
        messages: buildPrompt(inv, row, locale),
      });
      json = output;
      
      // Unwrap if wrapped in definitions or experience key
      if (json.experience?.definitions?.ExperienceSchema) json = json.experience.definitions.ExperienceSchema;
      else if (json.definitions?.ExperienceSchema) json = json.definitions.ExperienceSchema;
      else if (json.experience) json = json.experience;

      // Force update assets to ensure correct URLs
      json.assets = { ...json.assets, ...masterAssetMap };

      // Generate "You are in" dashboard configuration
      const dashboardPrompt = [
        {
          role: "user",
          content: `Generate a configuration for the "You are in" dashboard screen for ${row.name || row.identifier}.
          Return ONLY JSON, Not additional characters, not event "json\`\`\`...\`\`\`" because your response is going directly to JSON.parse function, follow this schema:
          {
            "bg": "string (hex or gradient)",
            "titleColor": "string (hex)",
            "textColor": "string (hex)",
            "buttonColor": "string (hex)",
            "buttonTextColor": "string (hex)",
            "title": "string (witty welcome message like 'You made it!' or 'You're on the list!')",
            "text": "string (warm subtext)"
          }
          Context: Event Theme: ${inv.theme}
          IMPORTANT: Generate all text in language: ${locale}`
        }
      ];
      
      // We can append this to the experience object or store it separately. 
      // For simplicity, let's append it to the experience object as "dashboard".
      try {
          const { output: dashOutput } = await generateText({
            model: openrouter("openrouter/auto"),
            output: Output.json(),
            messages: dashboardPrompt as any
          });
          json.dashboard = dashOutput;
      } catch (e) { console.error("Dashboard Gen Error", e); }

    } catch (e) { console.error("AI Generation Error:", e); }
  }

  // Fallback if AI fails or no key
  if (!json) {
    json = {
      projectSettings: { aspectRatio: "9:16", defaultDuration: 5 },
      assets: masterAssetMap,
      screens: [
        {
          id: "screen_1",
          title: "Welcome!",
          text: `Hi ${row.name || row.identifier}!`,
          actors: imgs.length > 0 ? [{
            assetId: "img_0",
            uniqueId: "hero_img",
            layout: { width: "60%", top: "20%", left: "20%", opacity: 0 },
            actions: { entrance: { type: "move_to", target: { opacity: 1, top: "25%" }, duration: 1 } }
          }] : []
        },
        // ... simplified fallback
        {
          id: "screen_end",
          title: "See you!",
          text: "Can't wait.",
          actors: []
        }
      ]
    };
  }

  await db.update(schema.invitees)
    .set({ experience: json })
    .where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier)));

  return NextResponse.json({ experience: json }, { status: 201 });
}
