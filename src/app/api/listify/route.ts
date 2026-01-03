import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openrouter } from "@/lib/ai";

function buildPrompt(text: string, context: any, locale: string) {
  return `You are helping craft a birthday party bring-list. Use the context to infer reasonable, specific items if helpful, but do not invent unsafe or impossible items.
Return ONLY a single line where items are separated by ';' characters, no numbering, no quotes, no extra words. Output items in language code: "${locale}".
Context: ${JSON.stringify(context)}
User input: ${JSON.stringify(text)}`;
}

function normalizeList(s: string) {
  const raw = s.split(";");
  const items = raw.map((x) => x.trim()).filter((x) => x.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const key = it.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(it); }
  }
  return out;
}

function fallbackParse(text: string) {
  const raw = text.split(/[,;\n]|\band\b/gi).map((x) => x.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of raw) {
    const key = it.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(it); }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const { text, context } = await req.json();
  const locale = req.cookies.get("NEXT_LOCALE")?.value || "en";
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });
  const prompt = buildPrompt(String(text), context, locale);
  try {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("ai_disabled");
    const { text: out } = await generateText({ model: openrouter("openrouter/auto"), prompt });
    const items = normalizeList(String(out ?? ""));
    if (!items.length) throw new Error("empty_output");
    return NextResponse.json({ items });
  } catch {
    const items = fallbackParse(String(text));
    return NextResponse.json({ items, notice: "ai_unavailable" });
  }
}