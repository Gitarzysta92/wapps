import { computed, Injectable, inject } from '@angular/core';
import { defer, map } from 'rxjs';
import { permitsContent } from '@domains/publication/classification';
import {
  PublicContentPreferencesService,
  PublicContentReadError,
  requireContentChoice,
} from '@portals/shared/features/preferences';
import { APPLICATION_OVERVIEW_PROVIDER } from './overview-providers.port';
import { LOCAL_APPLICATION_DATA } from './application-data-mode.token';

@Injectable({ providedIn: 'root' })
export class ApplicationOverviewService {
  private readonly provider = inject(APPLICATION_OVERVIEW_PROVIDER);
  private readonly preferences = inject(LOCAL_APPLICATION_DATA)
    ? null
    : inject(PublicContentPreferencesService);
  readonly contentChoice = computed(() => this.preferences?.state() ?? null);

  retryPreferences() {
    this.preferences?.reload();
  }

  getOverview(slug: string) {
    return defer(() => {
      const choice = this.contentChoice();
      const showMatureContent = requireContentChoice(choice);
      return this.provider.getOverview(slug).pipe(
        map((result) => {
          if (!result.ok) throw result.error;
          if (choice !== this.contentChoice())
            throw new PublicContentReadError('loading');
          if (!permitsContent(result.value, showMatureContent))
            throw new PublicContentReadError('hidden');
          return result.value;
        })
      );
    });
  }
}
