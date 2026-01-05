"use client";

import { useEffect, useState } from "react";

export function DbHealthMonitor() {
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) throw new Error("DB Error");
      } catch (e) {
        setError(true);
      }
    };
    check();
  }, []);

  if (!error) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-red-600 px-4 py-2 text-center text-sm font-bold text-white shadow-lg">
      ⚠️ Database Connection Error: Features may not work.
    </div>
  );
}
