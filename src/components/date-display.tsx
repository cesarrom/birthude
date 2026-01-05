"use client";

import { useTranslations } from "next-intl";
import { CalendarButton } from "./calendar-button";

type Props = {
  date: Date | string;
  event: {
    title: string;
    description?: string;
    location: string;
    start: Date | string;
  };
};

export function DateDisplay({ date, event }: Props) {
  const d = new Date(date);
  const month = d.toLocaleString('default', { month: 'long' });
  const day = d.getDate();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const weekday = d.toLocaleString('default', { weekday: 'long' });

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white/10 backdrop-blur-md rounded-2xl text-white shadow-xl border border-white/20">
      <div className="text-sm uppercase tracking-widest opacity-80 mb-1">{weekday}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-6xl font-black tracking-tighter">{day}</span>
        <span className="text-3xl font-bold uppercase">{month}</span>
      </div>
      <div className="text-xl font-medium mt-1 mb-4">{time}</div>
      
      <CalendarButton 
        event={event} 
        className="px-4 py-2 bg-white text-black rounded-full text-sm font-bold hover:bg-opacity-90 transition-all flex items-center gap-2"
      />
    </div>
  );
}
