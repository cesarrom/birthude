"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useInvitees } from "@/hooks/use-birthude-api";

export function RaffleRoulette({ invitees, winnerIdentifier, prize, onComplete, slug }: { invitees: any[]; winnerIdentifier: string; prize?: string | null; onComplete: () => void; slug: string }) {
    const t = useTranslations("viewer");
    const [candidates, setCandidates] = useState<string[]>([]);
    const [current, setCurrent] = useState("");
    const [phase, setPhase] = useState<"loading" | "spinning" | "won">("loading");
    
    // We can use the passed invitees prop if available, but parent passes empty list currently.
    // So we need to fetch them.
    const { data: inviteesData } = useInvitees(slug);
    
    useEffect(() => {
        if (inviteesData?.invitees) {
            console.log("[Raffle] Loaded invitees", inviteesData.invitees.length);
            const list = (inviteesData.invitees || []).map((x: any) => x.name || x.identifier);
            setCandidates(list);
            setPhase("spinning");
        }
    }, [inviteesData]);

    useEffect(() => {
        if (phase !== "spinning" || candidates.length === 0) return;
        
        let speed = 50;
        let timeout: any;
        let steps = 0;
        const maxSteps = 40; // Spin for a bit
        
        function spin() {
            const rand = candidates[Math.floor(Math.random() * candidates.length)];
            setCurrent(rand);
            steps++;
            
            if (steps > maxSteps && rand === winnerIdentifier) {
                setPhase("won");
                console.log("[Raffle] Winner selected!", winnerIdentifier);
                setTimeout(onComplete, 4000); // Show winner for 4s then complete
                return;
            }
            
            if (steps > maxSteps) {
                // Force winner eventually if random didn't hit
                if (Math.random() > 0.8) {
                     setCurrent(winnerIdentifier);
                     setPhase("won");
                     console.log("[Raffle] Winner forced!", winnerIdentifier);
                     setTimeout(onComplete, 4000);
                     return;
                }
            }
            
            // Decelerate
            if (steps > maxSteps - 10) speed += 30;
            
            timeout = setTimeout(spin, speed);
        }
        
        spin();
        return () => clearTimeout(timeout);
    }, [phase, candidates, winnerIdentifier, onComplete]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl">
            <div className="text-center">
                <div className="text-4xl font-black text-white mb-8 tracking-tighter uppercase">{t('raffle')}</div>
                <div className="relative h-32 w-full overflow-hidden">
                    <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 scale-110 transition-all">
                        {phase === "won" ? winnerIdentifier : current}
                    </div>
                </div>
                {phase === "won" && (
                     <div className="mt-8 animate-bounce text-2xl text-white">
                         {t('congrats')}
                     </div>
                )}
                {prize && <div className="mt-4 text-white/50">{t('winnerAnnouncement', {prize})}</div>}
            </div>
        </div>
    );
}
