import { provideDigest, provideExplore, provideApplicationTimeline } from '@portals/shared/features/feed';
import { exploreLink } from './explore-links';
import { provideMentionMembers } from '@portals/shared/features/user-profile';
import { mergeApplicationConfig } from '@angular/core';
// import { appConfigCSR } from './app-config.csr';
import {
  provideIdentityRegistrationFeature,
  providePasswordResetRequestFeature,
  provideIdentityLoginFeature,
  provideIdentityPasswordResetFeature,
  provideAccountErasure,
} from '@portals/shared/features/identity';
import { provideIdentityManagementFeature } from '@portals/shared/features/identity';
import { provideCategoryFeature } from '@portals/shared/features/categories';
import { provideFilterFeature } from '@portals/shared/features/filtering';
import {
  provideListingFeature,
  DEMO_CATALOG_ENTRIES,
} from '@portals/shared/features/listing';
import { demoCatalogEntries } from './state/demo-catalog-entries';
import {
  provideCompatibilityFeature,
  provideListingPlatformFeature,
} from '@portals/shared/features/compatibility';
import { provideListingMonetizationFeature } from '@portals/shared/features/pricing';
import { provideSocialsFeature } from '@portals/shared/features/social';
import { provideUserStatisticPlatformFeature } from '@portals/shared/features/metrics';
import { provideTagsFeature } from '@portals/shared/features/tags';
import { provideSmartSearchFeature } from '@portals/shared/features/smart-search';
import { providePublicDiscovery } from '@portals/shared/features/search';
import { provideApplicationOverviewFeature } from '@portals/shared/features/application-overview';
import { NAVIGATION } from './navigation';
import { APP_SHELL_STATE_PROVIDER } from './shells/app-shell/app-shell.component';
import { GlobalStateService } from './state/global-state.service';
import {
  LOGIN_VALIDATION_MESSAGES,
  PASSWORD_RESET_VALIDATION_MESSAGES,
  REGISTRATION_VALIDATION_MESSAGES,
} from '@portals/shared/data';
import { provideMyProfileFeature } from '@portals/shared/features/my-profile';
import { provideMyFavoritesFeature } from '@portals/shared/features/my-favorites';
import { providePrivateSuitesFeature } from '@portals/shared/features/suite';
import { provideApplicationWorkspace } from '@portals/shared/features/application-workspace';
import { provideArticles } from '@portals/shared/features/articles';
import { provideQuickDiscussions } from '@portals/shared/features/discussion';
import { provideUserProfileFeature } from '@portals/shared/features/user-profile';
import { provideSharingFeature } from '@portals/shared/features/sharing';
import { providePreferencesFeature } from '@portals/shared/features/preferences';
import {
  AUTH_BFF_URL,
  API_BASE_URL,
  CATALOG_MODE,
  USE_CATALOG_BFF,
} from './environment';

export const APPLICATION_ROOT = mergeApplicationConfig(
  { providers: CATALOG_MODE === 'api' ? [...provideExplore(API_BASE_URL, exploreLink), ...provideDigest(API_BASE_URL), ...provideApplicationTimeline(API_BASE_URL), ...provideApplicationHealth(API_BASE_URL), ...providePublicDiscovery(API_BASE_URL)] : [] },
  provideIdentityLoginFeature({
    validationMessages: LOGIN_VALIDATION_MESSAGES,
    mode: 'api',
    authBffUrl: AUTH_BFF_URL,
    accountApiUrl: API_BASE_URL,
    authenticatedOrigins: API_BASE_URL ? [API_BASE_URL] : [],
  }),
  provideIdentityManagementFeature(),
  {
    providers:
      CATALOG_MODE === 'api' ? provideAccountErasure(API_BASE_URL) : [],
  },
  provideIdentityPasswordResetFeature(),
  provideIdentityRegistrationFeature({
    validationMessages: REGISTRATION_VALIDATION_MESSAGES,
  }),
  providePasswordResetRequestFeature({
    validationMessages: PASSWORD_RESET_VALIDATION_MESSAGES,
  }),

  provideUserProfileFeature(),
  { providers: provideMentionMembers(CATALOG_MODE, API_BASE_URL) },
  provideMyProfileFeature({
    mode: CATALOG_MODE,
    apiBaseUrl: API_BASE_URL,
    avatarBaseUrl: '',
    guestProfile: {
      id: 'guest',
      name: 'Guest',
    },
  }),
  provideMyFavoritesFeature({
    mode: CATALOG_MODE,
    apiBaseUrl: API_BASE_URL,
  }),
  providePrivateSuitesFeature({ mode: CATALOG_MODE, apiBaseUrl: API_BASE_URL }),
  provideApplicationWorkspace({ mode: CATALOG_MODE, apiBaseUrl: API_BASE_URL }),
  provideArticles({ mode: CATALOG_MODE, apiBaseUrl: API_BASE_URL }),
  { providers: USE_CATALOG_BFF ? provideQuickDiscussions(API_BASE_URL) : [] },
  provideCategoryFeature({
    path: NAVIGATION.categories.path,
    useBff: USE_CATALOG_BFF,
  }),
  // provideTrendingTagsFeature({
  //   path: NAVIGATION.tags.path
  // }),
  provideFilterFeature(),
  // appConfigCSR,
  provideListingFeature({ mode: CATALOG_MODE, apiUrl: API_BASE_URL }),
  {
    providers: !USE_CATALOG_BFF
      ? [{ provide: DEMO_CATALOG_ENTRIES, useFactory: demoCatalogEntries }]
      : [],
  },
  provideListingPlatformFeature(),
  provideCompatibilityFeature(),
  provideListingMonetizationFeature(),
  provideSocialsFeature(),
  provideUserStatisticPlatformFeature(),
  provideTagsFeature({ useBff: USE_CATALOG_BFF }),
  provideSmartSearchFeature(),
  provideApplicationOverviewFeature({
    useBff: USE_CATALOG_BFF,
    apiUrl: API_BASE_URL,
  }),
  provideSharingFeature({
    baseUrl: 'https://api.sharing.com',
  }),
  providePreferencesFeature({
    mode: CATALOG_MODE,
    apiBaseUrl: API_BASE_URL,
  }),
  {
    providers: [
      GlobalStateService,
      { provide: APP_SHELL_STATE_PROVIDER, useExisting: GlobalStateService },
    ],
  }
);
import { provideApplicationHealth } from '@apps/portals/shared/features/health-status';
