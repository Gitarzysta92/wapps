import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, defer, map, of, timeout } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import { exploreCursor, parseExplorePage } from '@domains/feed';
import { EXPLORE_URL, type ExplorePort } from '../application/explore.port';

@Injectable()
export class ExploreApiService implements ExplorePort {
  private readonly http = inject(HttpClient);
  private readonly url = inject(EXPLORE_URL) + '/api/explore';
  read(after: string | null) {
    return defer(() => {
      exploreCursor(after);
      return this.http.get<unknown>(this.url, {
        params: after === null ? {} : { after },
      });
    }).pipe(
      timeout(20_000),
      map((value) => ok(parseExplorePage(value))),
      catchError((error) =>
        of(
          err(
            new Error(
              error instanceof HttpErrorResponse && error.status === 400
                ? 'This activity page expired. Refresh to see the latest content.'
                : 'Activity could not be loaded. Please try again.'
            )
          )
        )
      )
    );
  }
}
