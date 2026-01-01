import { mergeApplicationConfig } from '@angular/core';
// import { appConfigCSR } from './app-config.csr';
import {
  provideIdentityRegistrationFeature,
  providePasswordResetRequestFeature,
  provideIdentityLoginFeature
} from '@portals/shared/features/identity';
import { provideIdentityManagementFeature } from '@portals/shared/features/identity';
import { provideCategoryFeature } from '@portals/shared/features/categories';
import { provideFilterFeature } from '@portals/shared/features/filtering';
import { provideListingFeature } from '@portals/shared/features/listing';
import { provideCompatibilityFeature, provideListingPlatformFeature } from '@portals/shared/features/compatibility';
import { provideListingMonetizationFeature } from '@portals/shared/features/pricing';
import { provideSocialsFeature } from '@portals/shared/features/social';
import { provideUserStatisticPlatformFeature } from '@portals/shared/features/metrics';
import { provideMultiSearchFeature } from '@portals/shared/features/multi-search';
import { provideTagsFeature } from '@portals/shared/features/tags';
import { provideSmartSearchFeature } from '@portals/shared/features/smart-search';
import { provideApplicationOverviewFeature } from '@portals/shared/features/application-overview';
import { NAVIGATION } from './navigation';
import { APP_SHELL_STATE_PROVIDER } from './shells/app-shell/app-shell.component';
import { GlobalStateService } from './state/global-state.service';
import { LOGIN_VALIDATION_MESSAGES, PASSWORD_RESET_VALIDATION_MESSAGES, REGISTRATION_VALIDATION_MESSAGES } from '@portals/shared/data';
import { provideMyProfileFeature } from '@portals/shared/features/my-profile';
import { provideMyFavoritesFeature } from '@portals/shared/features/my-favorites';
import { provideUserProfileFeature } from '@portals/shared/features/user-profile';
import { provideSharingFeature } from '@portals/shared/features/sharing';
import { providePreferencesFeature } from '@portals/shared/features/preferences';
import { AUTH_BFF_URL } from './environment';



export const APPLICATION_ROOT = mergeApplicationConfig(
    provideIdentityLoginFeature({
      validationMessages: LOGIN_VALIDATION_MESSAGES,
      // AUTH_BFF_URL is built dynamically from ENVIRONMENT_NAME
      // Empty in local dev (uses mock), set to https://auth.<env>.wapps.com in CI
      authBffUrl: AUTH_BFF_URL || undefined
    }),
    provideIdentityManagementFeature(),
    provideIdentityRegistrationFeature({
      validationMessages: REGISTRATION_VALIDATION_MESSAGES
    }),
    providePasswordResetRequestFeature({
      validationMessages: PASSWORD_RESET_VALIDATION_MESSAGES
    }),

    provideUserProfileFeature(),
    provideMyProfileFeature({
      apiBaseUrl: 'https://api.myprofile.com',
      avatarBaseUrl: 'https://api.myprofile.com',
      guestProfile: {
        id: 'guest',
        name: 'Guest',
        avatar: { uri: 'https://api.myprofile.com', alt: 'Guest' }
      }
    }),
    provideMyFavoritesFeature({
      apiBaseUrl: 'https://api.myfavorites.com',
    }),
    provideCategoryFeature({
      path: NAVIGATION.categories.path,
      useBff: true
    }),
    // provideTrendingTagsFeature({
    //   path: NAVIGATION.tags.path
    // }),
    provideFilterFeature(),
    // appConfigCSR,
    provideListingFeature({ useBff: true }),
    provideListingPlatformFeature(),
    provideCompatibilityFeature(),
    provideListingMonetizationFeature(),
    provideSocialsFeature(),
    provideUserStatisticPlatformFeature(),
    provideTagsFeature({ useBff: true }),
    provideMultiSearchFeature(),
    provideSmartSearchFeature(),
  provideApplicationOverviewFeature({ useBff: true }),
    provideSharingFeature({
      baseUrl: 'https://api.sharing.com'
    }),
    providePreferencesFeature({
      apiBaseUrl: 'https://api.preferences.com'
    }),
  {
      providers: [
        GlobalStateService,
        { provide: APP_SHELL_STATE_PROVIDER, useExisting: GlobalStateService }
      ]
    }
  )