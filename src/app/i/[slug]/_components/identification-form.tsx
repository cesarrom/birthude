"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function IdentificationForm({ slug }: { slug: string }) {
  const t = useTranslations("viewer");
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit() {
    if (!identifier.trim()) return;
    setLoading(true);
    // Redirect to the viewer page with the identifier
    router.push(`/i/${slug}/viewer/${encodeURIComponent(identifier.trim())}`);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="text-center text-2xl font-bold">{t('identify')}</div>
      <div className="mt-4 flex w-full max-w-md gap-2">
        <input 
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-black placeholder-zinc-500 dark:bg-zinc-800 dark:text-white dark:border-zinc-700" 
            placeholder={t('placeholder')} 
            value={identifier} 
            onChange={(e) => setIdentifier(e.target.value)} 
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <button 
            onClick={handleSubmit} 
            disabled={loading}
            className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
            {loading ? "..." : t('reveal')}
        </button>
      </div>
    </div>
  );
}
