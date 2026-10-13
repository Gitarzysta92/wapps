import { DestroyRef, Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, switchMap, type Observable } from 'rxjs';
import {
  parseProfileDirectory,
  parseProfileFollow,
  parseProfileFollowerList,
  parseProfileFollowingList,
  parsePublicProfileView,
  type CustomerProfileDto,
  type ProfileFollowChange,
} from '@domains/customer/profiles';
import { err, ok, type Result } from '@sdk/kernel/standard';
import { parsePublicProfileFavoritesPage } from '@domains/customer/favorites';
import { parseProfileSuitesPage } from '@domains/publication/suite';
import {
  PUBLIC_PROFILE_API_URL,
  PublicProfileError,
  type PublicProfilePort,
} from '../application/public-profile.port';

@Injectable()
export class PublicProfileApiService implements PublicProfilePort {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(PUBLIC_PROFILE_API_URL)}/api`;
  private photo: string | null = null;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.releasePhoto());
  }

  read(id: string): ReturnType<PublicProfilePort['read']> {
    return this.result(
      defer(() => {
        this.releasePhoto();
        return this.http.get<unknown>(
          `${this.url}/profiles/${encodeURIComponent(id)}`
        );
      }).pipe(
        map(parsePublicProfileView),
        switchMap((view) => {
          const source = view.profile;
          if (
            (source && source.id !== id) ||
            (view.follow && view.follow.ownerId !== id)
          )
            throw new Error('Mismatched profile response');
          if (!source) return of({ view, profile: null });
          const image$: Observable<string | null> = source.avatarId
            ? this.http
                .get(
                  `${this.url}/profiles/${source.id}/avatar/${source.avatarId}`,
                  { responseType: 'blob' }
                )
                .pipe(
                  map((blob) => {
                    if (
                      blob.type !== 'image/webp' ||
                      blob.size < 12 ||
                      blob.size > 256 * 1024
                    )
                      throw new Error('Invalid profile photo');
                    this.releasePhoto();
                    this.photo = URL.createObjectURL(blob);
                    return this.photo;
                  })
                )
            : of(null);
          return image$.pipe(
            map((uri) => {
              const profile: CustomerProfileDto = {
                id: source.id,
                publicId: source.id,
                name: source.name,
                bio: source.bio ?? undefined,
                location: source.location ?? undefined,
                contactEmail: source.contactEmail ?? undefined,
                socialLinks: source.socialLinks,
                joinedAt: new Date(source.registeredAt),
                avatar: uri ? { uri, alt: source.name } : undefined,
              };
              return { view, profile };
            })
          );
        })
      )
    );
  }

  directory(after: string | null) {
    return this.result(
      this.http
        .get<unknown>(`${this.url}/profiles`, {
          params: after ? { after } : {},
        })
        .pipe(map(parseProfileDirectory))
    );
  }
  articles(
    id: string,
    after: string | null
  ): ReturnType<PublicProfilePort['articles']> {
    return this.result(
      defer(() => import('./profile-articles-response')).pipe(
        switchMap(({ parseProfileArticlesPage }) =>
          this.http
            .get<unknown>(
              `${this.url}/profiles/${encodeURIComponent(id)}/articles`,
              { params: after ? { after } : {} }
            )
            .pipe(
              map((value) => {
                const page = parseProfileArticlesPage(value);
                if (
                  page.items.some((item) => after !== null && item.id <= after)
                )
                  throw new Error('Invalid article continuation');
                return page;
              })
            )
        )
      )
    );
  }
  suites(id: string, after: string | null) {
    return this.result(
      this.http
        .get<unknown>(`${this.url}/profiles/${encodeURIComponent(id)}/suites`, {
          params: after ? { after } : {},
        })
        .pipe(
          map((value) => {
            const page = parseProfileSuitesPage(value);
            if (page.items.some((item) => after !== null && item.id <= after))
              throw new Error('Invalid suite continuation');
            return page;
          })
        )
    );
  }
  discussions(
    id: string,
    after: string | null
  ): ReturnType<PublicProfilePort['discussions']> {
    return this.result(
      defer(() => import('./profile-discussions-response')).pipe(
        switchMap(({ parseProfileDiscussionsPage }) =>
          this.http
            .get<unknown>(
              `${this.url}/profiles/${encodeURIComponent(id)}/discussions`,
              { params: after ? { after } : {} }
            )
            .pipe(map(parseProfileDiscussionsPage))
        )
      )
    );
  }
  activity(
    id: string,
    after: string | null
  ): ReturnType<PublicProfilePort['activity']> {
    return this.result(
      defer(() => import('./profile-activity-response')).pipe(
        switchMap(({ parseProfileActivityPage }) =>
          this.http
            .get<unknown>(
              `${this.url}/profiles/${encodeURIComponent(id)}/activity`,
              { params: after ? { after } : {} }
            )
            .pipe(map(parseProfileActivityPage))
        )
      )
    );
  }
  favorites(id: string, after: string | null) {
    return this.result(
      this.http
        .get<unknown>(
          `${this.url}/profiles/${encodeURIComponent(id)}/favorites`,
          { params: after ? { after } : {} }
        )
        .pipe(map(parsePublicProfileFavoritesPage))
    );
  }
  followers(after: string | null) {
    return this.result(
      this.http
        .get<unknown>(`${this.url}/me/profile-follows`, {
          params: after ? { after } : {},
        })
        .pipe(map(parseProfileFollowerList))
    );
  }
  following(after: string | null) {
    return this.result(
      this.http
        .get<unknown>(`${this.url}/me/profile-follows/outgoing`, {
          params: after ? { after } : {},
        })
        .pipe(map(parseProfileFollowingList))
    );
  }
  change(input: ProfileFollowChange, key: string) {
    return this.result(
      this.http
        .put<unknown>(`${this.url}/me/profile-follows`, input, {
          headers: { 'Idempotency-Key': key },
        })
        .pipe(map(parseProfileFollow))
    );
  }
  releasePhoto(): void {
    if (this.photo) URL.revokeObjectURL(this.photo);
    this.photo = null;
  }
  private result<T>(
    source: Observable<T>
  ): Observable<Result<T, PublicProfileError>> {
    return source.pipe(
      map(ok),
      catchError((error) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const reason =
          status === 404
            ? 'missing'
            : status === 409
            ? 'conflict'
            : [401, 403].includes(status)
            ? 'denied'
            : status === 400
            ? 'invalid'
            : 'unavailable';
        const message =
          reason === 'conflict'
            ? 'The profile or follower state changed. Reload before continuing.'
            : reason === 'denied'
            ? 'Your session or permission changed. Sign in again or reload.'
            : reason === 'invalid'
            ? 'This action is unavailable. Save your profile and reload before trying again.'
            : 'The profile service could not confirm the result. Try again.';
        return of(err(new PublicProfileError(reason, message)));
      })
    );
  }
}
