"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSubmitTriviaAnswer } from "@/hooks/use-birthude-api";

export function TriviaParticipantView({ game, slug, identifier }: { game: any; slug: string; identifier: string }) {
    const t = useTranslations("viewer");
    const [answer, setAnswer] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const renderTime = useRef(Date.now());
    const [currentQId, setCurrentQId] = useState("");
    
    const submitMut = useSubmitTriviaAnswer(slug);

    useEffect(() => {
        if (game.question?.id !== currentQId) {
            console.log("[TriviaParticipant] New question received", game.question?.id);
            setCurrentQId(game.question?.id || "");
            setSubmitted(false);
            setAnswer("");
            renderTime.current = Date.now();
        }
    }, [game.question, currentQId]);

    async function submit() {
        if (!answer.trim()) return;
        const timeTaken = (Date.now() - renderTime.current) / 1000;
        console.log("[TriviaParticipant] Submitting answer", { answer, timeTaken });
        try {
            await submitMut.mutateAsync({ 
                questionId: game.question.id, 
                inviteeIdentifier: identifier, 
                content: answer,
                timeTaken
            });
            setSubmitted(true);
        } catch (e) {
            console.error("[TriviaParticipant] Submit failed", e);
        }
    }

    if (!game.question) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-white p-6">
                <div className="text-center">
                    <h2 className="text-3xl font-bold mb-4">{t('trivia')}</h2>
                    <p className="animate-pulse">{t('waitingForQuestion')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-white p-6">
            <div className="w-full max-w-md">
                <h2 className="text-3xl font-bold mb-8 text-center">{t('trivia')}</h2>
                <div className="bg-white/10 p-6 rounded-2xl mb-6">
                    <p className="text-xl font-medium">{game.question.content}</p>
                </div>
                
                {!submitted ? (
                    <div className="flex flex-col gap-4">
                        <textarea 
                            className="w-full bg-white/5 border border-white/20 rounded-xl p-4 text-white" 
                            rows={3}
                            placeholder={t('typeAnswer')}
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                        />
                        <button onClick={submit} disabled={submitMut.isPending} className="bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-xl font-bold shadow-lg">
                            {submitMut.isPending ? "..." : t('submitAnswer')}
                        </button>
                    </div>
                ) : (
                     <div className="text-center opacity-70">
                         <div className="text-4xl mb-2">✅</div>
                         {t('waitingForQuestion')}
                     </div>
                )}
            </div>
        </div>
    );
}
