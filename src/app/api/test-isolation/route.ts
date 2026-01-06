import { NextRequest, NextResponse } from "next/server";
import { isolateImageSubject } from "../invitations/[slug]/invitees/[identifier]/experience/pipeline/isolate-image-subject";

export async function GET(req: NextRequest) {
  
    return NextResponse.json({ success: true });
}
