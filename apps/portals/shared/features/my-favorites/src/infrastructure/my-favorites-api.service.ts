import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, defer, distinctUntilChanged, map, of } from 'rxjs';
import {
  parseAccountFavorites,
  parseFavoriteChange,
  parseFavoriteChangeReceipt,
} from '@domains/customer/favorites';
import { err, ok } from '@sdk/kernel/standard';
import { MY_FAVORITES_API_BASE_URL_PROVIDER } from '../application/infrastructure-providers.port';
import {
  FAVORITES_SESSION,
  FavoritesSaveError,
} from '../application/favorites-session.port';
import { emptyFavorites } from '../application/my-favorites.state';
import type {
  FavoritesCommand,
  IMyFavoritesProvider,
} from '../application/my-favorites-provider.port';

@Injectable({ providedIn: 'root' })
export class MyFavoritesApiService implements IMyFavoritesProvider {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(
    MY_FAVORITES_API_BASE_URL_PROVIDER
  )}/api/me/favorites`;
  private readonly session = inject(FAVORITES_SESSION);
  private attempt: { signature: string; key: string } | null = null;

  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        this.attempt = null;
      });
  }

  getMyFavorites() {
    return this.http.get<unknown>(this.url).pipe(
      map((response) => {
        const source = parseAccountFavorites(response);
        const data = emptyFavorites();
        for (const target of source.favorites)
          data[target.kind].push(target.id);
        return ok({
          identityId: source.identityId,
          revision: source.revision,
          data,
        });
      }),
      catchError(() =>
        of(err(new Error('Your favorites could not be loaded. Try again.')))
      )
    );
  }

  change(command: FavoritesCommand) {
    return defer(() => {
      if (this.session.currentKey() === null)
        throw new FavoritesSaveError(
          'session',
          'Sign in before changing favorites.'
        );
      const input = parseFavoriteChange({
        expectedRevision: command.expectedRevision,
        target: command.target,
        saved: command.saved,
      });
      const signature = JSON.stringify({
        identityId: command.identityId,
        input,
      });
      if (this.attempt?.signature !== signature)
        this.attempt = { signature, key: crypto.randomUUID() };
      return this.http
        .put<unknown>(this.url, input, {
          headers: { 'Idempotency-Key': this.attempt.key },
        })
        .pipe(
          map((response) => {
            let receipt;
            try {
              receipt = parseFavoriteChangeReceipt(response);
            } catch {
              throw new FavoritesSaveError(
                'unavailable',
                'The save receipt could not be confirmed. Retry the same change or reload favorites.'
              );
            }
            if (
              receipt.identityId !== command.identityId ||
              receipt.revision !== input.expectedRevision + 1
            )
              throw new FavoritesSaveError(
                'unavailable',
                'The save receipt could not be confirmed. Retry the same change or reload favorites.'
              );
            return ok(true);
          })
        );
    }).pipe(
      catchError((error: unknown) => {
        if (error instanceof FavoritesSaveError) return of(err(error));
        if (error instanceof HttpErrorResponse) {
          if (error.status === 409)
            return of(
              err(
                new FavoritesSaveError(
                  'conflict',
                  'Your account changed. Reload favorites before trying again.'
                )
              )
            );
          if ([401, 403].includes(error.status))
            return of(
              err(
                new FavoritesSaveError(
                  'session',
                  'Favorites access is unavailable. Sign in again.'
                )
              )
            );
          if (error.status === 400)
            return of(
              err(
                new FavoritesSaveError(
                  'invalid',
                  'This item cannot be saved, or the favorites limit was reached. Reload favorites.'
                )
              )
            );
          return of(
            err(
              new FavoritesSaveError(
                'unavailable',
                'Could not confirm the change. Retry to confirm the same request.'
              )
            )
          );
        }
        return of(
          err(
            new FavoritesSaveError(
              'invalid',
              'Invalid favorite target or account revision.'
            )
          )
        );
      })
    );
  }
}
