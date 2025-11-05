import { TagOptionDto } from "@domains/catalog/tags";
import { TAGS } from "./tags";

export const TAG_OPTIONS: TagOptionDto[] = TAGS.map(t => ({
  id: t.id,
  name: t.name,
  slug: t.slug
}));

