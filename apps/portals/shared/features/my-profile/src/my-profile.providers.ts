import { ApplicationConfig, inject } from '@angular/core';
import { of } from 'rxjs';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  MY_PROFILE_PROVIDER,
  MY_PROFILE_UPDATER,
} from './application/my-profile-provider.tokens';
import { GUEST_PROFILE_PROVIDER } from './application/guest-profile-provider.port';
import { MyProfileApiService } from './infrastructure/my-profile-api.service';
import { MyProfileDemoService } from './infrastructure/my-profile-demo.service';
import {
  MY_PROFILE_MODE,
  PROFILE_SESSION,
  type ProfileSession,
} from './application/profile-session.port';
import {
  GuestProfileDto,
  IGuestProfileProvider,
} from '@domains/customer/profiles';
import { MyProfileService } from './application/my-profile.service';
import {
  MY_PROFILE_API_BASE_URL_PROVIDER,
  MY_PROFILE_AVATAR_BASE_URL_PROVIDER,
} from './application/infrastructure-providers.port';
import { MY_PROFILE_STATE_PROVIDER } from './application/my-profile-state-provider.token';
import { MY_PROFILE_VIEW_STATE_PROVIDER } from './presentation/my-profile-view-state-provider.port';
import { MyProfileViewStateService } from './presentation/my-profile-view-state.service';

export function provideMyProfileFeature(c: {
  mode: 'api' | 'demo';
  apiBaseUrl: string;
  avatarBaseUrl: string;
  guestProfile: GuestProfileDto;
}): ApplicationConfig {
  if (!['api', 'demo'].includes(c.mode) || typeof c.apiBaseUrl !== 'string')
    throw new Error(
      'Profile mode and API origin must be explicitly configured'
    );
  if (c.apiBaseUrl) {
    const url = new URL(c.apiBaseUrl);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid profile API origin');
  }
  const adapter = c.mode === 'api' ? MyProfileApiService : MyProfileDemoService;
  return {
    providers: [
      MyProfileService,
      adapter,
      { provide: MY_PROFILE_MODE, useValue: c.mode },
      {
        provide: PROFILE_SESSION,
        useFactory: (): ProfileSession => {
          if (c.mode === 'demo')
            return { key$: of('demo'), currentKey: () => 'demo' };
          const session = inject(AUTHENTICATION_SESSION);
          return { key$: session.token$, currentKey: () => session.getToken() };
        },
      },
      { provide: MY_PROFILE_STATE_PROVIDER, useExisting: MyProfileService },
      { provide: MY_PROFILE_PROVIDER, useExisting: adapter },
      { provide: MY_PROFILE_UPDATER, useExisting: adapter },
      {
        provide: MY_PROFILE_API_BASE_URL_PROVIDER,
        useValue: c.apiBaseUrl.replace(/\/$/, ''),
      },
      {
        provide: MY_PROFILE_AVATAR_BASE_URL_PROVIDER,
        useValue: c.avatarBaseUrl,
      },
      {
        provide: MY_PROFILE_VIEW_STATE_PROVIDER,
        useClass: MyProfileViewStateService,
      },
      {
        provide: GUEST_PROFILE_PROVIDER,
        useFactory: (): IGuestProfileProvider => ({
          getGuestProfile: () => ({ ...c.guestProfile }),
        }),
      },
    ],
  };
}
