import { generateObject } from "ai";
import { openrouter } from "@/lib/ai";
import { z } from "zod";
import type { AssetToName, NamedAsset, ScreenPurpose } from "./types";

const NamedAssetSchema = z.object({
  id: z.string().describe("Original asset ID that was provided"),
  semanticName: z.string().describe("Descriptive name like 'birthday_cake_image' or 'confetti_decoration'"),
  description: z.string().describe("Brief description of what this asset shows or represents"),
  suggestedUsage: z.array(z.enum(['intro', 'welcome', 'date', 'location', 'bring_item', 'raffle', 'rsvp', 'farewell']))
    .describe("Screen purposes where this asset would be most appropriate"),
  type: z.enum(['image', 'svg']),
});

const NameAssetsOutputSchema = z.object({
  assets: z.array(NamedAssetSchema)
    .describe("Named and described assets with usage suggestions"),
});

function buildSystemPrompt(): string {
  return `You are an Asset Curator analyzing visual resources for an invitation experience.

## Your Task
Given a list of image and SVG URLs, analyze each one and provide:
1. A semantic name (snake_case, descriptive)
2. A brief description of what it shows
3. Suggested screen purposes where it would fit best

## Guidelines

1. **Semantic Names**: Use descriptive snake_case names like:
   - 'birthday_cake_photo'
   - 'group_family_portrait'
   - 'confetti_decoration_svg'
   - 'pool_party_background'

2. **Descriptions**: Be specific about what you see:
   - "Photo of a birthday cake with 10 candles in pink frosting"
   - "Animated confetti particles in gold and silver"

3. **Usage Suggestions**: Match assets to appropriate screens:
   - Personal photos → 'welcome', 'intro', 'farewell'
   - Location images → 'location'
   - Decorative elements → any screen that needs embellishment
   - Themed images → screens matching that theme

4. **Be Inclusive**: Every asset should get a name and at least one suggested usage.`;
}

function buildUserPrompt(assets: AssetToName[]): string {
  const assetsList = assets.map(a =>
    `- ID: "${a.id}" | Type: ${a.type} | URL: ${a.url}`
  ).join('\n');

  return `Analyze and name these assets:

${assetsList}

Provide semantic names, descriptions, and usage suggestions for each asset.`;
}

export async function generateNamesForAssets(assets: AssetToName[]): Promise<NamedAsset[]> {
  if (assets.length === 0) {
    return [];
  }

  // For vision analysis, we need to include the actual images
  const imageUrls = assets.filter(a => a.type === 'image').slice(0, 10); // Limit to 10 for API limits

  const { object } = await generateObject({
    model: openrouter("google/gemini-3-flash-preview"),
    schema: NameAssetsOutputSchema,
    system: buildSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildUserPrompt(assets) },
          // Include images for vision analysis
          ...imageUrls.map(asset => ({
            type: "image" as const,
            image: new URL(asset.url),
          })),
        ],
      },
    ],
  });

  // Merge AI output with original URLs
  return object.assets.map(named => {
    const original = assets.find(a => a.id === named.id);
    return {
      ...named,
      url: original?.url || '',
    };
  });
}
