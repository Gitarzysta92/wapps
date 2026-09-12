import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Result } from '@foundation/standard';
import { Observable, of } from 'rxjs';
import { CustomerFavoritesDto } from '@domains/customer/favorites';
import { APPLICATIONS } from '@portals/shared/data';
import { IMyFavoritesProvider } from '../application/my-favorites-provider.port';

type FavoriteType = keyof CustomerFavoritesDto;
const STORAGE_KEY = 'wapps.favorites.v1';
const FAVORITE_TYPES: FavoriteType[] = ['applications', 'suites', 'articles', 'discussions'];

/** Local favorites adapter. Mutations survive reloads and never claim a remote save. */
@Injectable()
export class MyFavoritesApiService implements IMyFavoritesProvider {
  private readonly document = inject(DOCUMENT);
  private favorites = this.read();

  getMyFavorites(): Observable<Result<CustomerFavoritesDto>> {
    return of({ ok: true, value: this.copy(this.favorites) });
  }

  addToFavorites(type: FavoriteType, slug: string): Observable<Result<boolean, Error>> {
    return this.update(type, slug, true);
  }

  removeFromFavorites(type: FavoriteType, slug: string): Observable<Result<boolean, Error>> {
    return this.update(type, slug, false);
  }

  private update(type: FavoriteType, slug: string, add: boolean): Observable<Result<boolean, Error>> {
    if (!FAVORITE_TYPES.includes(type) || !slug.trim()) {
      return of({ ok: false, error: new Error('Choose an item to save.') });
    }
    const next = this.copy(this.favorites);
    next[type] = add ? [...new Set([...next[type], slug])] : next[type].filter(item => item !== slug);
    try {
      const storage = this.document.defaultView?.localStorage;
      if (!storage) throw new Error('Favorites storage is unavailable in this browser.');
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
      this.favorites = next;
      return of({ ok: true, value: true });
    } catch {
      return of({ ok: false, error: new Error('Could not save favorites. Check your browser storage settings and try again.') });
    }
  }

  private read(): CustomerFavoritesDto {
    const defaults: CustomerFavoritesDto = {
      applications: APPLICATIONS.slice(0, 2).map(app => app.slug),
      suites: [], articles: [], discussions: [],
    };
    try {
      const saved = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (!saved) return defaults;
      const value: unknown = JSON.parse(saved);
      if (!value || typeof value !== 'object') return defaults;
      const result = { applications: [], suites: [], articles: [], discussions: [] } as CustomerFavoritesDto;
      for (const type of FAVORITE_TYPES) {
        const items = (value as Record<string, unknown>)[type];
        result[type] = Array.isArray(items) ? [...new Set(items.filter((item): item is string => typeof item === 'string' && item.length > 0))] : [];
      }
      return result;
    } catch { return defaults; }
  }

  private copy(value: CustomerFavoritesDto): CustomerFavoritesDto {
    return { applications: [...value.applications], suites: [...value.suites], articles: [...value.articles], discussions: [...value.discussions] };
  }
}
