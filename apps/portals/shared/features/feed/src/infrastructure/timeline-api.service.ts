import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, defer, map, of, timeout } from 'rxjs';
import { catalogSlug } from '@domains/catalog/record';
import {
  exploreCursor,
  parseTimelinePage,
  TimelineMissingError,
} from '@domains/feed';
import { err, ok } from '@sdk/kernel/standard';
import { TIMELINE_URL, type TimelinePort } from '../application/timeline.port';

@Injectable()
export class TimelineApiService implements TimelinePort {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(TIMELINE_URL);
  read(inputSlug: string, inputCursor: string | null) {
    return defer(() => {
      const slug = catalogSlug(inputSlug),
        cursor = exploreCursor(inputCursor);
      return this.http
        .get<unknown>(
          `${this.origin}/api/applications/${encodeURIComponent(
            slug
          )}/timeline`,
          {
            params: cursor
              ? new HttpParams().set('after', cursor)
              : new HttpParams(),
          }
        )
        .pipe(
          map((value) => {
            const page = parseTimelinePage(value);
            if (page.application.slug !== slug)
              throw new Error('Unexpected application');
            return ok(page);
          })
        );
    }).pipe(
      timeout(20_000),
      catchError((error) =>
        of(
          err(
            error instanceof HttpErrorResponse && error.status === 404
              ? new TimelineMissingError('Application not found')
              : new Error(
                  'Application activity could not be loaded. Refresh the timeline to try again.'
                )
          )
        )
      )
    );
  }
}
