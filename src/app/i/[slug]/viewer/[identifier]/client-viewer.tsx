import { useEffect, useMemo, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { 
  useMarkSeen, useMarkSeenRaffle, 
  useTriviaState, useRevealInvitee, useConfirmAssistance
} from "@/hooks/use-birthude-api";

import { createRoot } from "react-dom/client";
import { SchemaEngine, SchemaManifest, SlotRenderer } from "./_engine/engine";

const MapCanvas = dynamic(() => import("@/components/map-canvas"), { ssr: false });
import { SlotMachinePro } from "../../_components/slot-machine-pro";
import { Invitation } from "../../_components/types";
import { ConfettiLauncher } from "../../_components/confetti-launcher";
import { CountdownTarget } from "../../_components/countdown-target";
import { OrganizerTools } from "../../_components/organizer-tools";
import { RaffleRoulette } from "../../_components/raffle-roulette";
import { playTone } from "../../_components/utils";

gsap.registerPlugin(useGSAP);

export default function ClientViewer({ invitation, identifier }: { invitation: Invitation; identifier: string }) {
  const t = useTranslations("viewer");
  const queryClient = useQueryClient();
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<'loading' | 'playing' | 'final'>('loading');
  const [assigned, setAssigned] = useState<string | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [experience, setExperience] = useState<SchemaManifest | null>(null);
  const engineRef = useRef<SchemaEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // We use the prop identifier as the current invitee id
  const currentInviteeId = identifier;
  const [isConfirmed, setIsConfirmed] = useState(false);
  
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
  const confirmAssistanceMut = useConfirmAssistance(invitation.slug, currentInviteeId || "");

  const dateStr = useMemo(() => new Date(invitation.eventAt).toLocaleString(), [invitation.eventAt]);

  // Initial load
  useEffect(() => {
      if (!identifier) return;
      loadExperience();
  }, [identifier]);

  async function loadExperience() {
    setViewMode('loading');
    console.log("[ClientViewer] Loading experience for:", identifier);
    try {
        const data: any = await revealInvitee.mutateAsync(identifier);
        console.log("[ClientViewer] Load success", data);
        
        // We assume data.experience IS the SchemaManifest
        setExperience(data.experience);
        
        if (data.raffle) setRaffleState(data.raffle);
        setIsOrganizer(data.isOrganizer);
        
        setAssigned(data.assignedItem);
        setIsConfirmed(data.isConfirmed);

        if (data.hasSeen) {
            setViewMode('final');
        } else {
            setViewMode('playing');
        }
    } catch (e) {
        console.error("[ClientViewer] Load failed", e);
        // Fallback to final if load fails? Or show error?
        setViewMode('final'); 
    }
  }
  
  async function markSeen() {
    if (!currentInviteeId) return;
    console.log("[ClientViewer] Marking seen", currentInviteeId);
    try {
        await markSeenMut.mutateAsync();
    } catch (e) {
        console.error("[ClientViewer] Mark seen failed", e);
    }
  }

  // --- ENGINE INTEGRATION ---
  useEffect(() => {
    if (viewMode === 'playing' && experience && containerRef.current) {
        // Define Slots
        const slots: Record<string, SlotRenderer> = {
            "MapComponent": (container) => {
                const root = createRoot(container);
                root.render(
                    <div style={{ width: '100%', height: '100%', background: 'white', borderRadius: '20px', overflow: 'hidden' }}>
                        <MapCanvas onClick={() => {}} marker={invitation.lat ? { lat: invitation.lat, lng: invitation.lng! } : undefined} center={invitation.lat ? { lat: invitation.lat, lng: invitation.lng! } : undefined} height={300} />
                    </div>
                );
            },
            "CountdownComponent": (container) => {
                const root = createRoot(container);
                root.render(
                    <div style={{ textAlign: 'center', color: 'white' }}>
                        <CountdownTarget eventAt={invitation.eventAt} large />
                    </div>
                );
            },
            "SlotMachineComponent": (container) => {
                const root = createRoot(container);
                root.render(
                    <SlotMachinePro items={invitation.items} assignedItem={assigned || ""} />
                );
            },
            "RSVPForm": (container, engine) => {
                // Not really used in this flow since we have a final screen, but maybe for manual trigger?
                // For now let's just make it a "Finish" button wrapper
                const root = createRoot(container);
                root.render(
                    <button 
                        onClick={() => engine.next()}
                        className="rounded-full bg-white text-black px-8 py-4 font-bold text-xl shadow-lg hover:scale-105 transition-transform"
                    >
                        {t('finish')}
                    </button>
                );
            }
        };

        const engine = new SchemaEngine({
            container: containerRef.current,
            manifest: experience,
            slots
        });

        engine.on((e) => {
            if (e.type === 'SEQUENCE_COMPLETE') {
                markSeen();
                setViewMode('final');
            }
        });

        engine.init();
        engineRef.current = engine;

        // Cleanup? SchemaEngine doesn't have destroy yet, but we should clear container if unmounting
        return () => {
            engineRef.current = null;
            if (containerRef.current) containerRef.current.innerHTML = '';
        };
    }
  }, [viewMode, experience]);


  // Check for raffle reveal trigger
  useEffect(() => {
    if (viewMode === 'final' && raffleState?.winnerIdentifier && !raffleState.hasSeenRaffle) {
        console.log("[ClientViewer] Triggering Raffle Reveal");
        setShowRaffleReveal(true);
    }
  }, [viewMode, raffleState]);

  async function onRaffleRevealComplete() {
      console.log("[ClientViewer] Raffle Reveal Complete");
      setShowRaffleReveal(false);
      setRaffleState(prev => prev ? ({ ...prev, hasSeenRaffle: true }) : null);
      if (currentInviteeId) {
          try { await markSeenRaffleMut.mutateAsync(); } catch {}
      }
  }

  async function confirmAssistance() {
      if (!currentInviteeId) return;
      try {
          await confirmAssistanceMut.mutateAsync();
          setIsConfirmed(true);
      } catch (e) {
          console.error("Confirm failed", e);
      }
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden text-white">
      {triviaState?.status === "active" && !isOrganizer && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-white p-6">
            <div className="text-center">
                <h2 className="text-3xl font-bold mb-4">{t('trivia')}</h2>
                <p>{t('gameInProgress')}</p>
                <div className="mt-4 h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white mx-auto" />
            </div>
         </div>
      )}

      {/* Loading Screen */}
      {viewMode === 'loading' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-gradient-to-br from-purple-700 to-pink-600">
          <div className="flex flex-col items-center text-white">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            <div className="mt-3 text-sm opacity-90">{t('personalizing')}</div>
          </div>
        </div>
      )}

      {/* Playing Screen (Engine) */}
      {viewMode === 'playing' && (
          <div ref={containerRef} className="absolute inset-0 z-10" />
      )}

      {/* Final Screen */}
      {viewMode === 'final' && triviaState?.status !== "active" && (
         <div className="fixed inset-0 z-40 flex items-center justify-center text-center p-6 bg-gradient-to-b from-slate-900 to-black">
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
                <div className="max-w-md w-full">
                    <h2 className="text-3xl font-bold mb-4">
                        {t('youreIn')}
                    </h2>
                    <p className="mb-6 opacity-90">
                        {t('cantWait')}
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
                    
                    <div className="mt-8 flex flex-col items-center gap-3">
                        <button 
                            onClick={() => { setViewMode('playing'); }} 
                            className="rounded-full bg-white text-black px-6 py-3 font-bold hover:opacity-90 transition-opacity w-full"
                        >
                            {t('replay')}
                        </button>
                        
                        {!isConfirmed ? (
                            <button 
                                onClick={confirmAssistance}
                                disabled={confirmAssistanceMut.isPending}
                                className="rounded-full bg-green-500 px-6 py-3 font-bold text-white shadow-lg hover:bg-green-600 transition-all disabled:opacity-50 w-full"
                            >
                                {confirmAssistanceMut.isPending ? "..." : t('confirmAssistance')}
                            </button>
                        ) : (
                            <div className="rounded-full bg-green-500/20 border border-green-500/50 px-4 py-2 text-sm font-semibold text-green-200 w-full">
                                {t('assistanceConfirmed')}
                            </div>
                        )}
                    </div>
                </div>
            )}
         </div>
      )}
      
      {/* Organizer Tools Overlay */}
      {isOrganizer && (
        <div className="fixed top-4 right-4 z-50">
             <button className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90" onClick={() => setToolsOpen(true)}>{t('organizer')}</button>
        </div>
      )}

      {toolsOpen && isOrganizer && (
        <div className="fixed inset-0 z-50">
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
