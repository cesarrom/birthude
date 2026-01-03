"use client";

import { useEffect, useState } from "react";

export default function LanguageSelector() {
  const [locale, setLocale] = useState("en");

  useEffect(() => {
    // Basic cookie reader
    const match = document.cookie.match(new RegExp('(^| )NEXT_LOCALE=([^;]+)'));
    if (match) setLocale(match[2]);
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-50">
       <select 
         className="bg-black/50 text-white backdrop-blur px-2 py-1 rounded-md text-xs border border-white/20" 
         onChange={(e) => {
           document.cookie = `NEXT_LOCALE=${e.target.value}; path=/; max-age=31536000`;
           window.location.reload();
         }} 
         value={locale}
       >
           <option value="en">English</option>
           <option value="es">Español</option>
           <option value="fr">Français</option>
           <option value="pt">Português</option>
       </select>
    </div>
  );
}
