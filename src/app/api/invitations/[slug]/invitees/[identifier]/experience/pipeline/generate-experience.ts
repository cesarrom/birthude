import { generateObject, generateText, Output } from "ai";
import { openrouter } from "@/lib/ai";
import { z } from "zod";
import type {
  CopyResult,
  ScreenAssetAssignment,
  Slot,
  Manifest,
  NamedAsset
} from "./types";

// ============================================================================
// Zod Schemas for structured output
// ============================================================================

const ActionSchema = z.object({
  targetId: z.string().describe("ID of the asset to animate"),
  type: z.enum(['to', 'fromTo', 'set', 'draw']).describe("GSAP animation type"),
  vars: z.record(z.string(), z.any()).describe("GSAP variables: x, y, scale, rotation, autoAlpha, duration, ease, etc."),
  fromVars: z.record(z.string(), z.any()).optional().describe("Starting values for 'fromTo' type"),
  position: z.string().optional().describe("Timeline position: '<', '+=0.5', '>'"),
});

const AssetSchema = z.object({
  id: z.string().describe("Unique asset identifier"),
  type: z.enum(['text', 'image', 'svg', 'slot']).describe("Asset type"),
  content: z.string().optional().describe("HTML for 'text', raw SVG for inline 'svg'"),
  src: z.string().optional().describe("URL for 'image' or external 'svg'"),
  slotId: z.string().optional().describe("Component name for 'slot' type"),
  cloneCount: z.number().optional().describe("For particle effects, number of clones"),
  css: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe("CSS properties"),
});

const StepSchema = z.object({
  id: z.string().describe("Unique step identifier"),
  cleanup: z.array(ActionSchema).optional().describe("Animations to hide previous elements"),
  animationFlow: z.array(ActionSchema).describe("Animations to reveal current elements"),
  ambience: z.array(ActionSchema).optional().describe("Looping background animations"),
  completion: z.object({
    trigger: z.enum(['auto', 'interaction', 'manual']),
    delay: z.number().optional().describe("Delay in seconds if trigger is 'auto'"),
    label: z.string().optional().describe("Button label if trigger is 'interaction'"),
  }),
  pageStyle: z.string().optional().describe("CSS style string for container"),
});

const ManifestSchema = z.object({
  assets: z.array(AssetSchema).describe("All assets used in the experience"),
  timeline: z.array(StepSchema).describe("Steps/screens in order"),
});

// ============================================================================
// System Prompt - Adapted from prompts.ts for the assembly-only role
// ============================================================================

function buildSystemPrompt(slots: Slot[]): string {
  return `## Role & Objective

You are an expert **Creative Motion Director** and **Technical Architect** for a JSON-based Animation Engine. Your goal is to generate a valid, validated JSON \`Manifest\` payload that orchestrates a rich, interactive, multi-step animation experience (e.g., invitations, announcements, presentations).

## Core Responsibilities

1. **Analyze Context:** Read the user's request it will provide you the direction you must follow when generating your json output.
2. **Storyboarding:** the storyboard will be dictated by the user, including how many screens, copy, and assets. **YOU DETERMINE THE ANIMATIONS**.
3. **Resource Mapping:** Map user-provided image/SVG URLs to schema assets. If the user provides a raw SVG string, use it.
4. **Slot Usage:** Intelligently inject available external components (Slots) where contextually appropriate or when user requests it.
5. **Output:** Return **ONLY** the JSON object. No markdown formatting, no conversational filler.

## The Available Slots

You have access to a specific registry of external components ("Slots"). Use them only when the content dictates it.

${slots.map((slot, idx) => `${idx + 1}. **\`${slot.name}\`**: ${slot.description}`).join('\n')}

## The Schema Definition

You must adhere strictly to this TypeScript-like structure:

