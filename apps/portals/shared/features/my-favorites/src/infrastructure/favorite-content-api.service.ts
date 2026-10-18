import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, defer, map, of, timeout } from 'rxjs';
import {
  ACCOUNT_FAVORITES_LIMIT,
  parseFavoriteContent,
  parseFavoriteTarget,
  type CustomerFavoritesDto,
} from '@domains/customer/favorites';
import { err, ok } from '@sdk/kernel/standard';
import {
  favoriteReferences,
  type FavoriteContentPort,
} from '../application/favorite-content.port';
import { MY_FAVORITES_API_BASE_URL_PROVIDER } from '../application/infrastructure-providers.port';

@Injectable({ providedIn: 'root' })
export class FavoriteContentApiService implements FavoriteContentPort {
  private readonly http = inject(HttpClient);
  private readonly url =
    inject(MY_FAVORITES_API_BASE_URL_PROVIDER) + '/api/me/favorites/content';

  resolve(data: CustomerFavoritesDto): ReturnType<FavoriteContentPort['resolve']> {
    return defer(() => {
      const references = favoriteReferences(data);
      if (references.length > ACCOUNT_FAVORITES_LIMIT)
        throw new Error('Favorite limit exceeded');
      for (const target of references) parseFavoriteTarget(target);
      if (!references.length) return of(ok([]));
      return this.http.get<unknown>(this.url).pipe(
        timeout(15_000),
        map((response) => {
          const content = parseFavoriteContent(response, references);
          const byTarget = new Map(
            content.items.map((item) => [`${item.kind}:${item.id}`, item])
          );
          return ok(
            references.map((target) => {
              const item = byTarget.get(`${target.kind}:${target.id}`);
              if (!item) throw new Error('Favorite content missing');
              return item;
            })
          );
        })
      );
    }).pipe(
      catchError(() =>
        of(
          err(
            new Error(
              'Saved item details could not be loaded. Your saved references are unchanged.'
            )
          )
        )
      )
    );
  }
}
