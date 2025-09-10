import { InjectionToken } from "@angular/core";
import { IIdentityProvider } from "@domains/identity/authentication";

export const IDENTITY_PROVIDER = new InjectionToken<IIdentityProvider>('IDENTITY_PROVIDER_PORT');
