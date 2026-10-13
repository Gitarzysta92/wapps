import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

export interface AuthenticationSession {
  readonly token$: Observable<string | null>;
  getToken(): string | null;
  setToken(token: string): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  clearRefreshToken(): void;
  clear(): void;
}

export const AUTHENTICATION_SESSION = new InjectionToken<AuthenticationSession>(
  'AUTHENTICATION_SESSION'
);
