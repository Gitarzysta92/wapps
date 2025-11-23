import { InjectionToken } from "@angular/core";
import { IMyProfileStateProvider } from "./my-profile-state-provider.port";

export const MY_PROFILE_STATE_PROVIDER = new InjectionToken<IMyProfileStateProvider>('MY_PROFILE_STATE_PROVIDER');