type Invitation = {
  id?: string;
  slug: string;
  title: string;
  theme: string;
  description?: string | null;
  eventAt: Date;
  location: string;
  lat?: number;
  lng?: number;
  items: string[];
  rafflePrize?: string | null;
  assets: { images: Array<{ name: string; source: string; mimeType: string }>; videos: Array<{ name: string; source: string; mimeType: string }>; audios: Array<{ name: string; source: string; mimeType: string }> };
  createdAt?: Date;
};

const memory = {
  invitations: [] as Invitation[],
  invitees: {} as Record<string, Array<{ identifier: string; name?: string; age?: number; imageUrl?: string; isOrganizer?: boolean }>>,
};

export const store = {
  saveInvitation(inv: Invitation) {
    memory.invitations.push(inv);
    return inv;
  },
  listInvitations() {
    return memory.invitations;
  },
  getBySlug(slug: string) {
    return memory.invitations.find((i) => i.slug === slug);
  },
  addInvitees(slug: string, arr: Array<{ identifier: string; name?: string; age?: number; imageUrl?: string; isOrganizer?: boolean }>) {
    if (!memory.invitees[slug]) memory.invitees[slug] = [];
    memory.invitees[slug].push(...arr);
  },
  listInvitees(slug: string) {
    return memory.invitees[slug] ?? [];
  },
};