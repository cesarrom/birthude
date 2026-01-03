"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { usePostTriviaQuestion, usePickTriviaWinner, useEndTrivia } from "@/hooks/use-birthude-api";

export function TriviaOrganizerView({ slug, game, onClose }: { slug: string; game: any; onClose: () => void }) {
    const t = useTranslations("viewer");
    const [question, setQuestion] = useState("");
    const [loading, setLoading] = useState(false);
    
    const postQ = usePostTriviaQuestion(slug);
    const pickW = usePickTriviaWinner(slug);
    const endG = useEndTrivia(slug);
    const queryClient = useQueryClient();

    async function postQuestion() {
        if (!question.trim()) return;
        setLoading(true);
        console.log("[TriviaOrganizer] Posting question", question);
        try {
            await postQ.mutateAsync(question);
            setQuestion("");
            // Invalidate to see new question state immediately
            queryClient.invalidateQueries({ queryKey: ["trivia", slug] });
        } catch (e) {
            console.error("[TriviaOrganizer] Post failed", e);
        }
        setLoading(false);
    }

    async function pickWinner(answerId: string) {
        if (!confirm(t('pickWinner') + "?")) return;
        console.log("[TriviaOrganizer] Picking winner", answerId);
        try {
            await pickW.mutateAsync(answerId);
            queryClient.invalidateQueries({ queryKey: ["trivia", slug] });
        } catch (e) {
            console.error("[TriviaOrganizer] Pick winner failed", e);
        }
    }

    async function endGame() {
        if (!confirm(t('endTrivia') + "?")) return;
        console.log("[TriviaOrganizer] Ending game");
        try {
            const data: any = await endG.mutateAsync();
            if (data.winnerId) alert("Game Over! Winner ID: " + data.winnerId);
            else alert("Game Over!");
            onClose();
        } catch (e) {
            console.error("[TriviaOrganizer] End game failed", e);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">{t('trivia')}</h3>
                <button onClick={endGame} className="text-red-400 text-sm">{t('endTrivia')}</button>
            </div>

            <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl">
                <h4 className="font-semibold mb-2">{t('postQuestion')}</h4>
                <div className="flex gap-2">
                    <input 
                        className="flex-1 border rounded-lg px-3 py-2" 
                        placeholder={t('typeQuestion')} 
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                    />
                    <button onClick={postQuestion} disabled={loading || postQ.isPending} className="bg-black text-white px-4 py-2 rounded-lg">{t('postQuestion')}</button>
                </div>
            </div>

            {game.question && (
                <div>
                    <div className="mb-2 opacity-70">{t('answers')} for: "{game.question.content}"</div>
                    <div className="flex flex-col gap-2">
                        {game.answers?.map((ans: any) => (
                            <div key={ans.id} className="bg-white dark:bg-zinc-700 p-3 rounded-lg flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="font-medium">{ans.content}</div>
                                    <div className="text-xs opacity-50">{t('anon')} - {ans.timeTaken.toFixed(2)}{t('seconds')}</div>
                                </div>
                                {!ans.isWinner && (
                                    <button onClick={() => pickWinner(ans.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm">
                                        {t('pickWinner')}
                                    </button>
                                )}
                                {ans.isWinner && <span className="text-green-500 font-bold">★</span>}
                            </div>
                        ))}
                        {(!game.answers || game.answers.length === 0) && <div className="text-sm opacity-50 italic">No answers yet</div>}
                    </div>
                </div>
            )}
        </div>
    );
}
