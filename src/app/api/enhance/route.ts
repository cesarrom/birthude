import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openrouter } from "@/lib/ai";

function buildPrompt(field: string, text: string, context: any, locale: string) {
  const base = `You are a creative birthday invitation copywriter. Improve the user's input for the "${field}" field. Answer in language code: "${locale}".`;
  const extras = {
    description: `Rewrite in a warm, playful tone. Keep details clear and concise. Avoid overlong sentences. Return only the improved text.`,
    title: `Make it catchy and short (3–6 words). No emojis. Return only the title text.`,
    theme: `Refine into a concise theme phrase. Avoid punctuation beyond basic words. Return only the theme.`,
    location: `If this is a venue name, produce a crisp one-line display name. Do not invent addresses. Return only the line.`,
  } as Record<string, string>;
  const ctx = context ? `\nContext: ${JSON.stringify(context)}` : "";
  const hint = extras[field] ?? `Polish the text. Keep it concise and friendly. Return only the improved text.`;
  return `${base}\n${hint}\nUser text: ${JSON.stringify(text)}${ctx}`;
}

export async function POST(req: NextRequest) {
  const { field, text, context } = await req.json();
  const locale = req.cookies.get("NEXT_LOCALE")?.value || "en";
  if (!text || !field) return NextResponse.json({ error: "Missing field or text" }, { status: 400 });
  const prompt = buildPrompt(String(field), String(text), context, locale);

  try {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("ai_disabled");
    const { text: out } = await generateText({ model: openrouter("openrouter/auto"), prompt });
    const cleaned = String(out || "").trim();
    if (!cleaned) throw new Error("empty_output");
    return NextResponse.json({ result: cleaned });
  } catch {
    const fallback = String(text).trim();
    const polished = fallback ? fallback.charAt(0).toUpperCase() + fallback.slice(1) : fallback;
    return NextResponse.json({ result: polished, notice: "ai_unavailable" });
  }
}