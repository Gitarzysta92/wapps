import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { catchError, map, of, shareReplay, startWith } from 'rxjs';

type ServiceDirectory = {
  generatedAt: string;
  environment: string;
  /** When set (e.g. PLATFORM_PUBLIC_URL), the portal’s public wapps.ai base URL. */
  publicBaseUrl?: string;
  services: Array<{
    id: string;
    name: string;
    publicUrls: string[];
    internalUrls: string[];
    sources?: Array<{ kind: 'Ingress' | 'Service'; namespace?: string; name?: string }>;
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

  /** Internal URLs that are not k8s deployment refs already shown with deployments. */
  getOtherInternalUrls(svc: ServiceDirectory['services'][0]): string[] {
    const deploymentRefs = new Set(
      svc.deployments.map((d) => `k8s://deployment/${d.namespace}/${d.name}`)
    );
    const cronRefs = new Set(
      svc.cronJobs.map((cj) => `k8s://cronjob/${cj.namespace}/${cj.name}`)
    );
    return svc.internalUrls.filter(
      (u) => !deploymentRefs.has(u) && !cronRefs.has(u)
    );
  }

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

