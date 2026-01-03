"use client";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export function CountdownTarget({ eventAt, large }: { eventAt: string | Date; large?: boolean }) {
  const t = useTranslations("viewer");
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const target = new Date(eventAt);
      const now = new Date();
      const difference = target.getTime() - now.getTime();

      if (difference > 0) {
        // Calculate units
        const seconds = Math.floor((difference / 1000) % 60);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        
        setTimeLeft({
          days,
          hours,
          minutes,
          seconds
        });
      } else {
        setTimeLeft(null); // Event passed
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [eventAt]);

  if (!timeLeft) {
    return (
      <div className={`mt-3 opacity-90 ${large ? "text-2xl" : "text-sm"}`}>
        {t('eventStarted')}
      </div>
    );
  }

  // Helper to render a time unit block
  const TimeUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center mx-2">
      <span className={`font-bold ${large ? "text-3xl md:text-5xl" : "text-lg"}`}>{value}</span>
      <span className={`text-[10px] uppercase opacity-70 ${large ? "text-xs" : "text-[8px]"}`}>{label}</span>
    </div>
  );

  return (
    <div className={`mt-3 flex flex-wrap justify-center items-center ${large ? "gap-2" : "gap-1"}`}>
      <TimeUnit value={timeLeft.days} label={t('days')} />
      <TimeUnit value={timeLeft.hours} label={t('hours')} />
      <TimeUnit value={timeLeft.minutes} label={t('minutes')} />
      <TimeUnit value={timeLeft.seconds} label={t('seconds')} />
    </div>
  );
}
