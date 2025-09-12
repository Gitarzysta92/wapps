import { InjectionToken } from "@angular/core";
import { NavigationDeclaration } from "./models/navigation.dto";

export const NAVIGATION_CONFIGURATION = new InjectionToken<NavigationDeclaration[]>('navigation-configuration-provider');