import { bootstrapApplication } from '@angular/platform-browser';
import { createAppConfig } from './app-config';
import { mergeApplicationConfig } from '@angular/core';
import { appConfigCSR } from './app-config.csr';
import { routes } from './routes';
import { provideIdentityLoginFeature } from '../../libs/features/identity/login/login.providers';
import { AppRootComponent } from './components/app-root.component';
import { provideAuthenticationAspect } from '../../libs/aspects/authentication/authentication.providers';
import { provideMyProfileFeature } from '../../libs/features/my-profile/my-profile.providers';
import { API_BASE_URL, AVATAR_BASE_URL } from './environment';
import { MY_PROFILE_DEFAULT } from './data/my-profile-default';
import { provideIdentityRegistrationFeature } from '../../libs/features/identity/registration/registration.providers';
import { providePasswordResetRequestFeature } from '../../libs/features/identity/password-reset-request/password-reset-request.providers';
import { VALIDATION_MESSAGES } from './data/validation-messages';
import { provideListingCategoryFeature } from '../../libs/features/listing/category/feature/category.providers';
import { provideTrendingTagsFeature } from '../../libs/features/listing/tags/trending-tags/trending-tags.providers';
import { provideFilterFeature } from '../../libs/features/listing/filter/filter.providers';
import { provideListingPlatformFeature } from '../../libs/features/listing/platform/platform.providers';
import { provideFilterAppFeature } from '../../libs/features/listing/app/app.providers';
import { FILTERS } from './filters';
import { NAVIGATION } from './navigation';
import { provideListingDeviceFeature } from '../../libs/features/listing/device/device.providers';
import { provideListingMonetizationFeature } from '../../libs/features/listing/monetization/monetization.providers';
import { provideListingSocialsFeature } from '../../libs/features/listing/social/social.providers';
import { provideUserStatisticPlatformFeature } from '../../libs/features/listing/statistic/users/user-statistic.providers';
import { provideListingTagFeature } from '../../libs/features/listing/tags/feature/tag.providers';




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
    provideAuthenticationAspect(),
    provideMyProfileFeature({
      avatarBaseUrl: AVATAR_BASE_URL,
      apiBaseUrl: API_BASE_URL,
      guestProfile: MY_PROFILE_DEFAULT
    }),
    provideListingCategoryFeature({
      path: NAVIGATION.categories.path
    }),
    provideTrendingTagsFeature({
      path: NAVIGATION.tags.path
    }),
    provideFilterFeature(),
    appConfigCSR,
    provideListingPlatformFeature(),
    provideFilterAppFeature({
      pageNumberParamKey: FILTERS.page
    }),
    provideListingDeviceFeature(),
    provideListingMonetizationFeature(),
    provideListingSocialsFeature(),
    provideUserStatisticPlatformFeature(),
    provideListingTagFeature()
  ))