import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, defer, interval, take, takeUntil } from 'rxjs';
import {
  HealthNotFoundError,
  overallHealth,
  type ApplicationHealthReport,
} from '@domains/reliability';
import { APPLICATION_HEALTH } from './health.port';

@Injectable()
export class ApplicationHealthService {
  private readonly port = inject(APPLICATION_HEALTH);
  private readonly destroy = inject(DestroyRef);
  private readonly changed = new Subject<void>();
  private generation = 0;
  private slug = '';
  readonly report = signal<ApplicationHealthReport | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notFound = signal(false);
  readonly status = computed(() =>
    overallHealth(this.report()?.monitors ?? [])
  );
  constructor() {
    // Clear old evidence on refresh; a failed refresh cannot keep a green current banner.
    interval(60_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!this.loading()) this.reload();
      });
  }
  open(slug: string) {
    this.slug = slug;
    this.reload();
  }
  reload() {
    this.changed.next();
    const generation = ++this.generation;
    this.report.set(null);
    this.error.set('');
    this.notFound.set(false);
    this.loading.set(false);
    if (!this.slug) return;
    this.loading.set(true);
    defer(() => this.port.read(this.slug))
      .pipe(take(1), takeUntil(this.changed), takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          if (generation !== this.generation) return;
          this.loading.set(false);
          if (result.ok) this.report.set(result.value);
          else if (result.error instanceof HealthNotFoundError)
            this.notFound.set(true);
          else this.error.set(result.error.message);
        },
        error: () => {
          if (generation !== this.generation) return;
          this.loading.set(false);
          this.error.set(
            'Observations could not be loaded. Retry to check again.'
          );
        },
      });
  }
}
