"use client";
import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { 
  useMarkSeen, useMarkSeenRaffle, 
  useTriviaState, useRevealInvitee
} from "@/hooks/use-birthude-api";

import { Invitation, normalizeExperience } from "../../_components/types";
import { ConfettiLauncher } from "../../_components/confetti-launcher";
import { CountdownTarget } from "../../_components/countdown-target";
import { OrganizerTools } from "../../_components/organizer-tools";
import { RaffleRoulette } from "../../_components/raffle-roulette";
import { RewindExperience } from "../../_components/rewind-experience";
import { playTone } from "../../_components/utils";

gsap.registerPlugin(useGSAP);

export default function ClientViewer({ invitation, identifier }: { invitation: Invitation; identifier: string }) {
  const t = useTranslations("viewer");
  const queryClient = useQueryClient();
  const router = useRouter();
  
  const [assigned, setAssigned] = useState<string | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [experience, setExperience] = useState<any | null>(null);
  const [step, setStep] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [expLoading, setExpLoading] = useState(true);
  const [maxStep, setMaxStep] = useState(5);
  const [showCountdown, setShowCountdown] = useState(false);
  // We use the prop identifier as the current invitee id
  const currentInviteeId = identifier;
  
  const [raffleState, setRaffleState] = useState<{ winnerIdentifier: string | null; hasSeenRaffle: boolean; prize: string | null } | null>(null);
  const [showRaffleReveal, setShowRaffleReveal] = useState(false);
  
  // Poll trivia
  const { data: triviaState } = useTriviaState(invitation.slug, !!currentInviteeId);
  
  useEffect(() => {
    if (triviaState?.status === "active" && triviaState.gameId && currentInviteeId) {
        console.log("[ClientViewer] Redirecting to active trivia", triviaState.gameId);
        router.push(`/i/${invitation.slug}/viewer/${encodeURIComponent(currentInviteeId)}/trivia/${triviaState.gameId}`);
    }
  }, [triviaState, currentInviteeId, invitation.slug, router]);

  const revealInvitee = useRevealInvitee(invitation.slug);
  const markSeenMut = useMarkSeen(invitation.slug, currentInviteeId || "");
  const markSeenRaffleMut = useMarkSeenRaffle(invitation.slug, currentInviteeId || "");

  const dateStr = useMemo(() => new Date(invitation.eventAt).toLocaleString(), [invitation.eventAt]);

  // Initial load
  useEffect(() => {
      if (!identifier) return;
      loadExperience();
  }, [identifier]);

  async function loadExperience() {
    setExpLoading(true);
    console.log("[ClientViewer] Loading experience for:", identifier);
    try {
        const data: any = await revealInvitee.mutateAsync(identifier);
        console.log("[ClientViewer] Load success", data);
        
        const norm = normalizeExperience(data.experience);
        setExperience(norm);
        setMaxStep((norm?.screens?.length || 6) - 1);
        if (data.raffle) setRaffleState(data.raffle);
        setIsOrganizer(data.isOrganizer);
        if (data.hasSeen) setShowCountdown(true);
        setAssigned(data.assignedItem);
    } catch (e) {
        console.error("[ClientViewer] Load failed", e);
    }
    setExpLoading(false);
  }
  
  async function markSeen() {
    if (!currentInviteeId) return;
    console.log("[ClientViewer] Marking seen", currentInviteeId);
    try {
        await markSeenMut.mutateAsync();
        setShowCountdown(true);
    } catch (e) {
        console.error("[ClientViewer] Mark seen failed", e);
    }
  }

  // Check for raffle reveal trigger
  useEffect(() => {
    if (showCountdown && raffleState?.winnerIdentifier && !raffleState.hasSeenRaffle) {
        console.log("[ClientViewer] Triggering Raffle Reveal");
        setShowRaffleReveal(true);
    }
  }, [showCountdown, raffleState]);

  async function onRaffleRevealComplete() {
      console.log("[ClientViewer] Raffle Reveal Complete");
      setShowRaffleReveal(false);
      setRaffleState(prev => prev ? ({ ...prev, hasSeenRaffle: true }) : null);
      if (currentInviteeId) {
          try { await markSeenRaffleMut.mutateAsync(); } catch {}
      }
  }

  return (
    <div className="relative">
      {triviaState?.status === "active" && !isOrganizer && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-white p-6">
            <div className="text-center">
                <h2 className="text-3xl font-bold mb-4">{t('trivia')}</h2>
                <p>{t('gameInProgress')}</p>
                <div className="mt-4 h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white mx-auto" />
            </div>
         </div>
      )}

      {showCountdown && triviaState?.status !== "active" && (
         <div className="fixed inset-0 z-40 flex items-center justify-center text-center p-6" 
              style={{ 
                  background: experience?.dashboard?.bg || "#000",
                  color: experience?.dashboard?.textColor || "#fff"
              }}>
            {/* Show Confetti if raffle winner is revealed or just standard celebration */}
            <ConfettiLauncher />
            
            {showRaffleReveal ? (
                <RaffleRoulette 
                    invitees={[]} // Will be fetched inside component
                    winnerIdentifier={raffleState?.winnerIdentifier!}
                    prize={raffleState?.prize}
                    onComplete={onRaffleRevealComplete}
                    slug={invitation.slug}
                />
            ) : (
                <div>
                    <h2 className="text-3xl font-bold mb-4" style={{ color: experience?.dashboard?.titleColor || "inherit" }}>
                        {experience?.dashboard?.title || t('youreIn')}
                    </h2>
                    <p className="mb-6 opacity-90" style={{ color: experience?.dashboard?.textColor || "inherit" }}>
                        {experience?.dashboard?.text || t('cantWait')}
                    </p>
                    
                    {raffleState?.winnerIdentifier && (
                        <div className="mb-8 rounded-2xl bg-white/10 p-4 backdrop-blur">
                            <div className="text-sm opacity-80 mb-1">{t('raffleWinner')}</div>
                            <div className="text-2xl font-extrabold">{raffleState.winnerIdentifier}</div>
                            {raffleState.prize && <div className="text-sm opacity-80 mt-1">{raffleState.prize}</div>}
                            {raffleState.winnerIdentifier === currentInviteeId && (
                                <div className="mt-2 text-yellow-300 font-bold animate-pulse">{t('youWon')}</div>
                            )}
                        </div>
                    )}

                    <CountdownTarget eventAt={invitation.eventAt} large />
                    <div className="mt-8">
                    <button 
                        onClick={() => { setShowCountdown(false); setStep(0); }} 
                        className="rounded-full px-6 py-3 font-bold hover:opacity-90 transition-opacity"
                        style={{ 
                            backgroundColor: experience?.dashboard?.buttonColor || "#fff",
                            color: experience?.dashboard?.buttonTextColor || "#000"
                        }}
                    >
                        {t('replay')}
                    </button>
                    </div>
                </div>
            )}
         </div>
      )}

      {expLoading && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-gradient-to-br from-purple-700 to-pink-600">
          <div className="flex flex-col items-center text-white">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            <div className="mt-3 text-sm opacity-90">{t('personalizing')}</div>
          </div>
        </div>
      )}

      {experience && !showCountdown && (
        <div className="fixed inset-0 z-10">
          {isOrganizer && (
            <div className="absolute right-0 top-0 z-20">
              <button className="mt-2 mr-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90" onClick={() => setToolsOpen(true)}>{t('organizer')}</button>
            </div>
          )}
          <RewindExperience 
            experience={experience} 
            invitation={invitation}
            assignedItem={assigned ?? ""} 
            step={step} 
            onNext={() => { 
                playTone(soundOn); 
                if (step >= maxStep) {
                    markSeen();
                } else {
                    setStep((s) => s + 1);
                }
            }} 
            onBack={() => { playTone(soundOn); setStep((s) => Math.max(0, s - 1)); }} 
            onToggleSound={() => setSoundOn((v) => !v)} 
          />
        </div>
      )}
      
      {toolsOpen && isOrganizer && (
        <div className="fixed inset-0 z-20">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setToolsOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[95%] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold">{t('organizerTools')}</div>
                <button className="rounded-full bg-white/20 px-3 py-1 text-sm hover:bg-white/30" onClick={() => setToolsOpen(false)}>{t('close')}</button>
              </div>
            </div>
            <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">
               <OrganizerTools
                 slug={invitation.slug}
                 items={invitation.items}
                 rafflePrize={invitation.rafflePrize}
                 onStartTrivia={() => queryClient.invalidateQueries({ queryKey: ["trivia", invitation.slug] })}
                 eventAt={invitation.eventAt as any}
                 raffleWinner={raffleState?.winnerIdentifier || null}
               />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
