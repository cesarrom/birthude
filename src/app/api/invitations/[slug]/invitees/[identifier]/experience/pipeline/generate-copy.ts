import { generateObject } from "ai";
import { openrouter } from "@/lib/ai";
import { z } from "zod";
import type { GenerateCopyInput, CopyResult, ScreenCopy, Slot } from "./types";

const ScreenCopySchema = z.object({
  id: z.string().describe("Unique identifier for this screen, e.g. 'intro', 'welcome_1'"),
  purpose: z.enum(['intro', 'welcome', 'date', 'location', 'bring_item', 'raffle', 'rsvp', 'farewell'])
    .describe("The functional purpose of this screen in the experience flow"),
  headline: z.string().describe("Main text for this screen - short, punchy, and engaging"),
  subtext: z.string().optional().describe("Optional secondary text providing additional context"),
  suggestedSlot: z.string().optional()
    .describe("If this screen should use an interactive component, specify its name here"),
  completionTrigger: z.enum(['auto', 'interaction', 'manual'])
    .describe("How the user advances past this screen: 'auto' (timed), 'interaction' (button), 'manual' (form completion)"),
  completionLabel: z.string().optional()
    .describe("Button label if completionTrigger is 'interaction'"),
  suggestedMood: z.string().optional()
    .describe("Visual mood for this screen, e.g. 'celebratory', 'intimate', 'playful'"),
  suggestedPageStyle: z.string().optional()
    .describe("CSS style string for the screen container, e.g. background gradients"),
});

const CopyResultSchema = z.object({
  screens: z.array(ScreenCopySchema)
    .min(4).max(7)
    .describe("Array of 4-7 screens that make up the experience flow"),
  overallTheme: z.string().describe("Single phrase describing the visual theme, e.g. 'tropical party'"),
  colorPalette: z.array(z.string()).min(3).max(5)
    .describe("3-5 hex colors that define the palette for this experience"),
});

function buildSystemPrompt(slots: Slot[]): string {
  return `You are a Creative Director crafting the narrative structure for animated invitation experiences.

Your task is to define the COPY and FLOW for an interactive experience. You are NOT generating animations or layouts - just the text content and screen structure.

## Available Interactive Components (Slots)
${slots.map((s, i) => `${i + 1}. **${s.name}**: ${s.description}`).join('\n')}

## Guidelines

1. **Screen Count**: Create exactly 4-7 screens. Each screen has ONE main purpose.

2. **Flow Structure**:
   - Start with an intro/welcome that grabs attention
   - Include date and location information
   - If the invitee has an assigned item, dedicate a screen to it
   - If there's a raffle prize, mention it
   - End with RSVP (trigger: manual) and a farewell

3. **Copy Style**:
   - Headlines should be SHORT and impactful (1-5 words ideal)
   - Subtext adds context but keep it brief
   - Match the tone to the event (playful for birthdays, elegant for formal events)
   - Personalize using the invitee's name

4. **Completion Triggers**:
   - 'auto': Screen advances after a delay (good for intro)
   - 'interaction': User taps a button to continue (most screens)
   - 'manual': Used ONLY for RSVP/form screens - waits for form submission

5. **Page Styles**: Suggest CSS for backgrounds (gradients, colors) matching the mood.`;
}

function buildUserPrompt(input: GenerateCopyInput): string {
  const { invitation, invitee, locale } = input;

  return `Generate the copy and screen structure for this invitation experience.

## Event Details
- **Title**: ${invitation.title}
- **Theme**: ${invitation.theme}
- **Description**: ${invitation.description || 'N/A'}
- **Date/Time**: ${invitation.eventAt}
- **Location**: ${invitation.location}
- **Raffle Prize**: ${invitation.rafflePrize || 'None'}
- **Items to Bring**: ${invitation.items?.join(', ') || 'None specified'}

## Recipient
- **Name**: ${invitee.name || 'Guest'}
- **Age**: ${invitee.age || 'N/A'}
- **Relationship/Context**: ${invitee.context || 'N/A'}
- **Assigned Item**: ${invitee.assignedItem || 'None'}

## Language
Generate ALL copy in: **${locale}**

Create a compelling, personalized experience flow.`;
}

export async function generateCopy(input: GenerateCopyInput): Promise<CopyResult> {
  const { object } = await generateObject({
    model: openrouter("google/gemini-3-flash-preview"),
    schema: CopyResultSchema,
    system: buildSystemPrompt(input.availableSlots),
    prompt: buildUserPrompt(input),
  });

  return object;
}
