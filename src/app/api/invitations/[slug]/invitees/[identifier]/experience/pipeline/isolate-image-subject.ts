import { generateText, GeneratedFile, Output } from "ai";
import { openrouter } from "@/lib/ai";
import sharp from "sharp";
import { AssetToName } from "./types";
import z from "zod";

// ============================================================================
// Types
// ============================================================================

export interface IsolatedImageResult {
  originalUrl: string;
  isolatedUrl: string;
  backgroundColor: string; // The selected hex color
}

// ============================================================================
// Step 1: Brain (AI) - Analyze Image & Generate Isolated Version
// ============================================================================

async function generateIsolatedImage(asset: AssetToName): Promise<{ file: GeneratedFile }> {
  // Use a vision-capable model
  const model = openrouter("google/gemini-2.5-flash-image"); // or google/gemini-3-pro-image-preview

  const { files } = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text", text: `
            identify the main subject in this image, isolate it, even zoom in to the subject if needed for aspect ratio purposes

your task is to replace everything that is NOT the main subject with a flat color, essentially isolating the main subject, this is because you are NOT capable of generating an image with transparency

so Isolate the main subject

place a flat high contrasting color around it (like bright green, magenta, or cyan)

the entire border of the image must be filled with this flat color so I can detect it
            `
          },
          { type: "image", image: asset.url, mediaType: asset.type }
        ]
      }
    ]
  });

  if (!files?.[0]) {
    throw new Error("Failed to generate isolated image");
  }

  return { file: files[0] };
}

// ============================================================================
// Step 2: Hands (Processing) - Detect Color
// ============================================================================

async function processGeneratedImage(file: GeneratedFile): Promise<{ buffer: Buffer, hex: string }> {
  let initialBuffer: Buffer;

  // Handle different potential structures of GeneratedFile
  // @ts-ignore: Assuming content is Uint8Array or similar
  if (file.uint8Array) {
    // @ts-ignore
    initialBuffer = Buffer.from(file.uint8Array);
  } else if ('base64' in file) {
    // @ts-ignore
    initialBuffer = Buffer.from(file.base64, 'base64');
  } else {
    throw new Error("Unknown content format in GeneratedFile");
  }

  // Convert image to raw buffer with alpha channel
  const image = sharp(initialBuffer);
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = 4; // ensureAlpha guarantees 4 channels
  const { width, height } = info;
  if (info.channels !== 4) throw new Error("Image channels mismatch");

  // --- Detect chroma key by analyzing 2-pixel border ---
  const borderWidth = 2;
  const colorCounts: Map<string, number> = new Map();

  // Helper to get pixel index
  const getPixelIndex = (x: number, y: number) => (y * width + x) * channels;

  // Helper to get color key from pixel
  const getColorKey = (idx: number) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return `${r},${g},${b}`;
  };

  // Iterate over the border pixels (2-pixel wide frame)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Check if pixel is within 2-pixel border
      const isInBorder =
        x < borderWidth ||
        x >= width - borderWidth ||
        y < borderWidth ||
        y >= height - borderWidth;

      if (isInBorder) {
        const idx = getPixelIndex(x, y);
        const colorKey = getColorKey(idx);
        colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
      }
    }
  }

  // Find the most common color
  let maxCount = 0;
  let mostCommonColor = '0,0,0';
  for (const [color, count] of colorCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonColor = color;
    }
  }

  const [r0, g0, b0] = mostCommonColor.split(',').map(Number);
  const hex = '#' + [r0, g0, b0].map(c => c.toString(16).padStart(2, '0')).join('');

  console.log(`[Isolate] Detected border color: ${hex} (appeared ${maxCount} times)`);

  // Chroma Keying: Iterate pixels and set alpha to 0 if it matches reference color
  const tolerance = 30; // Good for JPEG artifacts

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dist = Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0);

    if (dist <= tolerance) {
      data[i + 3] = 0; // Set Alpha to 0
    }
  }

  // Reconstruct PNG from raw buffer
  const outputBuffer = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .png()
    .toBuffer();

  return { buffer: outputBuffer, hex };
}

// ============================================================================
// Step 3: Upload - Bytescale
// ============================================================================

async function uploadToBytescale(buffer: Buffer): Promise<string> {
  const accountId = process.env.BYTESCALE_ACCOUNT_ID;
  const apiKey = process.env.BYTESCALE_API_KEY;

  if (!accountId || !apiKey) {
    throw new Error("Bytescale not configured");
  }

  // Derive a filename
  const filename = `isolated-${Date.now()}.png`; // Assuming PNG from AI commonly
  const endpoint = `https://api.bytescale.com/v2/accounts/${accountId}/uploads/binary`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Upload-Filename": filename,
      // We don't strictly know content type without probing, but Bytescale handles binary.
      // Better to probe with sharp if we want to be exact, but generic is often okay or defaults.
      "Content-Type": "image/png",
    },
    body: buffer as any,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bytescale upload failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.fileUrl;
}

// ============================================================================
// Main Export
// ============================================================================

export async function isolateImageSubject(asset: AssetToName): Promise<IsolatedImageResult> {
  try {
    // 1. Brain
    console.log(`[Isolate] Generating isolated image: ${asset.url}`);
    const { file } = await generateIsolatedImage(asset);

    if (!file) {
      throw new Error("AI failed to return an isolated image file.");
    }

    // 2. Hands - detect border color and apply chroma key
    console.log(`[Isolate] Processing result...`);
    const { buffer, hex } = await processGeneratedImage(file);
    console.log(`[Isolate] Background Color: ${hex}`);

    // 3. Upload
    console.log(`[Isolate] Uploading result...`);
    const isolatedUrl = await uploadToBytescale(buffer);
    console.log(`[Isolate] Done: ${isolatedUrl}`);

    return {
      originalUrl: asset.url,
      isolatedUrl,
      backgroundColor: hex,
    };

  } catch (error) {
    console.error("[Isolate] Pipeline failed:", error);
    throw error;
  }
}
