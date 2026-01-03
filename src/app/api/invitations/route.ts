import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { store } from "@/lib/store";

const createInvitationSchema = z.object({
  title: z.string().min(1),
  theme: z.string().min(1),
  description: z.string().optional(),
  eventAt: z.string(),
  location: z.string().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
  items: z.array(z.string()).default([]),
  invitees: z.array(z.object({
    identifier: z.string().min(1),
    name: z.string().optional(),
    age: z.number().optional(),
    imageUrl: z.string().url().optional(),
    isOrganizer: z.boolean().optional(),
  })).default([]),
  rafflePrize: z.string().optional().nullable(),
  assets: z.object({
    images: z.array(z.object({ name: z.string(), source: z.string().url(), mimeType: z.string() })).default([]),
    videos: z.array(z.object({ name: z.string(), source: z.string().url(), mimeType: z.string() })).default([]),
    audios: z.array(z.object({ name: z.string(), source: z.string().url(), mimeType: z.string() })).default([]),
  }).default({ images: [], videos: [], audios: [] }),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 64);
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    console.log("create-invitation request", json);
    const data = createInvitationSchema.parse(json);

    let baseSlug = slugify(data.title);
    if (!baseSlug) baseSlug = "invite";
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    try {
      const inserted = await db
        .insert(schema.invitations)
        .values({
          slug: uniqueSlug,
          title: data.title,
          theme: data.theme,
          description: data.description,
        eventAt: new Date(data.eventAt),
        location: data.location,
        lat: data.lat,
        lng: data.lng,
        items: data.items,
        rafflePrize: data.rafflePrize ?? null,
        assets: data.assets,
      })
        .returning();
      const invId = inserted[0].id as string;
      if (data.invitees.length) {
        await db.insert(schema.invitees).values(
          data.invitees.map((p) => ({
            invitationId: invId,
            identifier: p.identifier,
            name: p.name,
            age: p.age,
            imageUrl: p.imageUrl,
            isOrganizer: !!p.isOrganizer,
          }))
        );
      }
      return NextResponse.json({ invitation: inserted[0] }, { status: 201 });
    } catch {
      const inv = store.saveInvitation({
        slug: uniqueSlug,
        title: data.title,
        theme: data.theme,
        description: data.description ?? null,
        eventAt: new Date(data.eventAt),
        location: data.location,
        lat: data.lat,
        lng: data.lng,
        items: data.items,
        rafflePrize: data.rafflePrize ?? null,
        assets: data.assets,
        createdAt: new Date(),
      });
      if (data.invitees.length) {
        store.addInvitees(uniqueSlug, data.invitees);
      }
      return NextResponse.json({ invitation: inv }, { status: 201 });
    }
  } catch (err: any) {
    const details = (err?.errors || err?.issues || []).map((e: any) => ({ path: e.path, message: e.message }));
    console.error("create-invitation error", err?.message, details);
    return NextResponse.json({ error: err.message ?? "Invalid request", details }, { status: 400 });
  }
}

export async function GET() {
  try {
    const rows = await db.select().from(schema.invitations).limit(50);
    return NextResponse.json({ invitations: rows });
  } catch {
    return NextResponse.json({ invitations: store.listInvitations() });
  }
}