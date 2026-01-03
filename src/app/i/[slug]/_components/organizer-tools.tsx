"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useInvitees, useAddInvitee, useDrawRaffleWinner, useStartTrivia } from "@/hooks/use-birthude-api";

export function OrganizerTools({ slug, items, rafflePrize, onStartTrivia, eventAt, raffleWinner }: { slug: string; items: string[]; rafflePrize?: string | null; onStartTrivia?: () => void; eventAt: string | Date; raffleWinner: string | null }) {
  const t = useTranslations("viewer");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [localWinner, setLocalWinner] = useState<string | null>(null);
  
  // Logic for 1 min delay
  const [tooEarly, setTooEarly] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const checkTime = () => {
        const start = new Date(eventAt).getTime();
        const unlockTime = start + 60000; // 1 minute after start
        const now = Date.now();
        
        if (now >= unlockTime) {
            setTooEarly(false);
            setTimeLeft("");
        } else {
            setTooEarly(true);
            const diff = Math.max(0, unlockTime - now);
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const parts = [];
            if (days > 0) parts.push(`${days}${t('shortDay')}`);
            if (hours > 0 || days > 0) parts.push(`${hours}${t('shortHour')}`);
            if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}${t('shortMinute')}`);
            parts.push(`${seconds}${t('shortSecond')}`);

            setTimeLeft(parts.join(", "));
        }
    };
    
    checkTime();
    const interval = setInterval(checkTime, 1000); // Check every 1s for countdown
    return () => clearInterval(interval);
  }, [eventAt]);

  const winner = raffleWinner || localWinner;

  const { data: inviteesData } = useInvitees(slug);
  const invitees = inviteesData?.invitees || [];
  
  const addInvitee = useAddInvitee(slug);
  const drawRaffle = useDrawRaffleWinner(slug);
  const startTriviaMut = useStartTrivia(slug);

  const assignedCount: Record<string, number> = {};
  invitees.forEach((inv: any) => { if (inv.assignedItem) assignedCount[inv.assignedItem] = (assignedCount[inv.assignedItem] || 0) + 1; });
  
  const remaining = items.filter(i => !assignedCount[i]);

  async function add() {
    if (!identifier.trim()) return;
    setSaving(true);
    console.log("[OrganizerTools] Adding invitee", identifier);
    try {
        await addInvitee.mutateAsync({ identifier: identifier.trim(), name: name.trim() || undefined, age: typeof age === "number" ? age : undefined, imageUrl: imageUrl.trim() || undefined });
        setName(""); setIdentifier(""); setAge(""); setImageUrl("");
    } catch (e) {
        console.error("[OrganizerTools] Add invitee failed", e);
    }
    setSaving(false);
  }

  async function drawWinner() {
      if (tooEarly) {
          alert(t('raffleLockedDesc') || "Available 1 min after event start");
          return;
      }
      if (!confirm("Are you sure? This will pick a winner.")) return;
      console.log("[OrganizerTools] Drawing winner");
      try {
          const data: any = await drawRaffle.mutateAsync();
          setLocalWinner(data.winnerIdentifier);
          alert(`${t('winnerIs')} ${data.winnerIdentifier}`);
      } catch (e: any) {
          console.error("[OrganizerTools] Draw winner failed", e);
          alert(e.message || "Error");
      }
  }

  async function startTrivia() {
      if (rafflePrize && !winner && tooEarly) {
           alert(t('raffleLockedDesc') || "Available 1 min after event start");
           return;
      }
      if (!confirm("Start Trivia Game?")) return;
      console.log("[OrganizerTools] Starting Trivia");
      await startTriviaMut.mutateAsync();
      onStartTrivia?.();
  }

  return (
    <div className="mt-6 rounded-xl border bg-white/70 p-4 shadow dark:bg-zinc-800">
      <div className="font-semibold flex justify-between items-center">
          {t('organizerTools')}
          {/* Header button: Keep it for "Just for fun" trivia if no prize, or general access */}
          {/* But user wants "Start quiz" specifically for prize decision if prize exists. */}
          {/* We will hide this generic one if prize exists to avoid confusion, or keep it as generic */}
          {!rafflePrize && (
            <button onClick={startTrivia} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">{t('startTrivia')}</button>
          )}
      </div>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
        <input className="rounded-xl border px-3 py-2" placeholder={t('name')} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded-xl border px-3 py-2" placeholder={t('identifier')} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        <input className="rounded-xl border px-3 py-2" type="number" placeholder={t('age')} value={age as any} onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")} />
        <input className="rounded-xl border px-3 py-2" placeholder={t('imageUrl')} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
      </div>
      <div className="mt-2 flex justify-end">
        <button className="rounded-xl bg-black px-4 py-2 text-white" disabled={saving} onClick={add}>{saving ? t('saving') : t('invite')}</button>
      </div>
      
      {items.length > 0 && (
          <div className="mt-6 border-t pt-4">
              <div className="font-semibold mb-2">{t('availableItems')} ({remaining.length}/{items.length})</div>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {remaining.map(it => (
                      <span key={it} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">{it}</span>
                  ))}
                  {remaining.length === 0 && <span className="text-sm text-gray-500">{t('allItemsAssigned')}</span>}
              </div>
          </div>
      )}

      {rafflePrize && (
          <div className="mt-6 border-t pt-4">
              <div className="font-semibold mb-2">{t('raffle')}</div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <div className="text-sm opacity-80 mb-2">{t('rafflePrize')}: {rafflePrize}</div>
                  {winner ? (
                      <div className="text-lg font-bold text-purple-700 dark:text-purple-300">{t('winnerIs')} {winner}</div>
                  ) : (
                      <div className="flex flex-col gap-2">
                          <button 
                            onClick={drawWinner} 
                            disabled={tooEarly}
                            className={`w-full py-2 rounded-lg font-bold shadow-lg transition-opacity ${tooEarly ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90'}`}
                          >
                              {tooEarly ? `${t('raffleLocked') || 'Locked'} (${timeLeft})` : t('drawWinner')}
                          </button>
                          
                          <div className="text-center text-xs opacity-50">- OR -</div>

                          <button 
                            onClick={startTrivia} 
                            disabled={tooEarly}
                            className={`w-full py-2 rounded-lg font-bold shadow-lg transition-opacity ${tooEarly ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:opacity-90'}`}
                          >
                              {tooEarly ? `${t('raffleLocked') || 'Locked'} (${timeLeft})` : t('startTrivia')}
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
}
