import { InjectionToken } from "@angular/core";
import { IMyFavoritesStateProvider } from "./my-favorites-state-provider.port";

export const MY_FAVORITES_STATE_PROVIDER = new InjectionToken<IMyFavoritesStateProvider>('MY_FAVORITES_STATE_PROVIDER');

