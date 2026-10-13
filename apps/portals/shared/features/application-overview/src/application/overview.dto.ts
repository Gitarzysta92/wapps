import { CatalogApp, CatalogFacet } from '@domains/catalog/record';
import type { ClassifiedContent } from '@domains/publication/classification';

export interface OverviewSuite {
  slug: string;
  name: string;
  image?: string;
  author?: string;
  members: { slug: string; name: string }[];
}

/** Resolved feature data; pages never join backend IDs to bundled taxonomy. */
export interface OverviewDto extends ClassifiedContent {
  id: string;
  revision: number | null;
  slug: string;
  name: string;
  description: string | null;
  website: string | null;
  logo: string | null;
  banner: string | null;
  isPwa: boolean;
  listingDate: string | null;
  updateDate: string | null;
  platforms: Pick<CatalogFacet, 'name' | 'slug'>[];
  monetizations: Pick<CatalogFacet, 'name' | 'slug'>[];
  categories: Pick<CatalogFacet, 'name' | 'slug'>[];
  tags: Pick<CatalogFacet, 'name' | 'slug'>[];
  estimatedUsers: number | null;
  reviews: CatalogApp['reviews'];
  includedSuites: OverviewSuite[] | null;
}
