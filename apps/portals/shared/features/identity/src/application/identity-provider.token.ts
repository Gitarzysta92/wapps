import { InjectionToken } from "@angular/core";
import { IClientIdentityProvider } from "@domains/identity/authentication";

export const IDENTITY_PROVIDER = new InjectionToken<IClientIdentityProvider>('IDENTITY_PROVIDER_PORT');
