import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openrouter } from "@/lib/ai";

function ideasPrompt(context: any, locale: string, count: number, userPrompt = '') {
    return `You are a party invitation graphic designer. Brainstorm a set of ${count} concise asset ideas suitable for the invitation visuals.
Examples: "balloon", "confetti", "cake", "ribbon", "star", "gift", "party hat".
Constraints:
- Return ONLY a JSON array of ${count} ideas.
- Output ideas in language code: "${locale}".
Context: ${JSON.stringify(context)}${userPrompt ? `\nUser Prompt: ${userPrompt}` : ''}`;
}

function svgPromptForIdea(idea: string, context: any) {
    return `Create ONE inline SVG for the idea: ${idea}.
Constraints:
- Return ONLY the SVG markup string.
- width=128 height=128 viewBox="0 0 128 128".
- no external references. no background color or background element.
- no text or labels.
Context: ${JSON.stringify(context)}`;
}

function fallbackSvgs(count = 10) {
    const colors = ["#ff67a1", "#6c5ce7", "#00b894", "#fdcb6e", "#e17055", "#0984e3", "#2d3436", "#fab1a0", "#55efc4", "#ffeaa7"];
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
        const c = colors[i % colors.length];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="none" width="128" height="128"/><circle cx="64" cy="64" r="40" fill="${c}"/><path d="M64 104 C70 112, 60 120, 64 128" stroke="${c}" stroke-width="4" fill="none"/></svg>`;
        out.push(svg);
    }
    return out;
}

function normalizeIdeas(text: string, count: number) {
    try {
        const arr = JSON.parse(text);
        if (Array.isArray(arr)) return arr.filter((s) => typeof s === "string").slice(0, count);
    } catch { }
    const raw = text.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    return raw.slice(0, count);
}

export async function POST(req: NextRequest) {
    let { context, count, userPrompt = '' } = await req.json();
    count = typeof count === "number" && count > 0 ? count : 10;
    const locale = req.cookies.get("NEXT_LOCALE")?.value || "en";
    const reqId = `assets-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const hasKey = !!process.env.OPENROUTER_API_KEY;
    context = Object.assign({}, context ?? {}, { assets: null })
    const ctxStr = JSON.stringify(context).slice(0, 800);
    console.log(`[assets.generate] start reqId=${reqId} aiKey=${hasKey}`);
    console.log(`[assets.generate] context reqId=${reqId} ctx=${ctxStr}`);

    try {
        if (!process.env.OPENROUTER_API_KEY) {
            console.warn(`[assets.generate] ai disabled reqId=${reqId}`);
            const svgs = fallbackSvgs(count);
            return NextResponse.json({ svgs, notice: "ai_disabled", meta: { aiEnabled: false, reqId } });
        }
        const meta: any = { aiEnabled: true, errors: [], ideas: [], successes: 0, failures: 0, reqId };
        const tIdeas = Date.now();
        const ideasRes = await generateText({ model: openrouter("google/gemini-3-flash-preview"), prompt: ideasPrompt(context, locale, count, userPrompt) });
        console.log(`[assets.generate] ideas raw len=${(ideasRes.text ?? "").length} dur=${Date.now() - tIdeas}ms reqId=${reqId}`);
        let ideas = normalizeIdeas(String(ideasRes.text ?? ""), count);
        console.log(`[assets.generate] ideas normalized count=${ideas.length} list=${JSON.stringify(ideas)} reqId=${reqId}`);
        meta.ideas = ideas;
        if (ideas.length < count) ideas = [...ideas, ...["balloon", "confetti", "cake", "ribbon", "star", "gift", "party hat", "sparkles", "streamer", "cupcake"].slice(0, count - ideas.length)];
        const calls = ideas.map((idea, i) => generateText({ model: openrouter("google/gemini-3-flash-preview"), prompt: svgPromptForIdea(idea, context) }).then(r => ({ ok: true, i, idea, text: r.text })).catch(err => ({ ok: false, i, idea, error: String(err?.message ?? err) })));
        const results = await Promise.allSettled(calls);
        let svgs: string[] = [];
        for (const r of results) {
            if (r.status === "fulfilled") {
                const payload: any = r.value as any;
                if (payload.ok) {
                    const svg = String(payload.text ?? "").trim();
                    const valid = svg.startsWith("<svg") && svg.includes("viewBox");
                    if (valid) { svgs.push(svg); meta.successes++; console.log(`[assets.generate] idea ok i=${payload.i} name=${payload.idea} svgLen=${svg.length} reqId=${reqId}`); }
                    else { meta.failures++; meta.errors.push(`invalid_svg:${payload.i}`); console.warn(`[assets.generate] invalid svg i=${payload.i} name=${payload.idea} len=${svg.length} reqId=${reqId}`); }
                } else {
                    meta.failures++;
                    meta.errors.push(String(payload.error || "call_failed"));
                    console.warn(`[assets.generate] call failed i=${payload.i} name=${payload.idea} error=${payload.error} reqId=${reqId}`);
                }
            } else {
                meta.failures++;
                meta.errors.push(String((r as any).reason?.message ?? "call_failed"));
                console.warn(`[assets.generate] promise failed reason=${String((r as any).reason)} reqId=${reqId}`);
            }
        }
        console.log(`[assets.generate] per-idea done successes=${meta.successes} failures=${meta.failures} reqId=${reqId}`);
        if (svgs.length < count) svgs = [...svgs, ...fallbackSvgs(count - svgs.length)];
        if (meta.errors.length) console.error("assets_generate_errors", meta);
        console.log(`[assets.generate] finish count=${svgs.length} reqId=${reqId}`);
        return NextResponse.json({ svgs, meta });
    } catch (e) {
        console.error(e);
        const svgs = fallbackSvgs(count);
        console.error(`[assets.generate] exception fallback reqId=${reqId}`);
        return NextResponse.json({ svgs, notice: "ai_unavailable", meta: { reqId } });
    }
}