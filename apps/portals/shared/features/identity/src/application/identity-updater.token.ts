import { InjectionToken } from '@angular/core';
import { IIdentityUpdater } from '@sdk/features/identity/libs/authentication';

export const IDENTITY_UPDATER = new InjectionToken<IIdentityUpdater>(
  'IDENTITY_UPDATER_PORT'
);
