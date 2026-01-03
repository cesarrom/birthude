import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") || "";
  const limit = searchParams.get("limit") || "5";
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Geocoding unavailable" }, { status: 400 });
  const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&limit=${encodeURIComponent(limit)}&format=json&apiKey=${apiKey}`;
  const json = await fetch(url).then((r) => r.json());
  return NextResponse.json(json);
}