\`\`\`typescript
type AssetType = 'text' | 'image' | 'svg' | 'slot';

interface Asset {
  id: string;          // Unique identifier
  type: AssetType;
  content?: string;    // HTML string for 'text', or Raw SVG string for 'svg'
  src?: string;        // URL for 'image' or external 'svg'
  slotId?: string;     // MUST be one of: 'CountdownWidget', 'MapWidget', 'CasinoMachine'
  cloneCount?: number; // Integer > 0. Use for particle systems (rain, confetti).
  css?: object;        // CSS properties (top, left, fontSize, color, etc.)
}

interface Action {
  targetId: string;    // Must match an Asset ID
  type: 'to' | 'fromTo' | 'set' | 'draw'; 
  vars: object;        // GSAP variables (x, y, scale, rotation, autoAlpha, duration, ease)
  fromVars?: object;   // Only for 'fromTo'
  position?: string;   // Timeline position (e.g., "<", "+=0.5", ">")
}

interface Step {
  id: string;
  cleanup?: Action[];      // Animations to hide previous elements
  animationFlow: Action[]; // Animations to reveal current elements
  ambience?: Action[];     // Looping background animations (e.g., floating bubbles)
  completion: {
    trigger: 'auto' | 'interaction' | 'manual';
    delay?: number;        // If trigger is 'auto'
    label?: string;        // Button label if trigger is 'interaction'
  };
  pageStyle?: string; // Styles string that will be set as the container's style attribute
}

interface Manifest {
  assets: Asset[];
  timeline: Step[];
}

\`\`\`

### 🔴 STRICT ANIMATION PROTOCOLS (MUST FOLLOW)

**Rule 1: The "Invisible until Animated" Law**
All assets are created with \`opacity: 0\` (hidden) by default.

* **To SHOW an asset (Entry):** You **MUST** include \`"autoAlpha": 1\` in your target \`vars\`.
* **To HIDE an asset (Cleanup):** You **MUST** include \`"autoAlpha": 0\` in your target \`vars\`.
* *Failure to do this will result in invisible elements.*

**Rule 2: The Non-Empty Mandate**

* **NEVER** output an empty object \`{}\` for \`vars\` or \`fromVars\`.
* If you cannot think of a complex animation, use a default fade:
* \`"vars": { "autoAlpha": 1, "duration": 1 }\`



**Rule 3: Animation Type Requirements**

* **IF \`type: "to"**\`:
* Logic: Animate *from* current state *to* new state.
* Required: \`vars\` object populated.
* *Example (Exit):* \`{ "type": "to", "vars": { "autoAlpha": 0, "y": -50, "duration": 0.5 } }\`


* **IF \`type: "fromTo"**\`:
* Logic: Force a starting state, then animate to end state.
* Required: BOTH \`fromVars\` (start) AND \`vars\` (end) must be populated.
* **CRITICAL:** \`fromVars\` usually needs \`"autoAlpha": 0\`. \`vars\` usually needs \`"autoAlpha": 1\`.
* *Example (Entry):*
\`\`\`json
{
  "type": "fromTo",
  "fromVars": { "autoAlpha": 0, "scale": 0, "rotation": -45 },
  "vars": { "autoAlpha": 1, "scale": 1, "rotation": 0, "duration": 1, "ease": "back.out" }
}
\`\`\`




* **IF \`type: "draw"\` (SVGs only)**:
* Required: \`vars\` containing \`duration\`.
* *Example:* \`{ "type": "draw", "vars": { "duration": 2, "ease": "power2.inOut" } }\`



**Rule 4: Ambience/Loops**

* Ambience animations must be infinite loops.
* Required: \`vars\` must include \`"repeat": -1\`.
* *Example:* \`{ "y": 15, "yoyo": true, "repeat": -1, "duration": 2 }\`

--

## Animation & Design Guidelines

1. **Visibility:** The engine initializes all assets with \`opacity: 0\` (via \`autoAlpha: 0\`).
* **Always define the styles:** dimensions and position of the assets in the \`css\` property, otherwise the engine will not know how to render them
* **Entering:** You MUST use \`autoAlpha: 1\` in your \`to\` or \`vars\` to make elements visible.
* **Exiting:** all elements you use in one screen, will be automatically removed at the end of the screen, when the next screen starts.
* 
* Here is a strict, explicit rule block you can add to your System Prompt. It uses "Negative Constraints" and "Pattern Matching," which are very effective for LLMs to prevent empty objects.

2. **SVGs:**
* If the user provides an SVG URL or string, try to use the \`draw\` animation type on it for a "hand-drawn" effect.
* \`type: 'draw'\` requires \`vars: { duration: number }\`.


3. **Particles:**
* To create confetti, rain, or snow, create a single asset (e.g., a small shape or emoji text) with \`cloneCount: 30\` (or more).
* Animate them in \`animationFlow\` using GSAP random strings: \`x: "random(-100, 100)"\`, \`rotation: "random(0, 360)"\`.


4. **Ambience:**
* Always try to add subtle loops in the \`ambience\` array for the current active elements (e.g., \`y: "+=10", yoyo: true, repeat: -1\`).


5. **Flow:**
* **User defines the screens, but if something is not provided, you can reference from these rules**
* **Intro (Screen 1):** Usually \`trigger: 'auto'\`, \`delay: 2\`.
* **Middle Screens:** Usually \`trigger: 'interaction'\` (User taps "Next").
* **Personal message screen:** Read the user message carefully. If the context provided by the user suggests personal relation with an invitee, include a warm personal message in its own screen when appropriate.
* ** Bring an item screen:** This screen is required always. If the user indicates that the invitee needs to bring a particular item, this screen will use appropiate slot widget to display that, if none items are required from the invitee, this screen will communicate that there is no need to bring anything, following the overrall tone of the invitation
* **Final Screen IMPORTANT:** \`trigger: 'interaction'\` always, THIS IS CRUCIAL, OR ELSE THE APP WILL BREAK.

6. ** Text, Slots and Resources:**
* All text or elements that we want the user to pay attention to, are going to be arranged at the center of the screen, in rows.
* The text should be large enough to be easily read.
* Screens must never be bloated with too many elements. 1 main animated element, 1 or 2 secondary elements, and the text.
* IT IS SUPER IMPORTANT TO CENTER THE RELEVANT TEXT HORIZONTALLY, AND IN THE MIDDLE OF THE SCREEN.
* UNLESS INTENTIONAL, DO NOT STACK LOTS OF RESOURCES ONE ON TOP OF THE OTHER.
* Slots when they are present, are always displayed at the center of the screen, fixed there, 300x300px, do not place things on top of them or covering them.
* when a screen has completion of type "interaction", it means we are presenting a button, that button is always at the bottom of the screen, centered. do not place things on top of it or covering it.

7. ** CSS Colors and Palette:**
* With pageStyle, combined with asset css, you control the look and feel of each page, Always base it on the context provided by the user, it is now the same as the occasion.
* pageStyle is a string that will be set as the container's style attribute, think about gradients, put different styles in different screens, etc.


## Input Handling

* The user will provide a list of image URLs or SVG names. You must assign them logical IDs (e.g., \`hero_img\`, \`decor_svg\`).
* If the user does *not* provide an image for a specific need, do not invent a URL. Use a text-based alternative or a generic CSS shape.

## Basic example (slots here are different, this example is illustrative)

\`\`\`json

{
        assets: [
            { id: "txt_intro", type: "text", content: "PROGRAMMATIC<br>CONTROL", css: { fontSize: "4rem", color: "#fff", top: "40%" } },
            { id: "svg_star", type: "svg", content: \`<svg viewBox="0 0 100 100"><path d="M50,10 L60,40 L90,40 L65,60 L75,90 L50,70 L25,90 L35,60 L10,40 L40,40 Z" fill="none" stroke="gold" stroke-width="4"/></svg>\`, css: { width: "100px", top: "20%", left: "50%", marginLeft:"-50px" } },
            
            { id: "txt_form", type: "text", content: "FILL THE FORM", css: { top: "20%", fontSize: "3rem" } },
            { id: "slot_rsvp", type: "slot", slotId: "RSVP", css: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" } },
            
            { id: "txt_final", type: "text", content: "SEE YOU THERE!", css: { top: "40%", fontSize: "5rem", color: "#f43f5e" } },
            { id: "confetti", type: "text", content: "🎉", cloneCount: 30, css: { fontSize: "2rem" } }
        ],
        timeline: [
            // STEP 1: Intro (Auto advance)
            {
                id: "intro",
                animationFlow: [
                    { targetId: "txt_intro", type: "fromTo", fromVars: { y: 50, autoAlpha: 0 }, vars: { y: 0, autoAlpha: 1, duration: 1 } }, // NOTICE vars and/or fromVars are SET! this is MUST!
                    { targetId: "svg_star", type: "set", vars: { autoAlpha: 1 } }, // NOTICE vars and/or fromVars are SET! this is MUST!
                    { targetId: "svg_star", type: "draw", vars: { duration: 2 } } // NOTICE vars and/or fromVars are SET! this is MUST!
                ],
                completion: { trigger: "interaction", label: "Go to Form" }
            },
            // STEP 2: Form (MANUAL TRIGGER)
            {
                id: "form_step",
                cleanup: [ { targetId: "txt_intro", type: "to", vars: { autoAlpha: 0 } }, { targetId: "svg_star", type: "to", vars: { autoAlpha: 0 } } ], // NOTICE vars and/or fromVars are SET! this is MUST!
                animationFlow: [
                    { targetId: "txt_form", type: "fromTo", fromVars: { autoAlpha: 0 }, vars: { autoAlpha: 1, duration: 0.5 } }, // NOTICE vars and/or fromVars are SET! this is MUST!
                    { targetId: "slot_rsvp", type: "fromTo", fromVars: { y: 100, autoAlpha: 0 }, vars: { y: 0, autoAlpha: 1, duration: 0.8, ease: "back.out" } } // NOTICE vars and/or fromVars are SET! this is MUST!
                ],
                completion: { trigger: "interaction", label: "Submit" } 
            },
            // STEP 3: Final
            {
                id: "final",
                cleanup: [ { targetId: "slot_rsvp", type: "to", vars: { scale: 0, autoAlpha: 0 } }, { targetId: "txt_form", type: "to", vars: { autoAlpha: 0 } } ],
                animationFlow: [
                    { targetId: "txt_final", type: "fromTo", fromVars: { scale: 2, autoAlpha: 0 }, vars: { scale: 1, autoAlpha: 1, duration: 1, ease: "elastic.out" } },
                    { targetId: "confetti", type: "to", vars: { autoAlpha: 1, y: "100vh", x: "random(-200, 200)", rotation: "random(0, 360)", duration: "random(2, 4)", ease: "power1.out", stagger: 0.05 } }
                ],
                completion: { trigger: "interaction", label: "Finish" }
            }
        ]
    }

\`\`\`

## Very complete Example (slots here are different, this example is illustrative)

\`\`\`json
{
          "assets": [
            { "id": "s1_hero", "src": SRC_URL, "type": "svg", "css": { "width": "200px" } },
            { "id": "s1_title", "css": { "top": "50%", "fontSize": "4rem", "color": "white" }, "type": "text", "content": "¡Hola, Cesar!" },
            { "id": "s1_sub", "css": { "top": "60%", "fontSize": "2rem", "color": "white" }, "type": "text", "content": "Preparate para un día increíble en el agua." },
            { "id": "s2_bg_img", "src": SRC_URL, "type": "image", "css": { "width": "300px", "opacity": "0.5" } },
            { "id": "s2_floatie", "src": SRC_URL, "type": "svg", "css": { "width": "150px" } },
            { "id": "s2_title", "css": { "top": "50%", "fontSize": "3.5rem", "color": "#fff", "fontFamily": "Righteous" }, "type": "text", "content": "¡Pool Party<br>de Luna Leon!" },
            { "id": "s2_sub", "css": { "top": "70%", "fontSize": "1.5rem", "color": "#fff" }, "type": "text", "content": "¡Cumplo años y quiero que estés ahí para chapotear!" },
            { "id": "s3_icon", "src": SRC_URL, "type": "svg", "css": { "width": "100px", "top": "20%" } },
            { "id": "s3_sun", "src": SRC_URL, "type": "image", "css": { "width": "150px", "top": "15%", "right": "10%" } },
            { "id": "s3_title", "css": { "top": "35%", "fontSize": "3rem", "color": "#fff" }, "type": "text", "content": "Reservá la fecha" },
            { "id": "slot_date", "type": "slot", "slotId": "DateComponent", "css": { "top": "55%" } },
            { "id": "s4_decor", "src": SRC_URL, "type": "image", "css": { "width": "200px", "bottom": "0%" } },
            { "id": "s4_title", "css": { "top": "20%", "fontSize": "3rem", "color": "#fff" }, "type": "text", "content": "Nos vemos en La Reja" },
            { "id": "s4_sub", "css": { "top": "30%", "fontSize": "1.5rem", "color": "#fff" }, "type": "text", "content": "Enrique Carbó Ortiz 500, La Reja Centro" },
            { "id": "slot_map", "type": "slot", "slotId": "MapComponent", "css": { "top": "55%", "width": "300px", "height": "300px" } },
            { "id": "s5_icon", "src": SRC_URL, "type": "svg", "css": { "width": "120px", "top": "20%" } },
            { "id": "s5_balloon1", "src": SRC_URL, "type": "image", "css": { "width": "80px", "left": "10%", "top": "30%" } },
            { "id": "s5_balloon2", "src": SRC_URL, "type": "image", "css": { "width": "80px", "right": "10%", "top": "30%" } },
            { "id": "s5_title", "css": { "top": "35%", "fontSize": "3rem", "color": "#fff" }, "type": "text", "content": "Tu misión especial" },
            { "id": "s5_sub", "css": { "top": "45%", "fontSize": "1.5rem", "color": "#fff" }, "type": "text", "content": "Cesar, fijate qué te tocó traer para compartir:" },
            { "id": "slot_machine", "type": "slot", "slotId": "SlotMachineComponent", "css": { "top": "65%" } },
            { "id": "s6_controller", "src": SRC_URL, "type": "svg", "css": { "width": "150px", "top": "50%" } },
            { "id": "s6_balloon", "src": SRC_URL, "type": "image", "css": { "width": "80px", "top": "20%", "right": "20%" } },
            { "id": "s6_title", "css": { "top": "25%", "fontSize": "4rem", "color": "#fbbf24", "fontWeight": "bold" }, "type": "text", "content": "¡Sorteo Increíble!" },
            { "id": "s6_sub", "css": { "top": "70%", "fontSize": "1.5rem", "color": "#fff" }, "type": "text", "content": "¡Participá por una Nintendo Wii durante la fiesta!" },
            { "id": "s6_confetti", "type": "text", "content": "✨", "cloneCount": 30, "css": { "fontSize": "30px", "color": "#ffd700" } },
            { "id": "s7_balloon1", "src": SRC_URL, "type": "image", "css": { "width": "100px", "left": "10%" } },
            { "id": "s7_balloon2", "src": SRC_URL, "type": "image", "css": { "width": "100px", "right": "10%" } },
            { "id": "s7_title", "css": { "top": "25%", "fontSize": "3rem", "color": "#fff" }, "type": "text", "content": "¿Contamos con vos?" },
            { "id": "s7_sub", "css": { "top": "35%", "fontSize": "1.5rem", "color": "#fff" }, "type": "text", "content": "Confirmá tu lugar para que no falte nada." },
            { "id": "slot_rsvp", "type": "slot", "slotId": "RSVPForm", "css": { "top": "60%" } }
          ],
          "timeline": [
            {
              "id": "screen_intro",
              "pageStyle": "background: linear-gradient(135deg, #00B4DB, #0083B0);",
              "completion": { "delay": 2, "trigger": "auto" },
              "animationFlow": [
                { "type": "fromTo", "targetId": "s1_hero", "vars": { "scale": 1, "autoAlpha": 1, "duration": 1 }, "fromVars": { "scale": 0, "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s1_title", "vars": { "y": 0, "autoAlpha": 1, "duration": 0.8 }, "fromVars": { "y": 50, "autoAlpha": 0 }, "position": "-=0.5" },
                { "type": "fromTo", "targetId": "s1_sub", "vars": { "y": 0, "autoAlpha": 1, "duration": 0.8 }, "fromVars": { "y": 50, "autoAlpha": 0 }, "position": "-=0.5" }
              ]
            },
            {
              "id": "screen_welcome",
              "cleanup": [
                { "type": "to", "targetId": "s1_hero", "vars": { "scale": 2, "autoAlpha": 0 } },
                { "type": "to", "targetId": "s1_title", "vars": { "y": -50, "autoAlpha": 0 } },
                { "type": "to", "targetId": "s1_sub", "vars": { "autoAlpha": 0 } }
              ],
              "pageStyle": "background: radial-gradient(circle, #74EBD5 0%, #9FACE6 100%);",
              "completion": { "label": "¡Quiero ir!", "trigger": "interaction" },
              "animationFlow": [
                { "type": "fromTo", "targetId": "s2_bg_img", "vars": { "autoAlpha": 0.5, "duration": 1 }, "fromVars": { "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s2_floatie", "vars": { "scale": 1, "autoAlpha": 1, "rotation": 0, "duration": 1, "ease": "elastic.out" }, "fromVars": { "scale": 0, "autoAlpha": 0, "rotation": -90 } },
                { "type": "fromTo", "targetId": "s2_title", "vars": { "scale": 1, "autoAlpha": 1, "duration": 0.8 }, "fromVars": { "scale": 0.5, "autoAlpha": 0 }, "position": "-=0.5" },
                { "type": "fromTo", "targetId": "s2_sub", "vars": { "autoAlpha": 1, "duration": 0.8 }, "fromVars": { "autoAlpha": 0 }, "position": "-=0.3" }
              ],
               "ambience": [
                   { "type": "to", "targetId": "s2_floatie", "vars": { "y": 15, "yoyo": true, "repeat": -1, "duration": 2, "ease": "sine.inOut" } }
               ]
            },
            {
              "id": "screen_date",
              "cleanup": [
                { "type": "to", "targetId": "s2_bg_img", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s2_title", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s2_sub", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s2_floatie", "vars": { "x": 500, "autoAlpha": 0 } }
              ],
              "pageStyle": "background: linear-gradient(to bottom, #f7971e, #ffd200);",
              "completion": { "label": "Ver dónde es", "trigger": "interaction" },
              "animationFlow": [
                { "type": "fromTo", "targetId": "s3_sun", "vars": { "scale": 1, "autoAlpha": 1, "duration": 1 }, "fromVars": { "scale": 0, "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s3_title", "vars": { "y": 0, "autoAlpha": 1, "duration": 0.8 }, "fromVars": { "y": -50, "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s3_icon", "vars": { "scale": 1, "autoAlpha": 1, "duration": 0.5 }, "fromVars": { "scale": 0, "autoAlpha": 0 }, "position": "<" },
                { "type": "fromTo", "targetId": "slot_date", "vars": { "scale": 1, "autoAlpha": 1, "duration": 0.8, "ease": "back.out" }, "fromVars": { "scale": 0, "autoAlpha": 0 } }
              ]
            },
            {
              "id": "screen_location",
              "cleanup": [
                { "type": "to", "targetId": "s3_sun", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "slot_date", "vars": { "autoAlpha": 0, "y": 50 } },
                { "type": "to", "targetId": "s3_title", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s3_icon", "vars": { "autoAlpha": 0 } }
              ],
              "pageStyle": "background: linear-gradient(180deg, #56CCF2, #2F80ED);",
              "completion": { "label": "¿Qué llevo?", "trigger": "interaction" },
              "animationFlow": [
                { "type": "fromTo", "targetId": "s4_title", "vars": { "autoAlpha": 1, "duration": 0.5 }, "fromVars": { "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s4_decor", "vars": { "y": 0, "autoAlpha": 1, "duration": 0.8 }, "fromVars": { "y": 100, "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "slot_map", "vars": { "scale": 1, "autoAlpha": 1, "duration": 0.8, "ease": "elastic.out(1, 0.75)" }, "fromVars": { "scale": 0, "autoAlpha": 0 }, "position": "-=0.5" },
                { "type": "fromTo", "targetId": "s4_sub", "vars": { "autoAlpha": 1, "duration": 0.5 }, "fromVars": { "autoAlpha": 0 } }
              ]
            },
            {
              "id": "screen_bring_item",
              "cleanup": [
                { "type": "to", "targetId": "slot_map", "vars": { "scale": 0, "autoAlpha": 0 } },
                { "type": "to", "targetId": "s4_title", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s4_sub", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s4_decor", "vars": { "y": 100, "autoAlpha": 0 } }
              ],
              "pageStyle": "background: linear-gradient(45deg, #FF512F, #DD2476);",
              "completion": { "label": "¡Genial! ¿Hay premios?", "trigger": "interaction" },
              "animationFlow": [
                { "type": "fromTo", "targetId": "s5_title", "vars": { "autoAlpha": 1, "duration": 0.5 }, "fromVars": { "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s5_sub", "vars": { "autoAlpha": 1, "duration": 0.5 }, "fromVars": { "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s5_icon", "vars": { "scale": 1, "autoAlpha": 1, "duration": 0.5 }, "fromVars": { "scale": 0, "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "slot_machine", "vars": { "y": 0, "autoAlpha": 1, "duration": 0.8 }, "fromVars": { "y": 100, "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s5_balloon1", "vars": { "y": 0, "autoAlpha": 1, "duration": 1 }, "fromVars": { "y": 200, "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s5_balloon2", "vars": { "y": 0, "autoAlpha": 1, "duration": 1 }, "fromVars": { "y": 200, "autoAlpha": 0 }, "position": "<" }
              ]
            },
            {
              "id": "screen_raffle",
              "cleanup": [
                { "type": "to", "targetId": "slot_machine", "vars": { "autoAlpha": 0, "y": 100 } },
                { "type": "to", "targetId": "s5_title", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s5_sub", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s5_balloon1", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s5_balloon2", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s5_icon", "vars": { "autoAlpha": 0 } }
              ],
              "pageStyle": "background: linear-gradient(to right, #8e2de2, #4a00e0);",
              "completion": { "label": "¡Confirmar asistencia!", "trigger": "interaction" },
              "animationFlow": [
                { "type": "fromTo", "targetId": "s6_title", "vars": { "scale": 1, "autoAlpha": 1, "duration": 0.5, "ease": "elastic.out" }, "fromVars": { "scale": 0, "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s6_controller", "vars": { "rotation": 0, "autoAlpha": 1, "duration": 0.8 }, "fromVars": { "rotation": 180, "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s6_sub", "vars": { "autoAlpha": 1, "duration": 0.5 }, "fromVars": { "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s6_balloon", "vars": { "y": 0, "autoAlpha": 1, "duration": 1 }, "fromVars": { "y": 100, "autoAlpha": 0 } },
                { "type": "to", "targetId": "s6_confetti", "vars": { "autoAlpha": 1, "y": "110vh", "x": "random(-200, 200)", "rotation": "random(0, 360)", "duration": "random(2, 4)", "ease": "power1.out", "stagger": 0.05 } }
              ]
            },
            {
              "id": "screen_rsvp",
              "cleanup": [
                { "type": "to", "targetId": "s6_controller", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s6_title", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s6_sub", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s6_confetti", "vars": { "autoAlpha": 0 } },
                { "type": "to", "targetId": "s6_balloon", "vars": { "autoAlpha": 0 } }
              ],
              "pageStyle": "background: linear-gradient(135deg, #11998e, #38ef7d);",
              "completion": { "trigger": "interaction", label: "Finish" },
              "animationFlow": [
                { "type": "fromTo", "targetId": "s7_title", "vars": { "autoAlpha": 1, "duration": 0.5 }, "fromVars": { "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "slot_rsvp", "vars": { "y": 0, "autoAlpha": 1, "duration": 0.8, "ease": "back.out" }, "fromVars": { "y": 100, "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s7_sub", "vars": { "autoAlpha": 1, "duration": 0.5 }, "fromVars": { "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s7_balloon1", "vars": { "y": 0, "autoAlpha": 1, "duration": 1 }, "fromVars": { "y": 200, "autoAlpha": 0 } },
                { "type": "fromTo", "targetId": "s7_balloon2", "vars": { "y": 0, "autoAlpha": 1, "duration": 1 }, "fromVars": { "y": 200, "autoAlpha": 0 }, "position": "<" }
              ]
            }
          ]
        }
\`\`\`


**Reason about the request, and generate the JSON.**

**Important:**
- If provided, take the screen size into account, so you avoid overflow or cutoff.

`;
}

