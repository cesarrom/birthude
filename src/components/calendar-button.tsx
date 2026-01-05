"use client";

import { useTranslations } from "next-intl";

type Props = {
  event: {
    title: string;
    description?: string;
    location: string;
    start: Date | string;
  };
  className?: string;
  label?: string;
};

export function CalendarButton({ event, className, label }: Props) {
  const t = useTranslations("viewer");

  function downloadCalendar() {
     console.log("[CalendarButton] Downloading calendar");
     const start = new Date(event.start);
     const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // Assume 2 hours
     const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
     const content = [
       "BEGIN:VCALENDAR",
       "VERSION:2.0",
       "BEGIN:VEVENT",
       `DTSTART:${fmt(start)}`,
       `DTEND:${fmt(end)}`,
       `SUMMARY:${event.title}`,
       `DESCRIPTION:${event.description || ""}`,
       `LOCATION:${event.location}`,
       "END:VEVENT",
       "END:VCALENDAR"
     ].join("\r\n");
     const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = "invitation.ics";
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
  }

  return (
    <button onClick={downloadCalendar} className={className}>
      {label || t('addToCalendar')}
    </button>
  );
}
