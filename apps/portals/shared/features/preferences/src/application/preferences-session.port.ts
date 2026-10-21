import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  AccountPreferences,
  CustomerPreferencesDto,
  PreferencesPatch,
} from '@domains/customer/preferences';

export interface PreferencesRead {
  data: CustomerPreferencesDto;
  account: AccountPreferences | null;
}

export interface PreferencesPort {
  read(): Observable<Result<PreferencesRead, Error>>;
  save(
    snapshot: PreferencesRead,
    patch: PreferencesPatch,
    sessionKey: string | null
  ): Observable<Result<boolean, Error>>;
}

export interface PreferencesSession {
  readonly key$: Observable<string | null>;
  currentKey(): string | null;
}

export interface PreferencesEditContext {
  sessionKey: string | null;
  sessionVersion: number;
  read: PreferencesRead;
}

export const PREFERENCES_PORT = new InjectionToken<PreferencesPort>(
  'PREFERENCES_PORT'
);
export const GUEST_PREFERENCES_PORT = new InjectionToken<PreferencesPort>(
  'GUEST_PREFERENCES_PORT'
);
export const PREFERENCES_SESSION = new InjectionToken<PreferencesSession>(
  'PREFERENCES_SESSION'
);
export const PREFERENCES_MODE = new InjectionToken<'api' | 'demo'>(
  'PREFERENCES_MODE'
);

export class PreferencesSaveError extends Error {
  constructor(
    readonly reason: 'conflict' | 'session' | 'unavailable' | 'invalid',
    message: string
  ) {
    super(message);
  }
}
