import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, switchMap } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import { parseMyDiscussionPage, myDiscussionCursor } from '@domains/community';
import { parseCatalogSelection } from '@domains/catalog/record';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  MY_DISCUSSIONS_ORIGIN,
  type MyDiscussionView,
  type MyDiscussionsPort,
} from '../application/my-discussions.port';

@Injectable()
export class MyDiscussionsApiService implements MyDiscussionsPort {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(MY_DISCUSSIONS_ORIGIN);
  private readonly session = inject(AUTHENTICATION_SESSION);

  list(cursor: string | null) {
    const token = this.session.getToken();
    const assertSession = () => {
      if (!token || token !== this.session.getToken())
        throw new Error('Session changed');
    };
    return defer(() => {
      assertSession();
      if (cursor !== null) myDiscussionCursor(cursor);
      return this.http.get<unknown>(`${this.origin}/api/me/discussions`, {
        params: cursor ? { cursor } : {},
      });
    }).pipe(
      map(parseMyDiscussionPage),
      switchMap((page) => {
        assertSession();
        const ids = [...new Set(page.items.map((item) => item.applicationId))];
        const apps = ids.length
          ? this.http
              .get<unknown>(`${this.origin}/api/catalog/app-selection`, {
                params: { ids: ids.join(',') },
              })
              .pipe(map((input) => parseCatalogSelection(input, ids).items))
          : of([]);
        return apps.pipe(
          map((applications) => {
            assertSession();
            const byId = new Map(applications.map((app) => [app.id, app]));
            const items: MyDiscussionView[] = page.items.flatMap((item) => {
              const app = byId.get(item.applicationId);
              return app
                ? [
                    {
                      ...item,
                      applicationName: app.name,
                      applicationSlug: app.slug,
                    },
                  ]
                : [];
            });
            return ok({ items, next: page.next });
          })
        );
      }),
      catchError((error: unknown) =>
        of(
          err(
            new Error(
              error instanceof HttpErrorResponse && error.status === 401
                ? 'Sign in again to load your discussions.'
                : error instanceof HttpErrorResponse && error.status === 403
                ? 'Your discussions cannot be accessed with this account.'
                : 'Your discussions are unavailable or still updating. Try loading them again.'
            )
          )
        )
      )
    );
  }
}
