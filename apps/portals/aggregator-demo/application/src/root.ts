import { mergeApplicationConfig } from '@angular/core';
// import { appConfigCSR } from './app-config.csr';
import { provideProfileFeature } from '@portals/shared/features/profile';
import {
  provideIdentityRegistrationFeature,
  providePasswordResetRequestFeature,
  provideIdentityLoginFeature
} from '@portals/shared/features/identity';
import { provideIdentityManagementFeature } from '@portals/shared/features/identity';
import { VALIDATION_MESSAGES } from './data/validation-messages';
import { provideCategoryFeature } from '@portals/shared/features/categories';
import { provideFilterFeature } from '@portals/shared/features/filtering';
import { provideListingFeature } from '@portals/shared/features/listing';
import { provideCompatibilityFeature } from '@portals/shared/features/compatibility';
import { provideListingMonetizationFeature } from '@portals/shared/features/pricing';
import { provideSocialsFeature } from '@portals/shared/features/social';
import { provideUserStatisticPlatformFeature } from '@portals/shared/features/metrics';
import { provideMultiSearchFeature } from '@portals/shared/features/multi-search';
import { provideTagsFeature } from '@portals/shared/features/tags';
import { provideSmartSearchFeature } from '@portals/shared/features/smart-search';
import { provideOverviewFeature } from '@portals/shared/features/overview';
import { NAVIGATION } from './navigation';
import { APP_SHELL_STATE_PROVIDER } from './shells/app-shell/app-shell.component';
import { GlobalStateService } from './state/global-state.service';


export const APPLICATION_ROOT = mergeApplicationConfig(
    provideIdentityLoginFeature({
      validationMessages: VALIDATION_MESSAGES
    }),
    provideIdentityManagementFeature(),
    provideIdentityRegistrationFeature({
      validationMessages: VALIDATION_MESSAGES
    }),
    providePasswordResetRequestFeature({
      validationMessages: VALIDATION_MESSAGES
    }),
    provideProfileFeature(),
    provideCategoryFeature({
      path: NAVIGATION.categories.path
    }),
    // provideTrendingTagsFeature({
    //   path: NAVIGATION.tags.path
    // }),
    provideFilterFeature(),
    // appConfigCSR,
    provideListingFeature(),
    provideCompatibilityFeature(),
    provideListingMonetizationFeature(),
    provideSocialsFeature(),
    provideUserStatisticPlatformFeature(),
    provideTagsFeature(),
    provideMultiSearchFeature(),
    provideSmartSearchFeature(),
    provideOverviewFeature(),
    {
      providers: [
        GlobalStateService,
        { provide: APP_SHELL_STATE_PROVIDER, useExisting: GlobalStateService }
      ]
    }
  )