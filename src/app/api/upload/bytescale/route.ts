import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { data, mimeType, name } = await req.json();
  const baseUrl = process.env.CONTENTO_BASE_URL;
  const projectId = process.env.CONTENTO_PROJECT_ID;
  const projectSlug = process.env.CONTENTO_PROJECT_SLUG;
  const apiKey = process.env.CONTENTO_API_KEY;
  if (!baseUrl || !projectId || !projectSlug || !apiKey) {
    return NextResponse.json({ error: "Contento not configured" }, { status: 500 });
  }
  try {
    const raw = String(data);
    const comma = raw.indexOf(',');
    const header = comma > -1 ? raw.slice(0, comma) : '';
    const body = comma > -1 ? raw.slice(comma + 1) : raw;
    const isBase64 = /;base64/.test(header);
    const buf = isBase64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8');

    const safeName = String(name || `resource-${Date.now()}`)
      .trim()
      .replace(/\\/g, "-")
      .replace(/\//g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    const path = `/uploads/${Date.now()}-${safeName || "resource"}`;

    const signRes = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/v1/projects/${projectId}/sign/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path,
        contentType: mimeType || "application/octet-stream",
      }),
    });

    if (!signRes.ok) {
      const text = await signRes.text();
      return NextResponse.json({ error: `Contento sign upload failed: ${signRes.status} ${text}` }, { status: 500 });
    }

    const signJson = await signRes.json();
    const uploadUrl = signJson?.data?.url;
    const uploadMethod = String(signJson?.data?.method || "PUT").toUpperCase();
    if (!uploadUrl || uploadMethod !== "PUT") {
      return NextResponse.json({ error: "Contento sign upload returned invalid response" }, { status: 500 });
    }

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: buf,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      return NextResponse.json({ error: `Contento upload failed: ${uploadRes.status} ${text}` }, { status: 500 });
    }

    const normalizedBase = baseUrl.replace(/\/+$/, "");
    const filePath = path.replace(/^\//, "");
    const fileUrl = `${normalizedBase}/f/raw/${projectSlug}/${filePath}`;
    return NextResponse.json({ fileUrl, filePath });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
