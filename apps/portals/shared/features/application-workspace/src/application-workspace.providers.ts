import { inject, type ApplicationConfig } from '@angular/core';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  APPLICATION_DRAFTS,
  APPLICATION_WORKSPACE_ORIGIN,
  APPLICATION_WORKSPACE_SESSION,
  type ApplicationWorkspaceSession,
} from './application/application-drafts.port';
import { LazyApplicationDraftsApiService } from './infrastructure/lazy-application-drafts-api.service';
import { LazyApplicationPublicationApiService } from './infrastructure/lazy-application-publication-api.service';
import { APPLICATION_PUBLICATION } from './application/application-publication.port';
import {
  RELEASE_WORKSPACE,
  RELEASE_CATALOG,
} from './application/release-workspace.port';
import { LazyReleaseApiService } from './infrastructure/lazy-release-api.service';
import {
  APPLICATION_OWNERSHIP,
  APPLICATION_EDITING,
} from './application/application-ownership.port';
import { LazyApplicationOwnershipApiService } from './infrastructure/lazy-application-ownership-api.service';
import { LazyApplicationMediaApiService } from './infrastructure/lazy-application-media-api.service';
import {
  APPLICATION_MEDIA,
  APPLICATION_MEDIA_RECOVERY,
} from './application/application-media.port';

export function provideApplicationWorkspace(config: {
  mode: 'api' | 'demo';
  apiBaseUrl: string;
}): ApplicationConfig {
  if (
    !['api', 'demo'].includes(config.mode) ||
    typeof config.apiBaseUrl !== 'string'
  )
    throw new Error(
      'Explicit application workspace mode and origin are required'
    );
  if (config.apiBaseUrl) {
    const url = new URL(config.apiBaseUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid application workspace origin');
  }
  if (config.mode === 'demo') return { providers: [] };
  return {
    providers: [
      LazyReleaseApiService,
      { provide: RELEASE_WORKSPACE, useExisting: LazyReleaseApiService },
      { provide: RELEASE_CATALOG, useExisting: LazyReleaseApiService },
      LazyApplicationMediaApiService,
      {
        provide: APPLICATION_MEDIA,
        useExisting: LazyApplicationMediaApiService,
      },
      {
        provide: APPLICATION_MEDIA_RECOVERY,
        useExisting: LazyApplicationMediaApiService,
      },
      LazyApplicationOwnershipApiService,
      {
        provide: APPLICATION_OWNERSHIP,
        useExisting: LazyApplicationOwnershipApiService,
      },
      {
        provide: APPLICATION_EDITING,
        useExisting: LazyApplicationOwnershipApiService,
      },
      LazyApplicationPublicationApiService,
      {
        provide: APPLICATION_PUBLICATION,
        useExisting: LazyApplicationPublicationApiService,
      },
      LazyApplicationDraftsApiService,
      {
        provide: APPLICATION_DRAFTS,
        useExisting: LazyApplicationDraftsApiService,
      },
      {
        provide: APPLICATION_WORKSPACE_ORIGIN,
        useValue: config.apiBaseUrl.replace(/\/$/, ''),
      },
      {
        provide: APPLICATION_WORKSPACE_SESSION,
        useFactory: (): ApplicationWorkspaceSession => {
          const session = inject(AUTHENTICATION_SESSION);
          return { key$: session.token$, currentKey: () => session.getToken() };
        },
      },
    ],
  };
}
