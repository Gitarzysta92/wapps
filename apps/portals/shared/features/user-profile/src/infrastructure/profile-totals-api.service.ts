import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, defer, map, of, switchMap, timeout } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  PROFILE_TOTALS_URL,
  type ProfileTotalsPort,
} from '../application/profile-totals.port';
import { PublicProfileError } from '../application/public-profile.port';
@Injectable()
export class ProfileTotalsApiService implements ProfileTotalsPort {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(PROFILE_TOTALS_URL)}/api`;
  read(id: string | null): ReturnType<ProfileTotalsPort['read']> {
    return defer(() => import('./profile-totals-response')).pipe(
      switchMap(({ parseProfileTotals }) =>
        this.http
          .get<unknown>(
            id === null
              ? `${this.url}/me/totals`
              : `${this.url}/profiles/${encodeURIComponent(id)}/totals`
          )
          .pipe(
            map((value) => {
              const totals = parseProfileTotals(value);
              if (
                id === null &&
                Object.values(totals).some((value) => value === null)
              )
                throw new Error('Incomplete private totals');
              return ok(totals);
            })
          )
      ),
      timeout(35000),
      catchError(() =>
        of(
          err(
            new PublicProfileError(
              'unavailable',
              'Profile totals could not be loaded.'
            )
          )
        )
      )
    );
  }
}
