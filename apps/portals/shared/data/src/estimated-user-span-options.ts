import { EstimatedUserSpanOptionDto } from "@domains/catalog/metrics";
import { generateSlug } from "@domains/catalog/record";

// Based on estimated-user-span-api.service.ts data
const ESTIMATED_USER_SPAN_DATA = [
  { id: 0, name: "0-1000" },
  { id: 1, name: "1000-10000" },
  { id: 2, name: "10000-100000" },
  { id: 3, name: "100000-1000000" },
  { id: 4, name: "1000000+" }
];

export const ESTIMATED_USER_SPAN_OPTIONS: EstimatedUserSpanOptionDto[] = ESTIMATED_USER_SPAN_DATA.map(e => ({
  id: e.id,
  name: e.name,
  slug: generateSlug(e.name)
}));

