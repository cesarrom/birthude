import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Geocoding unavailable" }, { status: 400 });
  if (!lat || !lng) return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&apiKey=${apiKey}&format=json`;
  const json = await fetch(url).then((r) => r.json());
  return NextResponse.json(json);
}