import { Injectable, inject } from '@angular/core';
import { defer, of } from 'rxjs';
import {
  CatalogBrowserPort,
  DEMO_CATALOG_ENTRIES,
} from '../application/catalog-browser.port';
import {
  browseCatalog,
  CatalogQuery,
  catalogFacets,
} from '../application/catalog-listing';
import {
  CatalogDirectoryKind,
  catalogDirectory,
} from '../application/catalog-directory';

@Injectable()
export class CatalogBrowseDemoService implements CatalogBrowserPort {
  private readonly entries = inject(DEMO_CATALOG_ENTRIES);
  readonly mode = 'demo' as const;
  readonly kinds = ['applications', 'articles', 'suites'] as const;

  browse(query: CatalogQuery) {
    return defer(() => {
      const entries = this.entries();
      const scoped = entries.filter(
        (entry) => !query.kind || entry.kind === query.kind
      );
      const apps = entries.filter((entry) => entry.kind === 'applications');
      return of({
        ok: true as const,
        value: {
          ...browseCatalog(query, entries),
          facets: {
            categories: catalogFacets(scoped, 'categories'),
            tags: catalogFacets(scoped, 'tags'),
            platforms: catalogFacets(apps, 'platforms'),
            devices: catalogFacets(apps, 'devices'),
            monetizations: catalogFacets(apps, 'monetizations'),
          },
        },
      });
    });
  }

  directory(kind: CatalogDirectoryKind) {
    return of({ ok: true as const, value: catalogDirectory(kind) });
  }
}
