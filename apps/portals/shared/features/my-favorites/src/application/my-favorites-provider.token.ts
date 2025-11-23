import { InjectionToken } from "@angular/core";
import { IMyFavoritesProvider } from "./my-favorites-provider.port";

export const MY_FAVORITES_PROVIDER = new InjectionToken<IMyFavoritesProvider>('MY_FAVORITES_PROVIDER');

