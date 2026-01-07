import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { assignItemIfNotAssigned } from "../assign-item/route";
import {
  generateCopy,
  generateSVGsFromCopy,
  generateNamesForAssets,
  pickAssetsForScreens,
  generateExperience,
  Slot,
  AssetToName,
  NamedAsset,
  Manifest,
  IsolatedAssetToName,
} from "./pipeline";
import { isolateImageSubject } from "./pipeline/isolate-image-subject";

const translationsWarning = `slots always appear at the exact center of the screen, they are 300px x 300px, try not to put any text or other elements on top of them, remember that you control literal slot elements where we place widgets, not the widgets themselves, widgets do not inherit translations so if you transform the slot, the widget will not be transformed AND it will look off.`;

// Slots definition
const SLOTS: Slot[] = [
  { name: "MapComponent", description: "A map showing the event location. " + translationsWarning },
  { name: "CountdownComponent", description: "A countdown timer to the event date. " + translationsWarning },
  { name: "DateComponent", description: "A beautiful date display with calendar download button. It can be used in any screen where you want to display the date of the event. " + translationsWarning },
  { name: "SlotMachineComponent", description: "A slot machine game to reveal the assigned item. It can be used when the invitee has an assignedItem set to bring to the event, in that case, this component will show it! " + translationsWarning },
];

function enrichImageSource(url: string) {
  if (url.includes('/raw/')) {
    return url.replace(/\/raw\//, '/image/') + '?f=png';
  }
  return url;
}

function removeImgaeEnrichment(urlRef: string) {
  const urlObj = new URL(urlRef);
  urlObj.search = '';
  const url = urlObj.toString();

  if (url.includes('/image/')) {
    return url.replace(/\/image\//, '/raw/')
  }
  return url;
}

async function batchPromise<T>(promises: (() => Promise<T>)[], batchSize: number): Promise<T[]> {

  const chunks = [];

  for (let i = 0; i < promises.length; i += batchSize) {
    chunks.push(promises.slice(i, i + batchSize));
  }

  const results = [];

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(p => p()));
    results.push(...chunkResults);
  }

  return results;
}
type IsolatedAssetCache = Array<{ originalUrl: string; isolatedUrl: string; backgroundColor: string }>;

/**
 * Gets isolated images, using cache when available to avoid expensive AI calls.
 * Returns the isolated images and any newly processed ones that need to be cached.
 */
async function getIsolatedImages(
  imgs: Array<{ name: string; source: string; mimeType: string }>,
  existingCache: IsolatedAssetCache | null | undefined
): Promise<{ isolatedImages: IsolatedAssetToName[]; newlyCached: IsolatedAssetCache }> {
  const cache = existingCache || [];
  const cacheMap = new Map(cache.map(c => [c.originalUrl, c]));

  const uploadedImagesNotIsolated: AssetToName[] = imgs.map((img: any, i: number) => ({
    id: `img_${i}`,
    url: enrichImageSource(img.source),
    type: 'image' as const,
  }));

  const isolatedImages: IsolatedAssetToName[] = [];
  const toProcess: { index: number; asset: AssetToName }[] = [];

  // Check cache for each image
  for (let i = 0; i < uploadedImagesNotIsolated.length; i++) {
    const asset = uploadedImagesNotIsolated[i];
    const originalUrl = removeImgaeEnrichment(asset.url);
    const cached = cacheMap.get(originalUrl);

    if (cached) {
      console.log(`[Pipeline] Using cached isolated image for: ${originalUrl}`);
      isolatedImages[i] = {
        ...asset,
        url: cached.isolatedUrl,
        backgroundColor: cached.backgroundColor,
      };
    } else {
      toProcess.push({ index: i, asset });
    }
  }

  // Process only uncached images
  if (toProcess.length > 0) {
    console.log(`[Pipeline] Processing ${toProcess.length} images (${uploadedImagesNotIsolated.length - toProcess.length} cached)`);

    const processedResults = await batchPromise(
      toProcess.map(({ asset }) => async () => {
        const ii = await isolateImageSubject(asset);
        return {
          asset,
          result: ii,
        };
      }),
      3
    );

    // Place results in correct positions and build new cache entries
    for (let i = 0; i < processedResults.length; i++) {
      const { asset, result } = processedResults[i];
      const { index } = toProcess[i];

      isolatedImages[index] = {
        ...asset,
        url: result.isolatedUrl,
        backgroundColor: result.backgroundColor,
      };

      // Add to cache
      const originalUrl = removeImgaeEnrichment(asset.url);
      cache.push({
        originalUrl,
        isolatedUrl: result.isolatedUrl,
        backgroundColor: result.backgroundColor,
      });
    }
  } else {
    console.log(`[Pipeline] All ${uploadedImagesNotIsolated.length} images found in cache!`);
  }

  return { isolatedImages, newlyCached: cache };
}

