import { ApplicationConfig, Provider } from '@angular/core';
import { OverviewLocalService } from './infrastructure/overview-local.service';
import { LOCAL_APPLICATION_DATA } from './application/application-data-mode.token';
import {
  LOCAL_DISCUSSION_DRAFTS,
  disabledLocalDiscussionDrafts,
} from './application/local-discussion-drafts.port';
import { LocalDiscussionsService } from './infrastructure/local-discussions.service';
import { OverviewBffApiService } from './infrastructure/overview-bff-api.service';
import { APPLICATION_OVERVIEW_PROVIDER } from './application/overview-providers.port';
import { OVERVIEW_API_URL } from './infrastructure/overview-api-url.port';
import { ApplicationOverviewService } from './application/application-overview.service';

export function provideDemoDiscussionDrafts(): Provider[] {
  return [
    LocalDiscussionsService,
    { provide: LOCAL_DISCUSSION_DRAFTS, useExisting: LocalDiscussionsService },
  ];
}

export function provideApplicationOverviewFeature(c?: {
  apiUrl?: string;
  useBff?: boolean;
}): ApplicationConfig {
  const useRealApi = c?.useBff ?? true;

  return {
    providers: [
      ApplicationOverviewService,
      ...(!useRealApi
        ? provideDemoDiscussionDrafts()
        : [
            {
              provide: LOCAL_DISCUSSION_DRAFTS,
              useValue: disabledLocalDiscussionDrafts,
            },
          ]),
      { provide: LOCAL_APPLICATION_DATA, useValue: !useRealApi },
      {
        provide: OVERVIEW_API_URL,
        useValue: (c?.apiUrl ?? '').replace(/\/$/, ''),
      },
      {
        provide: APPLICATION_OVERVIEW_PROVIDER,
        useClass: useRealApi ? OverviewBffApiService : OverviewLocalService,
      },
    ],
  };
}
