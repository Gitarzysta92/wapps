import { InjectionToken } from "@angular/core";
import { IPlatformsProvider } from "@domains/catalog/compatibility";

export const PLATFORMS_PROVIDER = new InjectionToken<IPlatformsProvider>('PLATFORMS_PROVIDER');