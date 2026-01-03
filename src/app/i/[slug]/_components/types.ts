export type Invitation = {
  slug: string;
  title: string;
  theme: string;
  description: string | null;
  eventAt: string | Date;
  location: string;
  lat?: number;
  lng?: number;
  items: string[];
  rafflePrize?: string | null;
  assets: { 
    images: Array<{ name: string; source: string; mimeType?: string }>; 
    videos: Array<{ name: string; source: string; mimeType?: string }>; 
    audios: Array<{ name: string; source: string; mimeType?: string }> 
  };
};

// Helper to normalize the weird nested schema if the AI hallucinates the definition wrapper
export function normalizeExperience(exp: any) {
  if (!exp) return null;
  // Case 1: Direct structure
  if (exp.screens && Array.isArray(exp.screens)) return exp;
  // Case 2: Nested in definitions (Schema hallucination)
  if (exp.experience?.definitions?.ExperienceSchema) {
    return exp.experience.definitions.ExperienceSchema;
  }
  if (exp.definitions?.ExperienceSchema) {
    return exp.definitions.ExperienceSchema;
  }
  // Case 3: Wrapped in "experience" key again
  if (exp.experience?.screens) {
    return exp.experience;
  }
  return exp;
}
