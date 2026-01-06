import { NextRequest, NextResponse } from "next/server";
import { isolateImageSubject } from "../invitations/[slug]/invitees/[identifier]/experience/pipeline/isolate-image-subject";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing 'url' query parameter" }, { status: 400 });
  }

  try {
    const result = await isolateImageSubject(url);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Isolation test error:", error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
