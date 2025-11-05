import { SocialOptionDto } from "@domains/catalog/references";
import { generateSlug } from "@domains/catalog/record";

// Based on social-api.service.ts data
const SOCIAL_DATA = [
  { id: 0, name: "Facebook" },
  { id: 1, name: "X" },
  { id: 2, name: "Reddit" },
  { id: 3, name: "Discord" },
  { id: 4, name: "LinkedIn" },
  { id: 5, name: "Medium" }
];

export const SOCIAL_OPTIONS: SocialOptionDto[] = SOCIAL_DATA.map(s => ({
  id: s.id,
  name: s.name,
  slug: generateSlug(s.name)
}));

