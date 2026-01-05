"use client";

import { useState } from "react";

export function useCookie(name: string) {
  const [value, setValue] = useState(() => {
    if (typeof document === "undefined") return "";
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? match[2] : "";
  });

  const setCookie = (val: string, days = 365) => {
    const d = new Date();
    d.setTime(d.getTime() + 24 * 60 * 60 * 1000 * days);
    document.cookie = `${name}=${val};path=/;expires=${d.toUTCString()}`;
    setValue(val);
  };

  return [value, setCookie] as const;
}
