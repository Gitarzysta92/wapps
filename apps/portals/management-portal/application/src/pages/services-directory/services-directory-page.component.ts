import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { catchError, map, of, shareReplay, startWith } from 'rxjs';

type ServiceDirectory = {
  generatedAt: string;
  environment: string;
  sources: string[];
  services: Array<{
    id: string;
    name: string;
    urls: string[];
    sources: string[];
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

  readonly vm$ = this.http.get<ServiceDirectory>('assets/service-directory.json').pipe(
    map((directory) => ({ state: 'loaded' as const, directory })),
    catchError((err) =>
      of({
        state: 'error' as const,
        message:
          err?.status === 404
            ? `Missing assets/service-directory.json (run: npm run service-directory:generate -- --environment development)`
            : `Failed to load service directory`,
      })
    ),
    startWith({ state: 'loading' as const }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
}

