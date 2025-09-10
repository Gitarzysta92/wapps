import { InjectionToken } from "@angular/core";
import { IIdentityUpdater } from "@domains/identity/authentication";

export const IDENTITY_UPDATER = new InjectionToken<IIdentityUpdater>('IDENTITY_UPDATER_PORT');
