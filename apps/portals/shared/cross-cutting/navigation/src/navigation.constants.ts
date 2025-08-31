import { InjectionToken } from "@angular/core";
import { NAVIGATION } from "../../../applications/web-client/navigation";

export const NAVIGATION_CONFIGURATION = new InjectionToken<typeof NAVIGATION>('navigation-configuration-provider');