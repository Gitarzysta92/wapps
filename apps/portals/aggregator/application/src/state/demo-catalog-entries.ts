import { inject } from '@angular/core';
import {
  CATALOG_ENTRIES,
  CatalogEntry,
  normalizeCatalogFacet,
} from '@portals/shared/features/listing';
import { EntryDetailsDataService } from '../pages/entry-details-page/entry-details-data.service';

export function demoCatalogEntries(): () => readonly CatalogEntry[] {
  const details = inject(EntryDetailsDataService);
  return () => [
    ...CATALOG_ENTRIES.filter((entry) => entry.kind !== 'suites'),
    ...details.listSuites().map((suite) => {
      const fixture = CATALOG_ENTRIES.find(
        (entry) => entry.kind === 'suites' && entry.slug === suite.slug
      );
      return {
        ...fixture,
        kind: 'suites' as const,
        slug: suite.slug,
        name: suite.title,
        description:
          suite.description ||
          fixture?.description ||
          suite.apps.map((app) => app.name).join(', '),
        author: suite.author ?? fixture?.author,
        categories: fixture?.categories.length
          ? fixture.categories
          : [
              {
                name: suite.category,
                slug: normalizeCatalogFacet(suite.category),
              },
            ],
        tags: fixture?.tags ?? [],
        applications: suite.apps.map((app) => ({
          name: app.name,
          slug: app.slug ?? '',
        })),
      };
    }),
  ];
}
