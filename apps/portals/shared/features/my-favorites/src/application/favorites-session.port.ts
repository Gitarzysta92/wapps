import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

export interface FavoritesSession {
  key$: Observable<string | null>;
  currentKey(): string | null;
}
export const FAVORITES_SESSION = new InjectionToken<FavoritesSession>(
  'FAVORITES_SESSION'
);
export const FAVORITES_MODE = new InjectionToken<'api' | 'demo'>(
  'FAVORITES_MODE'
);

export class FavoritesSaveError extends Error {
  constructor(
    readonly kind: 'session' | 'conflict' | 'invalid' | 'unavailable',
    message: string
  ) {
    super(message);
  }
}
