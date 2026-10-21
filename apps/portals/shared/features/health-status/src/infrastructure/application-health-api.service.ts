import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, defer, map, of, timeout } from 'rxjs';
import { catalogSlug } from '@domains/catalog/record';
import {
  HealthNotFoundError,
  HealthUnavailableError,
  parseApplicationHealthReport,
} from '@domains/reliability';
import { err, ok } from '@sdk/kernel/standard';
import {
  APPLICATION_HEALTH_URL,
  type ApplicationHealthPort,
} from '../application/health.port';

@Injectable()
export class ApplicationHealthApiService implements ApplicationHealthPort {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(APPLICATION_HEALTH_URL);
  read(inputSlug: string) {
    return defer(() => {
      const slug = catalogSlug(inputSlug);
      return this.http
        .get<unknown>(
          `${this.origin}/api/catalog/application-health/${encodeURIComponent(
            slug
          )}`
        )
        .pipe(
          map((value) => {
            const report = parseApplicationHealthReport(value);
            if (report.application.slug !== slug)
              throw new Error('Unexpected application');
            return ok(report);
          })
        );
    }).pipe(
      timeout(20_000),
      catchError((error) =>
        of(
          err(
            error instanceof HttpErrorResponse && error.status === 404
              ? new HealthNotFoundError('Application not found')
              : new HealthUnavailableError(
                  'Observations could not be loaded. Retry to check again.'
                )
          )
        )
      )
    );
  }
}
