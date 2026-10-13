import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { APPLICATIONS, ARTICLES, DISCUSSIONS } from '@portals/shared/data';
import type { CustomerFavoritesDto } from '@domains/customer/favorites';
import { ok } from '@sdk/kernel/standard';
import {
  favoriteReferences,
  type FavoriteContent,
  type FavoriteContentPort,
} from '../application/favorite-content.port';

@Injectable({ providedIn: 'root' })
export class FavoriteContentDemoService implements FavoriteContentPort {
  resolve(data: CustomerFavoritesDto) {
    return of(
      ok(
        favoriteReferences(data).map((target): FavoriteContent => {
          const app =
            target.kind === 'applications'
              ? APPLICATIONS.find((item) => item.slug === target.id)
              : undefined;
          const article =
            target.kind === 'articles'
              ? ARTICLES.find((item) => item.slug === target.id)
              : undefined;
          const discussion =
            target.kind === 'discussions'
              ? DISCUSSIONS.find((item) => item.slug === target.id)
              : undefined;
          return {
            ...target,
            status: 'available',
            slug: target.id,
            name:
              app?.name ??
              article?.title ??
              discussion?.title ??
              target.id
                .split('-')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' '),
            image: app?.logo,
            appSlug: APPLICATIONS.find(
              (item) => item.id === discussion?.associationId
            )?.slug,
          };
        })
      )
    );
  }
}
