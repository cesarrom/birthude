"use client";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useInvitees, useAddInvitee, useDrawRaffleWinner, useStartTrivia } from "@/hooks/use-birthude-api";
import { InviteeForm } from "@/components/invitee-form";

export function OrganizerTools({ slug, items, rafflePrize, onStartTrivia, eventAt, raffleWinner }: { slug: string; items: string[]; rafflePrize?: string | null; onStartTrivia?: () => void; eventAt: string | Date; raffleWinner: string | null }) {
  const t = useTranslations("viewer");
  const locale = useLocale();
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

  async function add(payload: { identifier: string; name?: string; age?: number; imageUrl?: string; isOrganizer?: boolean; context?: string }) {
    setSaving(true);
    console.log("[OrganizerTools] Adding invitee", payload.identifier);
    try {
        await addInvitee.mutateAsync(payload);
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

  function copyLink(identifier: string) {
    const url = `${window.location.origin}/i/${slug}/viewer/${encodeURIComponent(identifier)}?lang=${locale}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(t('linkCopied'));
    });
  }

  return (
    <div className="mt-6 rounded-xl border bg-white/70 p-4 shadow dark:bg-zinc-800">
      <div className="font-semibold flex justify-between items-center">
          {t('organizerTools')}
          {!rafflePrize && (
            <button onClick={startTrivia} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">{t('startTrivia')}</button>
          )}
      </div>
      <div className="mt-2">
        <InviteeForm onAdd={add} loading={saving} mode="tool" />
      </div>
      
      {/* Invitees List */}
      <div className="mt-6 border-t pt-4">
        <div className="font-semibold mb-2">{t('status')} ({invitees.length})</div>
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {invitees.map((inv: any) => (
                <div key={inv.identifier} className="flex items-center justify-between p-2 bg-white/50 dark:bg-black/20 rounded-lg text-sm">
                    <div className="flex flex-col">
                        <div className="font-bold flex items-center gap-2">
                            {inv.name || inv.identifier}
                            {inv.isConfirmed ? (
                                <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">{t('confirmed')}</span>
                            ) : (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">{t('pending')}</span>
                            )}
                        </div>
                        {inv.assignedItem && <div className="text-xs opacity-70">Item: {inv.assignedItem}</div>}
                    </div>
                    <button 
                        onClick={() => copyLink(inv.identifier)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 font-medium"
                    >
                        {t('copyLink')}
                    </button>
                </div>
            ))}
        </div>
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
