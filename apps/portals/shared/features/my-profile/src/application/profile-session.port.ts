import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

export interface ProfileSession {
  readonly key$: Observable<string | null>;
  currentKey(): string | null;
}

export const PROFILE_SESSION = new InjectionToken<ProfileSession>(
  'PROFILE_SESSION'
);
export const MY_PROFILE_MODE = new InjectionToken<'api' | 'demo'>(
  'MY_PROFILE_MODE'
);

export class ProfileSaveError extends Error {
  constructor(
    readonly reason: 'conflict' | 'session' | 'unavailable' | 'invalid',
    message: string
  ) {
    super(message);
  }
}
