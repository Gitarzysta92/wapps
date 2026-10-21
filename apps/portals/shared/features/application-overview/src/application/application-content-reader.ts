import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { PublicContentReadError } from '@portals/shared/features/preferences';
import { ApplicationOverviewService } from './application-overview.service';
import type { OverviewDto } from './overview.dto';

export type ApplicationContentStatus =
  | 'preferences-loading'
  | 'preferences-unavailable'
  | 'loading'
  | 'hidden'
  | 'missing'
  | 'unavailable'
  | 'ready';

/** Create once in the host's injection context; each host owns its request. */
export function readApplicationContent(slug: () => string) {
  const overview = inject(ApplicationOverviewService);
  const request = computed(() => ({
    slug: slug(),
    choice: overview.contentChoice(),
  }));
  const resource = rxResource({
    request,
    loader: ({ request }) => {
      const result = (
        application: OverviewDto | null,
        error: unknown = null
      ) => ({
        request,
        application,
        error,
      });
      if (!request.slug) return of(result(null));
      return overview.getOverview(request.slug).pipe(
        map((application) => result(application)),
        catchError((error: unknown) => of(result(null, error)))
      );
    },
  });
  // A resource may retain its previous value until its effect runs. Bind every
  // visible value to the exact route and preference choice that produced it.
  const current = computed(() => {
    const value = resource.value();
    return !resource.isLoading() && value?.request === request() ? value : null;
  });
  const status = computed((): ApplicationContentStatus => {
    const selected = request();
    if (selected.choice?.status === 'loading') return 'preferences-loading';
    if (selected.choice?.status === 'unavailable')
      return 'preferences-unavailable';
    if (!selected.slug) return 'missing';
    const value = current();
    if (!value) return 'loading';
    if (value.application) return 'ready';
    if (value.error instanceof PublicContentReadError) {
      if (value.error.reason === 'hidden') return 'hidden';
      return value.error.reason === 'preferences'
        ? 'preferences-unavailable'
        : 'preferences-loading';
    }
    if (
      typeof value.error === 'object' &&
      value.error !== null &&
      'status' in value.error &&
      value.error.status === 404
    )
      return 'missing';
    return 'unavailable';
  });
  return {
    status,
    application: computed(() =>
      status() === 'ready' ? current()?.application ?? null : null
    ),
    isLoading: computed(
      () => status() === 'loading' || status() === 'preferences-loading'
    ),
    reload: () => {
      if (status() === 'preferences-unavailable') overview.retryPreferences();
      else resource.reload();
    },
  };
}

export type ApplicationContentReader = ReturnType<
  typeof readApplicationContent
>;
