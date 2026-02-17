import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { store } from "@/lib/store";
import { z } from "zod";
import { auth } from "@/lib/auth";

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
  context: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  const data = createInviteeSchema.parse(await req.json());

  try {
    // Get invitation and verify ownership
    const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Check user has credits
    const [user] = await db.select({ credits: schema.users.credits }).from(schema.users).where(eq(schema.users.id, session.user.id));
    if (!user || user.credits < 1) {
      return NextResponse.json({ error: "Insufficient credits. Please purchase more credits.", code: "INSUFFICIENT_CREDITS" }, { status: 402 });
    }

    // Consume 1 credit and create invitee in a single transaction
    await db.update(schema.users).set({
      credits: sql`${schema.users.credits} - 1`,
      updatedAt: new Date(),
    }).where(eq(schema.users.id, session.user.id));

    const [row] = await db.insert(schema.invitees).values({
      invitationId: inv.id,
      identifier: data.identifier,
      name: data.name,
      age: data.age,
      imageUrl: data.imageUrl,
      isOrganizer: !!data.isOrganizer,
      context: data.context,
    }).returning();

    return NextResponse.json({ invitee: row, creditsRemaining: user.credits - 1 }, { status: 201 });
  } catch (error) {
    console.error("Create invitee error:", error);
    store.addInvitees(slug, [data]);
    return NextResponse.json({ invitee: data }, { status: 201 });
  }
}

