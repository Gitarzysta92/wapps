import { InjectionToken } from '@angular/core';

/** Keep background 401 recovery from replacing a session during its destructive request. */
export const AUTHENTICATION_RECOVERY_CONTROL = new InjectionToken<{
  hold: { token: string } | null;
}>('AUTHENTICATION_RECOVERY_CONTROL', {
  providedIn: 'root',
  factory: () => ({ hold: null }),
});