/**
 * Orchestrates the modular AI pipeline to generate the experience:
 * 
 * 1. generateCopy - Creates narrative structure and text content
 * 2. generateSVGsFromCopy + generateNamesForAssets(images) - Run in parallel
 * 3. generateNamesForAssets(all) - Merge SVGs with image names
 * 4. pickAssetsForScreens - AI curates best assets per screen
 * 5. generateExperience - Assembles final Manifest JSON
 */
async function runPipeline(inv: any, invitee: any, locale: string, width: number, height: number): Promise<{ manifest: Manifest; isolatedAssetsCache: IsolatedAssetCache }> {
  const imgs = inv.assets?.images || [];

  // Get isolated images with caching
  console.log('[Pipeline] Step 0: Isolating images (with cache)...');
  const { isolatedImages: uploadedImages, newlyCached: isolatedAssetsCache } = await getIsolatedImages(
    imgs,
    inv.isolatedAssets
  );

  // Step 1: Generate Copy
  console.log('[Pipeline] Step 1: Generating copy...');
  const copy = await generateCopy({
    invitation: inv,
    invitee,
    availableSlots: SLOTS,
    locale,
  });
  console.log('[Pipeline] Copy generated:', copy.screens.length, 'screens');

  // Step 2 & 3a: Run in parallel
  // - Generate SVGs from copy
  // - Name uploaded images
  console.log('[Pipeline] Steps 2 & 3a: Generating SVGs and naming images (parallel)...');
  const [generatedSVGs, imageNames] = await Promise.all([
    generateSVGsFromCopy(copy).catch(err => {
      console.error('[Pipeline] SVG generation failed:', err);
      return []; // Continue without SVGs if generation fails
    }),
    uploadedImages.length > 0
      ? generateNamesForAssets(uploadedImages)
      : Promise.resolve([]),
  ]);
  console.log('[Pipeline] Generated', generatedSVGs.length, 'SVGs');
  console.log('[Pipeline] Named', imageNames.length, 'images');

  // Step 3b: SVGs already have semantic names from generation, just convert to NamedAsset format
  const svgNames: NamedAsset[] = generatedSVGs.map((svg, i) => ({
    id: `svg_${svg.screenId}_${i}`,
    url: svg.url,
    semanticName: svg.semanticName,
    description: svg.description,
    suggestedUsage: [copy.screens.find(s => s.id === svg.screenId)?.purpose || 'intro'],
    type: 'svg' as const,
  }));
  console.log('[Pipeline] SVGs already named from generation:', svgNames.length);

  // Merge all named assets
  const allNamedAssets: NamedAsset[] = [...imageNames, ...svgNames];
  console.log('[Pipeline] Total named assets:', allNamedAssets.length);

  // Step 4: Pick assets for each screen
  console.log('[Pipeline] Step 4: Picking assets for screens...');
  const assetAssignments = await pickAssetsForScreens(copy, allNamedAssets);
  console.log('[Pipeline] Asset assignments created for', assetAssignments.length, 'screens');

  // Build asset URL map
  const assetUrlMap: Record<string, string> = {};
  allNamedAssets.forEach(asset => {
    assetUrlMap[asset.id] = removeImgaeEnrichment(asset.url);
  });

  // Step 5: Generate final experience manifest
  console.log('[Pipeline] Step 5: Generating final manifest...');
  const manifest = await generateExperience(
    copy,
    assetAssignments,
    SLOTS,
    assetUrlMap,
    allNamedAssets,
    width,
    height
  );
  console.log('[Pipeline] Manifest generated with', manifest.assets.length, 'assets and', manifest.timeline.length, 'steps');

  return { manifest, isolatedAssetsCache };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; identifier: string }> }) {
  const { slug, identifier } = await ctx.params;
  const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [row] = await db.select().from(schema.invitees).where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier))).limit(1);

  // Return cached experience if exists
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

  // Assign item if not already assigned
  const { assignedItem } = await assignItemIfNotAssigned(row, inv);
  row.assignedItem = assignedItem;

  let json: Manifest | null = null;
  let isolatedAssetsCache: IsolatedAssetCache | null = null;

  if (process.env.OPENROUTER_API_KEY) {
    const locale = req.nextUrl.searchParams.get("lang") || req.cookies.get("NEXT_LOCALE")?.value || "en";
    const width = req.nextUrl.searchParams.get("vw") || '1080';
    const height = req.nextUrl.searchParams.get("vh") || '1920';
    const result = await runPipeline(inv, row, locale, Number(width), Number(height));
    json = result.manifest;
    isolatedAssetsCache = result.isolatedAssetsCache;
  }

  // Persist the generated experience to invitee
  await db.update(schema.invitees)
    .set({ experience: json })
    .where(and(eq(schema.invitees.invitationId, inv.id), eq(schema.invitees.identifier, identifier)));

  // Persist the isolated assets cache to invitation (avoids reprocessing for other invitees)
  if (isolatedAssetsCache && isolatedAssetsCache.length > 0) {
    await db.update(schema.invitations)
      .set({ isolatedAssets: isolatedAssetsCache })
      .where(eq(schema.invitations.id, inv.id));
  }

  return NextResponse.json({ experience: json }, { status: 201 });
}
