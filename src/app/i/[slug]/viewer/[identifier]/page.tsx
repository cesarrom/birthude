import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { store } from "@/lib/store";
import { getTranslations } from "next-intl/server";
import ClientViewer from "./client-viewer";

export default async function ViewerPage({ params }: { params: Promise<{ slug: string; identifier: string }> }) {
  const { slug, identifier } = await params;
  const t = await getTranslations("page");
  
  let inv: any = null;
  try {
    const rows = await db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).limit(1);
    inv = rows[0] ?? null;
  } catch {
    inv = store.getBySlug(slug);
  }
  
  if (!inv) return <div className="p-10">{t('notFound')}</div>;

  const decodedIdentifier = decodeURIComponent(identifier);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-200 to-pink-200 dark:from-black dark:to-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-5xl font-extrabold tracking-tight">{inv.title}</h1>
        <p className="mt-2 text-lg opacity-80">{t('theme', {theme: inv.theme})}</p>
        <div className="mt-6 rounded-2xl bg-white/70 p-6 shadow-xl dark:bg-zinc-800">
          <ClientViewer invitation={inv} identifier={decodedIdentifier} />
        </div>
      </div>
    </div>
  );
}
