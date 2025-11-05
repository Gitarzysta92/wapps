import { PlatformOptionDto } from "@domains/catalog/compatibility";
import { PLATFORMS } from "./platforms";
import { generateSlug } from "@domains/catalog/record";

export const PLATFORM_OPTIONS: PlatformOptionDto[] = PLATFORMS.map(p => ({
  id: p.id,
  name: p.name,
  slug: generateSlug(p.name)
}));

