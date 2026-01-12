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

export const ESTIMATED_USER_SPAN_OPTIONS: EstimatedUserSpanOptionDto[] = ESTIMATED_USER_SPAN_DATA.map((e): EstimatedUserSpanOptionDto => {
  // Parse name like "0-1000" or "1000000+" to extract from/to values
  const parseRange = (name: string): { from: number; to: number } => {
    if (name.endsWith('+')) {
      const from = parseInt(name.replace('+', '').replace(/,/g, ''), 10);
      return { from, to: Number.MAX_SAFE_INTEGER };
    }
    const [fromStr, toStr] = name.split('-');
    return {
      from: parseInt(fromStr.replace(/,/g, ''), 10),
      to: parseInt(toStr.replace(/,/g, ''), 10)
    };
  };
  
  const { from, to } = parseRange(e.name);
  
  return {
    id: e.id,
    name: e.name,
    slug: generateSlug(e.name),
    from,
    to
  };
});

