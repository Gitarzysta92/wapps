import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { catchError, map, of, shareReplay, startWith } from 'rxjs';

type ServiceDirectory = {
  generatedAt: string;
  environment: string;
  services: Array<{
    id: string;
    name: string;
    publicUrls: string[];
    internalUrls: string[];
    extras?: Array<{ label: string; url: string }>;
    deployments: Array<{
      kind: 'Deployment';
      namespace: string;
      name: string;
      replicas: number;
      readyReplicas: number;
      updatedReplicas: number;
      availableReplicas: number;
      images: string[];
    }>;
    cronJobs: Array<{
      kind: 'CronJob';
      namespace: string;
      name: string;
      schedule: string;
      suspend: boolean;
      concurrencyPolicy?: string;
      lastScheduleTime?: string;
      lastSuccessfulTime?: string;
      recentRuns: Array<{
        name: string;
        startedAt?: string;
        finishedAt?: string;
        status: 'active' | 'succeeded' | 'failed' | 'unknown';
      }>;
    }>;
  }>;
};

type Vm =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'loaded'; directory: ServiceDirectory };

@Component({
  selector: 'services-directory-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services-directory-page.component.html',
  styleUrl: './services-directory-page.component.scss',
})
export class ServicesDirectoryPageComponent {
  private readonly http = inject(HttpClient);

  readonly vm$ = this.http.get<ServiceDirectory>('/api/services').pipe(
    map((directory) => ({ state: 'loaded' as const, directory })),
    catchError((err) =>
      of({
        state: 'error' as const,
        message:
          err?.status === 404
            ? `Service directory API is not available (expected: GET /api/services)`
            : `Failed to load service directory`,
      })
    ),
    startWith({ state: 'loading' as const }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
}

