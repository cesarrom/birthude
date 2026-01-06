import { generateObject } from "ai";
import { openrouter } from "@/lib/ai";
import { z } from "zod";
import type { CopyResult, NamedAsset, ScreenAssetAssignment, AssetPlacement } from "./types";

const AssetPlacementSchema = z.object({
  assetId: z.string().describe("ID of the selected asset"),
  role: z.enum(['background', 'hero', 'decoration', 'accent'])
    .describe("Visual role: background (behind everything), hero (main focus), decoration (supporting), accent (small detail)"),
  css: z.record(z.string(), z.string())
    .describe("CSS positioning hints like { top: '20%', left: '50%', width: '200px' }"),
});

const ScreenAssetAssignmentSchema = z.object({
  screenId: z.string().describe("ID of the screen"),
  assets: z.array(AssetPlacementSchema)
    .max(4)
    .describe("Selected assets for this screen (max 4 to avoid clutter)"),
});

const PickAssetsOutputSchema = z.object({
  assignments: z.array(ScreenAssetAssignmentSchema)
    .describe("Asset assignments for each screen"),
});

function buildSystemPrompt(): string {
  return `You are a Visual Art Director curating assets for invitation experience screens.

## Your Task
Given the screen copy and a pool of named assets, SELECT the most appropriate assets for each screen. 
You are NOT using all assets - you are PICKING the best ones for each screen's context.

## Selection Guidelines

1. **Less is More**: Each screen should have 1-3 assets max. Avoid clutter.
   - 1 hero/main asset
   - 0-2 decoration/accent assets

2. **Match Context**: 
   - Personal photos → welcome screens, farewell
   - Location images → location screen
   - Decorative SVGs → accent any screen
   - Themed elements → screens matching that mood

3. **Prioritization**:
   - For personal/intimate screens: prefer uploaded photos over generated SVGs
   - For decorative screens: SVGs work well as accents
   - If an asset's suggestedUsage matches the screen purpose, prioritize it

4. **Not Every Screen Needs Assets**:
   - Screens with interactive slots (MapComponent, RSVPForm) might not need images
   - Some screens work better with just text

5. **CSS Positioning**:
   - Hero assets: centered, prominent (top: '30%', left: '50%', transform: 'translateX(-50%)')
   - Background: cover the screen (top: '0', left: '0', width: '100%', height: '100%', objectFit: 'cover')
   - Decoration: corners or edges
   - Accent: small, positioned around main content

## Example Selection
For a birthday party with 8 images and 5 SVGs, you might select:
- Intro screen: 1 festive SVG decoration
- Welcome screen: 1 personal photo (hero) + 1 confetti SVG (accent)
- Date screen: 1 calendar-themed asset
- Location screen: no images (the MapComponent slot handles it)
- RSVP screen: no images (keep focus on form)
- Farewell: 1 group photo (hero)`;
}

function buildUserPrompt(copy: CopyResult, assets: NamedAsset[]): string {
  const screensDescription = copy.screens.map(s =>
    `- **${s.id}** (${s.purpose}): "${s.headline}" ${s.suggestedSlot ? `[Has slot: ${s.suggestedSlot}]` : ''} [Mood: ${s.suggestedMood || 'neutral'}]`
  ).join('\n');

  const assetsDescription = assets.map(a =>
    `- ID: "${a.id}" | Type: ${a.type} | Name: ${a.semanticName} | "${a.description}" | Usage: ${a.suggestedUsage.join(', ')}`
  ).join('\n');

  return `Select the best assets for each screen.

## Screens (${copy.screens.length} total)
${screensDescription}

## Available Assets (${assets.length} total)
${assetsDescription}

## Theme
${copy.overallTheme}

Pick 1-3 assets per screen (or none if not needed). Prioritize personal photos for meaningful screens.`;
}

export async function pickAssetsForScreens(
  copy: CopyResult,
  namedAssets: NamedAsset[]
): Promise<ScreenAssetAssignment[]> {
  if (namedAssets.length === 0) {
    // No assets to pick from, return empty assignments
    return copy.screens.map(s => ({ screenId: s.id, assets: [] }));
  }

  const { object } = await generateObject({
    model: openrouter("google/gemini-3-flash-preview"),
    schema: PickAssetsOutputSchema,
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(copy, namedAssets),
  });

  return object.assignments;
}
