import { InjectionToken } from "@angular/core";
import { IMonetizationProvider } from "@domains/catalog/pricing";

export const MONETIZATION_PROVIDER = new InjectionToken<IMonetizationProvider>('MONETIZATION_PROVIDER_PORT');

