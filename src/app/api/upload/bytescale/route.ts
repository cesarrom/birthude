import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { data, mimeType, name } = await req.json();
  const accountId = process.env.BYTESCALE_ACCOUNT_ID;
  const apiKey = process.env.BYTESCALE_API_KEY;
  if (!accountId || !apiKey) return NextResponse.json({ error: "Bytescale not configured" }, { status: 500 });
  try {
    const endpoint = `https://api.bytescale.com/v2/accounts/${accountId}/uploads/binary`;
    const raw = String(data);
    const comma = raw.indexOf(',');
    const header = comma > -1 ? raw.slice(0, comma) : '';
    const body = comma > -1 ? raw.slice(comma + 1) : raw;
    const isBase64 = /;base64/.test(header);
    const buf = isBase64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8');
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Upload-Filename": name || `resource-${Date.now()}`,
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: buf as any,
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Bytescale upload failed: ${res.status} ${text}` }, { status: 500 });
    }
    const json = await res.json();
    return NextResponse.json({ fileUrl: json.fileUrl, filePath: json.filePath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Upload error" }, { status: 500 });
  }
}
