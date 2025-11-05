import { CategoryOptionDto } from "@domains/catalog/category";
import { CATEGORIES } from "./categories";

export const CATEGORY_OPTIONS: CategoryOptionDto[] = CATEGORIES.map(c => ({
  id: c.id,
  name: c.name,
  slug: c.slug
}));

