import { MonetizationOptionDto } from "@domains/catalog/pricing";
import { MONETIZATIONS } from "./monetizations";
import { generateSlug } from "@domains/catalog/record";

export const MONETIZATION_OPTIONS: MonetizationOptionDto[] = MONETIZATIONS.map(m => ({
  id: m.id,
  name: m.name,
  slug: generateSlug(m.name)
}));