// ============================================================================
// User Prompt - Assembles the prepared inputs
// ============================================================================

function buildUserPrompt(
  copy: CopyResult,
  assignments: ScreenAssetAssignment[],
  assetUrlMap: Record<string, string>,
  namedAssets: NamedAsset[],
  width: number,
  height: number
): string {
  const screensWithAssets = copy.screens.map(screen => {
    const assignment = assignments.find(a => a.screenId === screen.id);
    const assets = assignment?.assets.map(a => {
      const named = namedAssets.find(n => n.id === a.assetId);
      return `      - ID: "${a.assetId}" | Role: ${a.role} | Type: ${named?.type || 'unknown'} | "${named?.description || 'N/A'}" | CSS hints: ${JSON.stringify(a.css)}`;
    }).join('\n') || '      (no assets assigned)';

    return `
### Screen: ${screen.id}
- **Purpose:** ${screen.purpose}
- **Headline:** "${screen.headline}"
- **Subtext:** ${screen.subtext ? `"${screen.subtext}"` : 'none'}
- **Slot to use:** ${screen.suggestedSlot || 'none'}
- **Completion:** trigger: "${screen.completionTrigger}"${screen.completionLabel ? `, label: "${screen.completionLabel}"` : ''}
- **Mood:** ${screen.suggestedMood || 'neutral'}
- **Page Style Suggestion:** ${screen.suggestedPageStyle || 'use color palette'}
- **Assigned Assets:**
${assets}`;
  }).join('\n');

  return `## Task: Assemble the Manifest JSON

You have all the creative decisions already made. Your job is to express them in the Manifest schema.

## Overall Theme
${copy.overallTheme}

## Color Palette
${copy.colorPalette.join(', ')}

## Screens (${copy.screens.length} total - DO NOT change order or add/remove screens)
${screensWithAssets}

## Asset URL Reference (use these EXACT URLs)
${Object.entries(assetUrlMap).map(([id, url]) => `- ${id}: ${url}`).join('\n') || '(no assets)'}

## Screen Size
Orientation: Portrait
Width: ${width}px
Height: ${height}px

**Output:** The complete Manifest JSON object.

`;
}

// ============================================================================
// Main Export
// ============================================================================

export async function generateExperience(
  copy: CopyResult,
  assignments: ScreenAssetAssignment[],
  availableSlots: Slot[],
  assetUrlMap: Record<string, string>,
  namedAssets: NamedAsset[],
  width: number,
  height: number,
): Promise<Manifest> {
  const { output: object } = await generateText({
    model: openrouter("google/gemini-3-pro-preview"),
    output: Output.json(),
    system: buildSystemPrompt(availableSlots),
    prompt: buildUserPrompt(copy, assignments, assetUrlMap, namedAssets, width, height),
  });

  const o = ManifestSchema.safeParse(object);

  if (!o.success) {
    throw new Error(`Failed to parse manifest: ${o.error}`);
  }

  return o.data;
}
