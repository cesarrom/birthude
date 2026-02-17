import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Types (simplified for now, can be expanded)
type InvitationPayload = any;
type CreatorResponse = { message: string; input: any; step: string | null };
type GeoResult = { place_id: number; formatted: string; lat: string; lon: string };
type UploadResponse = { fileUrl: string };

async function fetcher(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "An error occurred");
  }
  return res.json();
}

// --- Creator Flow Hooks ---

export function useCreatorChat() {
  return useMutation({
    mutationFn: (body: { stepId: string | null; answers: any }) =>
      fetcher("/api/creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }) as Promise<CreatorResponse>
  });
}

export function useCreateInvitation() {
  return useMutation({
    mutationFn: (payload: InvitationPayload) => {
      return fetcher("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
    }
  });
}

export function useGenerateInvitation() {
  return useMutation({
    mutationFn: (slug: string) => {

      const lang = new URLSearchParams(window.location.search).get("lang");
      const url = `/api/invitations/${slug}/generate${lang ? `?lang=${lang}` : ""}`;
      return fetcher(url, { method: "POST" });
    }
  });
}

export function useEnhanceText() {
  return useMutation({
    mutationFn: (body: { field: string; text: string; context: any }) =>
      fetcher("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
  });
}

export function useListify() {
  return useMutation({
    mutationFn: (body: { text: string; context: any }) =>
      fetcher("/api/listify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
  });
}



export function useUploadFile() {
  return useMutation({
    mutationFn: (body: { data: string; mimeType: string; name: string }) =>
      fetcher("/api/upload/bytescale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }) as Promise<UploadResponse>
  });
}

export function useGeoAutocomplete(query: string) {
  return useQuery({
    queryKey: ["geo", "autocomplete", query],
    queryFn: () => fetcher(`/api/geo/autocomplete?text=${encodeURIComponent(query)}`),
    enabled: !!query.trim(),
    staleTime: 1000 * 60 * 60 // 1 hour
  });
}

export function useGeoReverse(lat: number, lng: number) {
  return useQuery({
    queryKey: ["geo", "reverse", lat, lng],
    queryFn: () => fetcher(`/api/geo/reverse?lat=${lat}&lng=${lng}`),
    enabled: !!lat && !!lng,
    staleTime: 1000 * 60 * 60
  });
}

// --- Viewer / Invitee Hooks ---

export function useExperience(slug: string, identifier: string) {
  return useQuery({
    queryKey: ["experience", slug, identifier],
    queryFn: () => {
      const lang = new URLSearchParams(window.location.search).get("lang");
      const url = `/api/invitations/${slug}/invitees/${identifier}/experience${lang ? `?lang=${lang}` : ""}`;
      return fetcher(url);
    },
    enabled: !!slug && !!identifier,
    retry: false
  });
}

export function useCreateExperience() {
  return useMutation({
    mutationFn: ({ slug, identifier }: { slug: string, identifier: string }) => {
      const lang = new URLSearchParams(window.location.search).get("lang");
      const url = `/api/invitations/${slug}/invitees/${identifier}/experience${lang ? `?lang=${lang}` : ""}`;
      return fetcher(url)
    }
  });
}

export function useInvitees(slug: string) {
  return useQuery({
    queryKey: ["invitees", slug],
    queryFn: () => fetcher(`/api/invitations/${slug}/invitees`),
    enabled: !!slug
  });
}

export function useAddInvitee(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetcher(`/api/invitations/${slug}/invitees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees", slug] });
    }
  });
}

export function useAssignItem(slug: string, identifier: string) {
  return useMutation({
    mutationFn: () =>
      fetcher(`/api/invitations/${slug}/invitees/${identifier}/assign-item`, { method: "POST" })
  });
}

export function useMarkSeen(slug: string, identifier: string) {
  return useMutation({
    mutationFn: () =>
      fetcher(`/api/invitations/${slug}/invitees/${identifier}/seen`, { method: "POST" })
  });
}

export function useMarkSeenRaffle(slug: string, identifier: string) {
  return useMutation({
    mutationFn: () =>
      fetcher(`/api/invitations/${slug}/invitees/${identifier}/seen-raffle`, { method: "POST" })
  });
}

export function useDrawRaffleWinner(slug: string) {
  return useMutation({
    mutationFn: () =>
      fetcher(`/api/invitations/${slug}/raffle/draw`, { method: "POST" })
  });
}

export function useRevealInvitee(slug: string) {
  return useMutation({
    mutationFn: async (identifier: string) => {
      const idNorm = identifier.trim().toLowerCase();
      let exData;
      const lang = new URLSearchParams(window.location.search).get("lang");
      const query = `?vw=${window.innerWidth}&vh=${window.innerHeight}${lang ? `&lang=${lang}` : ""}`;

      // 1. Try to fetch existing experience
      try {
        exData = await fetcher(`/api/invitations/${slug}/invitees/${identifier.trim()}/experience${query}`);
      } catch (e) {
        // If 404, we create
        try {
          exData = await fetcher(`/api/invitations/${slug}/invitees/${identifier.trim()}/experience${query}`, { method: "POST" });
        } catch (createErr) {
          throw createErr;
        }
      }

      if (!exData) throw new Error("Could not retrieve or create experience");

      // 2. Fetch metadata (isOrganizer, hasSeen)
      let isOrganizer = false;
      let hasSeen = false;
      let isConfirmed = false;
      try {
        const invData = await fetcher(`/api/invitations/${slug}/invitees`);
        const me = (invData.invitees || []).find((x: any) => x.identifier?.toLowerCase() === idNorm);
        if (me) {
          isOrganizer = !!me.isOrganizer;
          hasSeen = !!me.hasSeen;
          isConfirmed = !!me.isConfirmed;
        }
      } catch { }

      // 3. Assign Item
      let assignedItem = null;
      try {
        const assignRes = await fetcher(`/api/invitations/${slug}/invitees/${identifier.trim()}/assign-item`, { method: "POST" });
        if (assignRes) assignedItem = assignRes.assignedItem;
      } catch { }

      return {
        experience: exData.experience,
        raffle: exData.raffle,
        isOrganizer,
        hasSeen,
        assignedItem,
        identifier: identifier.trim(),
        isConfirmed
      };
    }
  });
}

export function useConfirmAssistance(slug: string, identifier: string) {
  return useMutation({
    mutationFn: () =>
      fetcher(`/api/invitations/${slug}/invitees/${identifier}/confirm`, { method: "POST" })
  });
}

// --- Trivia Hooks ---

export function useTriviaState(slug: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["trivia", slug],
    queryFn: () => fetcher(`/api/invitations/${slug}/trivia/state`),
    enabled: !!slug && enabled,
    refetchInterval: 3000
  });
}

export function useStartTrivia(slug: string) {
  return useMutation({
    mutationFn: () => fetcher(`/api/invitations/${slug}/trivia/start`, { method: "POST" })
  });
}

export function usePostTriviaQuestion(slug: string) {
  return useMutation({
    mutationFn: (content: string) =>
      fetcher(`/api/invitations/${slug}/trivia/question`, {
        method: "POST",
        body: JSON.stringify({ content })
      })
  });
}

export function useSubmitTriviaAnswer(slug: string) {
  return useMutation({
    mutationFn: (body: { questionId: string; inviteeIdentifier: string; content: string; timeTaken: number }) =>
      fetcher(`/api/invitations/${slug}/trivia/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
  });
}

export function usePickTriviaWinner(slug: string) {
  return useMutation({
    mutationFn: (answerId: string) =>
      fetcher(`/api/invitations/${slug}/trivia/pick-winner`, {
        method: "POST",
        body: JSON.stringify({ answerId })
      })
  });
}

export function useEndTrivia(slug: string) {
  return useMutation({
    mutationFn: () => fetcher(`/api/invitations/${slug}/trivia/end`, { method: "POST" })
  });
}
