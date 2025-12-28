import { ApplicationConfig } from '@angular/core';
import { ProfileApiServiceAdapter } from './infrastructure/profile-api-service.adapter';
import { USER_PROFILE_PROVIDER } from './application/profile-provider.token';

export function provideUserProfileFeature(): ApplicationConfig {
  return {
    providers: [
      // {
      //   provide: PROFILE_PROVIDER,
      //   useClass: ProfileApiServiceAdapter
      // }
    ],
  };
}
