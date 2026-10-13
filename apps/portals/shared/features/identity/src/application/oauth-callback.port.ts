import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';

export interface OAuthCallbackHandler {
  completeCallback(input: {
    code: string | null;
    state: string | null;
    error: string | null;
  }): Observable<Result<string, Error>>;
}

export const OAUTH_CALLBACK_HANDLER = new InjectionToken<OAuthCallbackHandler>(
  'OAUTH_CALLBACK_HANDLER'
);
