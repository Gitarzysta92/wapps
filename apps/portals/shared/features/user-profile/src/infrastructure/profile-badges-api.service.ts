import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, switchMap, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { ProfileBadgeChange } from '@domains/customer/profiles';
import {
  PROFILE_BADGES_URL,
  type ProfileBadgesPort,
} from '../application/profile-badges.port';
import { PublicProfileError } from '../application/public-profile.port';

@Injectable()
export class ProfileBadgesApiService implements ProfileBadgesPort {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(PROFILE_BADGES_URL)}/api`;
  capabilities(): ReturnType<ProfileBadgesPort['capabilities']> {
    return this.result(
      this.http.get<unknown>(`${this.url}/admin/profile-badges`).pipe(
        map((value) => {
          if (
            !value ||
            typeof value !== 'object' ||
            Array.isArray(value) ||
            Object.keys(value).length !== 1 ||
            !('kinds' in value) ||
            JSON.stringify(value.kinds) !== '["verified","premium"]'
          )
            throw new Error('Invalid badge capabilities');
        })
      )
    );
  }
  administer(
    id: string,
    after: number | null
  ): ReturnType<ProfileBadgesPort['administer']> {
    return this.result(
      defer(() => import('./profile-badges-response')).pipe(
        switchMap(({ parseProfileBadgeAdministration }) =>
          this.http
            .get<unknown>(
              `${this.url}/admin/profile-badges/${encodeURIComponent(id)}`,
              { params: after === null ? {} : { after } }
            )
            .pipe(
              map((value) => {
                const result = parseProfileBadgeAdministration(value);
                if (
                  result.profileId !== id ||
                  (after !== null &&
                    result.events.some((event) => event.revision >= after))
                )
                  throw new Error('Mismatched badge history');
                return result;
              })
            )
        )
      )
    );
  }
  change(
    id: string,
    command: ProfileBadgeChange,
    key: string
  ): ReturnType<ProfileBadgesPort['change']> {
    return this.result(
      defer(() => import('./profile-badges-response')).pipe(
        switchMap(({ parseProfileBadgeEvent }) =>
          this.http
            .put<unknown>(
              `${this.url}/admin/profile-badges/${encodeURIComponent(id)}`,
              command,
              { headers: { 'Idempotency-Key': key } }
            )
            .pipe(
              map((value) => {
                const event = parseProfileBadgeEvent(value);
                if (
                  event.profileId !== id ||
                  event.revision !== command.expectedRevision + 1 ||
                  event.kind !== command.kind ||
                  event.action !== command.action ||
                  event.reason !== command.reason
                )
                  throw new Error('Mismatched badge receipt');
                return event;
              })
            )
        )
      )
    );
  }
  read(id: string | null): ReturnType<ProfileBadgesPort['read']> {
    return this.result(
      defer(() => import('./profile-badges-response')).pipe(
        switchMap(({ parseSharedProfileBadges }) =>
          this.http
            .get<unknown>(
              id === null
                ? `${this.url}/me/badges`
                : `${this.url}/profiles/${encodeURIComponent(id)}/badges`
            )
            .pipe(map(parseSharedProfileBadges))
        )
      )
    );
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
            ? 'Badges changed. Reload the profile before making a new decision.'
            : reason === 'denied'
            ? 'Your session or badge permission changed.'
            : reason === 'missing'
            ? 'This profile is unavailable.'
            : reason === 'invalid'
            ? 'Check the profile ID, badge and reason.'
            : 'The badge service could not confirm the result. Try again.';
        return of(err(new PublicProfileError(reason, message)));
      })
    );
  }
}
