import { computed, Injectable, inject } from '@angular/core';
import { defer, map } from 'rxjs';
import { permitsContent } from '@domains/publication/classification';
import {
  PublicContentPreferencesService,
  PublicContentReadError,
  requireContentChoice,
} from '@portals/shared/features/preferences';
import { CATALOG_BROWSER } from './catalog-browser.port';
import { CatalogQuery } from './catalog-listing';
import { CatalogDirectoryKind } from './catalog-directory';

@Injectable()
export class CatalogBrowserService {
  private readonly provider = inject(CATALOG_BROWSER);
  readonly mode = this.provider.mode;
  readonly kinds = this.provider.kinds;
  private readonly preferences =
    this.mode === 'api' ? inject(PublicContentPreferencesService) : null;
  readonly contentChoice = computed(() => this.preferences?.state() ?? null);

  retryPreferences() {
    this.preferences?.reload();
  }

  browse(query: CatalogQuery) {
    return defer(() => {
      const choice = this.contentChoice();
      const showMatureContent = requireContentChoice(choice);
      return this.provider.browse(query).pipe(
        map((result) => {
          if (!result.ok) throw result.error;
          if (choice !== this.contentChoice())
            throw new PublicContentReadError('loading');
          const items = result.value.items.filter((item) =>
            permitsContent(item, showMatureContent)
          );
          return {
            ...result.value,
            items,
            hiddenCount: result.value.items.length - items.length,
          };
        })
      );
    });
  }

  directory(kind: CatalogDirectoryKind) {
    return this.provider.directory(kind).pipe(
      map((result) => {
        if (!result.ok) throw result.error;
        return result.value;
      })
    );
  }
}
