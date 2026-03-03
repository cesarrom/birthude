import { generateObject } from "ai";
import { openrouter } from "@/lib/ai";
import { z } from "zod";
import type { CopyResult, UploadedSVG } from "./types";

const GeneratedSVGSchema = z.object({
  screenId: z.string().describe("ID of the screen this SVG is for"),
  svgContent: z.string().describe("Complete SVG markup as a string, can include CSS animations in <style> tags"),
  role: z.enum(['hero', 'decoration', 'accent']).describe("Visual importance of this SVG on the screen"),
  description: z.string().describe("Brief description of what this SVG depicts"),
  semanticName: z.string().describe("Descriptive snake_case filename like 'birthday_balloons' or 'confetti_accent'"),
  isAnimated: z.boolean().describe("Whether this SVG includes CSS animations"),
});

const SVGsOutputSchema = z.object({
  svgs: z.array(GeneratedSVGSchema)
    .describe("1-3 SVGs per screen, tailored to the theme and content"),
});

function buildSystemPrompt(): string {
  return `You are an SVG Artist specializing in simple, elegant vector illustrations for animated experiences.

## Your Task
Generate SVG illustrations that complement the screens of an invitation experience. These SVGs should be:
- Simple and clean (not overly complex)
- Thematically consistent with the event
- Optionally animated using CSS animations (keyframes inside <style> tags)

## SVG Guidelines

1. **Size**: Design for viewBox="0 0 100 100" or similar. Keep them scalable.

2. **Simplicity**: Use basic shapes (circles, paths, polygons). Avoid complex details.

3. **Colors**: Use the provided color palette. Can use fill, stroke, gradients.

4. **Animation** (optional, not required for all):
   - Use CSS @keyframes inside a <style> tag within the SVG
   - Keep animations subtle: gentle floats, pulses, or rotations
   - Example: floating balloons, twinkling stars, gentle wave motion

5. **Quantity**: Generate 1-3 SVGs per screen based on need:
   - Hero: Main illustrative element
   - Decoration: Background or accent elements
   - Accent: Small detail elements (confetti, stars, etc.)

6. **Context Matching**:
   - Birthday → Balloons, cake, confetti, party hats
   - Wedding → Rings, flowers, hearts
   - Pool party → Waves, sun, beach balls
   - Generic celebration → Stars, ribbons, sparkles

## Example Animated SVG
\`\`\`svg
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    .balloon { animation: float 2s ease-in-out infinite; }
  </style>
  <ellipse class="balloon" cx="50" cy="40" rx="20" ry="25" fill="#f43f5e"/>
  <path d="M50 65 Q55 75 50 90" stroke="#888" fill="none" stroke-width="1"/>
</svg>
\`\`\``;
}

function buildUserPrompt(copy: CopyResult): string {
  const screensDescription = copy.screens.map(s =>
    `- **${s.id}** (${s.purpose}): "${s.headline}" ${s.subtext ? `/ "${s.subtext}"` : ''} [Mood: ${s.suggestedMood || 'neutral'}]`
  ).join('\n');

  return `Generate SVG illustrations for this invitation experience.

## Overall Theme
${copy.overallTheme}

## Color Palette
${copy.colorPalette.join(', ')}

## Screens
${screensDescription}

Create appropriate SVGs for each screen. Not every screen needs an SVG - focus on screens that would benefit from visual illustration. Prioritize screens with moods like 'celebratory', 'playful', or decorative purposes.`;
}

async function uploadSVGToBytescale(svgContent: string, semanticName: string): Promise<string> {
  const baseUrl = process.env.CONTENTO_BASE_URL;
  const projectId = process.env.CONTENTO_PROJECT_ID;
  const projectSlug = process.env.CONTENTO_PROJECT_SLUG;
  const apiKey = process.env.CONTENTO_API_KEY;

  if (!baseUrl || !projectId || !projectSlug || !apiKey) {
    throw new Error("Contento not configured");
  }

  const safeSemantic = String(semanticName || "asset")
    .trim()
    .replace(/\\/g, "-")
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  const filename = `${safeSemantic || "asset"}-${Date.now()}.svg`;
  const path = `/svgs/${filename}`;
  const buf = Buffer.from(svgContent, "utf8");

  const signRes = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/v1/projects/${projectId}/sign/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path,
      contentType: "image/svg+xml",
    }),
  });

  if (!signRes.ok) {
    const text = await signRes.text();
    throw new Error(`Contento sign upload failed: ${signRes.status} ${text}`);
  }

  const signJson = await signRes.json();
  const uploadUrl = signJson?.data?.url;
  const uploadMethod = String(signJson?.data?.method || "PUT").toUpperCase();
  if (!uploadUrl || uploadMethod !== "PUT") {
    throw new Error("Contento sign upload returned invalid response");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/svg+xml",
    },
    body: buf,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Contento upload failed: ${uploadRes.status} ${text}`);
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const filePath = path.replace(/^\//, "");
  return `${normalizedBase}/f/raw/${projectSlug}/${filePath}`;
}

export async function generateSVGsFromCopy(copy: CopyResult): Promise<UploadedSVG[]> {
  // Generate SVGs using AI
  const { object } = await generateObject({
    model: openrouter("google/gemini-3-flash-preview"),
    schema: SVGsOutputSchema,
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(copy),
  });

  // Upload all SVGs to Bytescale in parallel
  const uploadPromises = object.svgs.map(async (svg): Promise<UploadedSVG> => {
    const url = await uploadSVGToBytescale(svg.svgContent, svg.semanticName);
    return {
      screenId: svg.screenId,
      url,
      role: svg.role,
      description: svg.description,
      semanticName: svg.semanticName,
      isAnimated: svg.isAnimated,
    };
  });

  return Promise.all(uploadPromises);
}
