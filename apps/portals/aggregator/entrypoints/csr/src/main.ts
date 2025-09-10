import { bootstrapApplication } from '@angular/platform-browser';
import { createAppConfig, routes, AppRootComponent, VALIDATION_MESSAGES, NAVIGATION } from '@portals/aggregator/application';
import { mergeApplicationConfig } from '@angular/core';
import { provideProfileFeature } from '@portals/shared/features/profile';
import {
  provideIdentityRegistrationFeature,
  providePasswordResetRequestFeature,
  provideIdentityLoginFeature
} from '@portals/shared/features/identity';
import { provideCategoryFeature } from '@portals/shared/features/categories';
import { provideFilterFeature } from '@portals/shared/features/filtering';
import { provideListingFeature } from '@portals/shared/features/listing';
//import { provideCompatibilityFeature } from '@portals/shared/feature/compatibility';
import { provideListingMonetizationFeature } from '@portals/shared/features/pricing';
import { provideSocialsFeature } from '@portals/shared/features/social';
import { provideUserStatisticPlatformFeature } from '@portals/shared/features/metrics';
import { provideTagsFeature } from '@portals/shared/features/tags';

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
    // provideProfileFeature({
    //   validationMessages: VALIDATION_MESSAGES
    // }),
    provideCategoryFeature({
      path: NAVIGATION.categories.path
    }),
    provideFilterFeature(),
    provideListingFeature(),
   // provideCompatibilityFeature(),
    provideListingMonetizationFeature(),
    provideSocialsFeature(),
    provideUserStatisticPlatformFeature(),
    provideTagsFeature()
  ))
  .catch((err) => console.error(err));
