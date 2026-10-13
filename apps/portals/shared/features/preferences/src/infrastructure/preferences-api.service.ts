import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, distinctUntilChanged, map, of } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  mergePreferences,
  parseAccountPreferences,
  parsePreferencesUpdate,
  parsePreferencesUpdateReceipt,
  type PreferencesPatch,
} from '@domains/customer/preferences';
import { PREFERENCES_API_BASE_URL_PROVIDER } from '../application/infrastructure-providers.port';
import {
  PREFERENCES_SESSION,
  PreferencesSaveError,
  type PreferencesPort,
  type PreferencesRead,
} from '../application/preferences-session.port';

@Injectable()
export class PreferencesApiService implements PreferencesPort {
  private readonly http = inject(HttpClient);
  private readonly session = inject(PREFERENCES_SESSION);
  private readonly url = `${inject(
    PREFERENCES_API_BASE_URL_PROVIDER
  )}/api/me/preferences`;
  private attempt: {
    sessionKey: string;
    signature: string;
    key: string;
  } | null = null;

  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        this.attempt = null;
      });
  }

  read() {
    return this.http.get<unknown>(this.url).pipe(
      map((response) => {
        const account = parseAccountPreferences(response);
        return ok({ data: account.preferences, account });
      }),
      catchError(() =>
        of(
          err(
            new Error(
              'Your account preferences could not be loaded. Try again.'
            )
          )
        )
      )
    );
  }

  save(
    snapshot: PreferencesRead,
    patch: PreferencesPatch,
    sessionKey: string | null
  ) {
    return defer(() => {
      if (
        !sessionKey ||
        sessionKey !== this.session.currentKey() ||
        !snapshot.account
      )
        throw new PreferencesSaveError(
          'session',
          'Your session changed. Reload your settings before saving.'
        );
      const input = parsePreferencesUpdate({
        expectedRevision: snapshot.account.revision,
        preferences: mergePreferences(snapshot.data, patch),
      });
      const signature = JSON.stringify({
        identityId: snapshot.account.identityId,
        input,
      });
      if (
        this.attempt?.sessionKey !== sessionKey ||
        this.attempt?.signature !== signature
      )
        this.attempt = { sessionKey, signature, key: crypto.randomUUID() };
      return this.http
        .put<unknown>(this.url, input, {
          headers: { 'Idempotency-Key': this.attempt.key },
        })
        .pipe(
          map((response) => {
            let receipt;
            try {
              receipt = parsePreferencesUpdateReceipt(response);
            } catch {
              throw new PreferencesSaveError(
                'unavailable',
                'Could not confirm the save receipt. Reload your settings to check the saved state.'
              );
            }
            if (
              receipt.identityId !== snapshot.account?.identityId ||
              receipt.revision !== input.expectedRevision + 1
            )
              throw new PreferencesSaveError(
                'unavailable',
                'The service returned an unexpected save receipt. Reload your settings to check the saved state.'
              );
            return ok(true);
          })
        );
    }).pipe(
      catchError((error: unknown) => {
        if (error instanceof PreferencesSaveError) return of(err(error));
        if (error instanceof HttpErrorResponse) {
          if (error.status === 409)
            return of(
              err(
                new PreferencesSaveError(
                  'conflict',
                  'Your account changed in another session or screen. Your edits are still in this form. Reload the saved settings before trying again.'
                )
              )
            );
          if ([401, 403].includes(error.status))
            return of(
              err(
                new PreferencesSaveError(
                  'session',
                  'Settings access is unavailable. Sign in again before saving.'
                )
              )
            );
          return of(
            err(
              new PreferencesSaveError(
                'unavailable',
                'Could not confirm the save. Your edits are still in this form. Retry to confirm the same change.'
              )
            )
          );
        }
        return of(
          err(
            new PreferencesSaveError(
              'invalid',
              error instanceof Error ? error.message : 'Invalid preferences.'
            )
          )
        );
      })
    );
  }
}
