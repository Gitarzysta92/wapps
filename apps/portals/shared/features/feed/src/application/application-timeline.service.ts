import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, Subject, take, takeUntil } from 'rxjs';
import {
  selectExplorePage,
  type TimelinePage,
  TimelineMissingError,
} from '@domains/feed';
import { TIMELINE_PORT } from './timeline.port';
import { FeedChoicesService } from './feed-choices.service';

@Injectable()
export class ApplicationTimelineService {
  private readonly port = inject(TIMELINE_PORT);
  private readonly choices = inject(FeedChoicesService);
  private readonly destroy = inject(DestroyRef);
  private readonly changed = new Subject<void>();
  private generation = 0;
  private cursor: string | null = null;
  private slug = '';
  private readonly snapshot = signal<{
    key: string | null;
    loading: boolean;
    error: string;
    page: (TimelinePage & { excluded: number }) | null;
    notFound?: boolean;
  }>({ key: null, loading: false, error: '', page: null });
  private readonly current = computed(() => {
    const state = this.snapshot();
    return this.choices.matches(state.key) ? state : null;
  });
  readonly application = computed(
    () => this.current()?.page?.application ?? null
  );
  readonly notFound = computed(() => this.current()?.notFound ?? false);
  readonly items = computed(() => this.current()?.page?.items ?? []);
  readonly after = computed(() => this.current()?.page?.after ?? null);
  readonly excluded = computed(() => this.current()?.page?.excluded ?? 0);
  readonly loaded = computed(() => !!this.current()?.page);
  readonly loading = computed(
    () =>
      this.choices.current().status === 'loading' ||
      (this.choices.current().status === 'ready' &&
        (!this.current() || !!this.current()?.loading))
  );
  readonly error = computed(() =>
    this.choices.current().status === 'unavailable'
      ? 'Your saved choices could not be loaded. Retry your settings and favorites.'
      : this.current()?.error ?? ''
  );
  readonly order = computed(() => this.choices.current().selection.order);
  readonly personalizationDisabled = computed(
    () => !this.choices.current().selection.personalize
  );

  constructor() {
    this.choices.changes$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.reload());
  }
  reload(latest = false) {
    if (latest) this.cursor = null;
    this.changed.next();
    const generation = ++this.generation;
    const choices = this.choices.current();
    this.snapshot.set({
      key: choices.key,
      loading: false,
      error: '',
      page: null,
    });
    if (!this.slug) return;
    if (choices.status !== 'ready') return;
    this.snapshot.update((state) => ({ ...state, loading: true }));
    defer(() => this.port.read(this.slug, this.cursor))
      .pipe(take(1), takeUntil(this.changed), takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          if (
            generation !== this.generation ||
            !this.choices.matches(choices.key)
          )
            return;
          if (!result.ok) {
            this.snapshot.set({
              key: choices.key,
              loading: false,
              error:
                result.error instanceof TimelineMissingError
                  ? ''
                  : result.error.message,
              page: null,
              notFound: result.error instanceof TimelineMissingError,
            });
            return;
          }
          const items = selectExplorePage(
            result.value.items,
            choices.selection
          );
          this.snapshot.set({
            key: choices.key,
            loading: false,
            error: '',
            page: {
              ...result.value,
              items,
              excluded: result.value.items.length - items.length,
            },
          });
        },
        error: () => {
          if (
            generation === this.generation &&
            this.choices.matches(choices.key)
          )
            this.snapshot.set({
              key: choices.key,
              loading: false,
              page: null,
              error: 'Activity could not be loaded. Please try again.',
            });
        },
      });
  }
  open(slug: string, after: string | null) {
    this.slug = slug;
    this.cursor = after;
    this.reload();
  }
  retry() {
    if (!this.choices.retry()) this.reload();
  }
  older() {
    if (!this.loading() && this.after()) {
      this.cursor = this.after();
      this.reload();
    }
  }
}
