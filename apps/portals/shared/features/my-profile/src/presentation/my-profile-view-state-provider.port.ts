import { InjectionToken } from '@angular/core';
import { Signal } from '@angular/core';

export const MY_PROFILE_VIEW_STATE_PROVIDER = new InjectionToken<IMyProfileViewStateProvider>('MY_PROFILE_VIEW_STATE_PROVIDER');

export interface IMyProfileViewStateProvider {
  avatar(): Signal<string | null>;
  name(): Signal<string | null>;
}