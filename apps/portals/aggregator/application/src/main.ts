import { bootstrapApplication } from '@angular/platform-browser';
import { createAppConfig } from './app-config';
import { mergeApplicationConfig } from '@angular/core';
// import { appConfigCSR } from './app-config.csr';
import { routes } from './routes';
import { AppRootComponent } from './components/app-root.component';
import { provideProfileFeature } from '@portals/shared/features/profile';
import {
  provideIdentityRegistrationFeature,
  providePasswordResetRequestFeature,
  provideIdentityLoginFeature
} from '@portals/shared/features/identity';
import { VALIDATION_MESSAGES } from './data/validation-messages';
import { provideCategoryFeature } from '@portals/shared/features/categories';
import { provideFilterFeature } from '@portals/shared/features/filtering';
import { provideListingFeature } from '@portals/shared/features/listing';
import { provideCompatibilityFeature } from '@portals/shared/feature/compatibility';
import { provideListingMonetizationFeature } from '@portals/shared/features/pricing';
import { provideSocialsFeature } from '@portals/shared/features/social';
import { provideUserStatisticPlatformFeature } from '@portals/shared/features/metrics';
import { provideMultiSearchFeature } from '@portals/shared/features/multi-search';
import { provideTagsFeature } from '@portals/shared/features/tags';
import { MY_PROFILE_DEFAULT } from './data/my-profile-default';
import { FILTERS } from './filters';
import { NAVIGATION } from './navigation';




bootstrapApplication(AppRootComponent,
  mergeApplicationConfig(
    createAppConfig({
      routes: routes
    }),
    provideIdentityLoginFeature(),
    provideIdentityRegistrationFeature({
      validationMessages: VALIDATION_MESSAGES
    }),
    providePasswordResetRequestFeature({
      validationMessages: VALIDATION_MESSAGES
    }),
    provideProfileFeature({
      guestProfile: MY_PROFILE_DEFAULT
    }),
    provideCategoryFeature({
      path: NAVIGATION.categories.path
    }),
    // provideTrendingTagsFeature({
    //   path: NAVIGATION.tags.path
    // }),
    provideFilterFeature(),
    // appConfigCSR,
    provideListingFeature(),
    provideFilterFeature({
      pageNumberParamKey: FILTERS.page
    }),
    provideCompatibilityFeature(),
    provideListingMonetizationFeature(),
    provideSocialsFeature(),
    provideUserStatisticPlatformFeature(),
    provideTagsFeature(),
    provideMultiSearchFeature()
  ))