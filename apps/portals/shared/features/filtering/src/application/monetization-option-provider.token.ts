import { InjectionToken } from "@angular/core";
import { IMonetizationOptionProvider } from "@domains/catalog/pricing";

export const MONETIZATION_OPTION_PROVIDER = new InjectionToken<IMonetizationOptionProvider>('MonetizationOptionProvider');


