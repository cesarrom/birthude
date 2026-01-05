"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCookie } from "@/hooks/use-cookie";

export function LangSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lang = searchParams.get("lang");

  useEffect(() => {
    if (lang && ["en", "es", "fr", "pt"].includes(lang)) {
        // Set cookie
        const current = document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1];
        
        if (current !== lang) {
            document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000; SameSite=Lax`;
            router.refresh();
        }
    }
  }, [lang, router]);

  return null;
}
