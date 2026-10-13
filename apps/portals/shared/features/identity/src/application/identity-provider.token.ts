import { InjectionToken } from '@angular/core';
import { IClientIdentityProvider } from '@sdk/features/identity/libs/authentication';

export const IDENTITY_PROVIDER = new InjectionToken<IClientIdentityProvider>(
  'IDENTITY_PROVIDER_PORT'
);
