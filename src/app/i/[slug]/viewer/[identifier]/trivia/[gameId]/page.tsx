"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTriviaState, useInvitees } from "@/hooks/use-birthude-api";
import { TriviaParticipantView } from "../../../../_components/trivia-participant-view";
import { TriviaOrganizerView } from "../../../../_components/trivia-organizer-view";

export default function TriviaPage({ params }: { params: Promise<{ slug: string; identifier: string; gameId: string }> }) {
  const [slug, setSlug] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [gameId, setGameId] = useState("");
  const [isOrganizer, setIsOrganizer] = useState(false);
  const router = useRouter();

  useEffect(() => {
    params.then(p => {
        setSlug(p.slug);
        setIdentifier(decodeURIComponent(p.identifier));
        setGameId(p.gameId);
    });
  }, [params]);

  const { data: triviaState } = useTriviaState(slug, !!identifier);
  const { data: inviteesData } = useInvitees(slug);

  useEffect(() => {
    if (inviteesData?.invitees && identifier) {
        const me = inviteesData.invitees.find((x: any) => x.identifier.toLowerCase() === identifier.toLowerCase());
        if (me?.isOrganizer) setIsOrganizer(true);
    }
  }, [inviteesData, identifier]);

  useEffect(() => {
      // If game ends or becomes inactive, redirect back to viewer
      if (triviaState && triviaState.status !== "active") {
          router.replace(`/i/${slug}/viewer/${encodeURIComponent(identifier)}`);
      }
  }, [triviaState, slug, identifier, router]);

  if (!identifier || !slug || !triviaState) return <div className="flex h-screen items-center justify-center text-white bg-black">Loading...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-4">
      {isOrganizer ? (
        <TriviaOrganizerView slug={slug} game={triviaState} onClose={() => router.replace(`/i/${slug}/viewer/${encodeURIComponent(identifier)}`)} />
      ) : (
        <TriviaParticipantView game={triviaState} slug={slug} identifier={identifier} />
      )}
    </div>
  );
}
