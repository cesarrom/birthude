import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { store } from "@/lib/store";
import { z } from "zod";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  try {
    const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const list = await db.select().from(schema.invitees).where(eq(schema.invitees.invitationId, inv.id));
    const normalized = list.map((r: any) => ({
      ...r,
      isOrganizer: typeof r.isOrganizer !== "undefined" ? r.isOrganizer : !!r.is_organizer,
      imageUrl: typeof r.imageUrl !== "undefined" ? r.imageUrl : r.image_url,
    }));
    return NextResponse.json({ invitees: normalized });
  } catch {
    return NextResponse.json({ invitees: store.listInvitees(slug) });
  }
}

const createInviteeSchema = z.object({
  identifier: z.string().min(1),
  name: z.string().optional(),
  age: z.number().optional(),
  imageUrl: z.string().url().optional(),
  isOrganizer: z.boolean().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const data = createInviteeSchema.parse(await req.json());
  try {
    const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [row] = await db.insert(schema.invitees).values({
      invitationId: inv.id,
      identifier: data.identifier,
      name: data.name,
      age: data.age,
      imageUrl: data.imageUrl,
      isOrganizer: !!data.isOrganizer,
    }).returning();
    return NextResponse.json({ invitee: row }, { status: 201 });
  } catch {
    store.addInvitees(slug, [data]);
    return NextResponse.json({ invitee: data }, { status: 201 });
  }
}
