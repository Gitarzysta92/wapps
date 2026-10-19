import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, Subject, take, takeUntil } from 'rxjs';
import { selectExplorePage, type ExplorePage } from '@domains/feed';
import { EXPLORE_PORT } from './explore.port';
import { FeedChoicesService } from './feed-choices.service';

@Injectable()
export class ExploreService {
  private readonly port = inject(EXPLORE_PORT);
  private readonly choices = inject(FeedChoicesService);
  private readonly destroy = inject(DestroyRef);
  private readonly changed = new Subject<void>();
  private generation = 0;
  private cursor: string | null = null;
  private retryAppend = false;
  private readonly snapshot = signal<{
    key: string | null;
    loading: boolean;
    error: string;
    page: (ExplorePage & { excluded: number }) | null;
  }>({ key: null, loading: false, error: '', page: null });
  private readonly current = computed(() => {
    const state = this.snapshot();
    return this.choices.matches(state.key) ? state : null;
  });
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
      .subscribe(() => this.reload(this.retryAppend));
  }
  reload(latest = false, append = false) {
    if (latest) this.cursor = null;
    const previous = append ? this.current()?.page ?? null : null;
    this.retryAppend = append;
    this.changed.next();
    const generation = ++this.generation;
    const choices = this.choices.current();
    this.snapshot.set({
      key: choices.key,
      loading: false,
      error: '',
      page: previous,
    });
    if (choices.status !== 'ready') return;
    this.snapshot.update((state) => ({ ...state, loading: true }));
    defer(() => this.port.read(this.cursor))
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
              error: result.error.message,
              page: previous,
            });
            return;
          }
          if (
            append &&
            result.value.after &&
            result.value.after === this.cursor
          ) {
            this.snapshot.set({
              key: choices.key,
              loading: false,
              error: 'Activity did not advance. Retry or refresh the feed.',
              page: previous,
            });
            return;
          }
          const items = selectExplorePage(
            result.value.items,
            choices.selection
          );
          const seen = new Set(
            previous?.items.map((item) => `${item.kind}:${item.id}`)
          );
          const nextItems = items.filter(
            (item) => !seen.has(`${item.kind}:${item.id}`)
          );
          this.snapshot.set({
            key: choices.key,
            loading: false,
            error: '',
            page: {
              ...result.value,
              items: [...(previous?.items ?? []), ...nextItems],
              excluded:
                (previous?.excluded ?? 0) +
                result.value.items.length -
                items.length,
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
              page: previous,
              error: 'Activity could not be loaded. Please try again.',
            });
        },
      });
  }
  open(after: string | null) {
    this.cursor = after;
    this.reload();
  }
  retry() {
    if (!this.choices.retry()) this.reload(false, this.retryAppend);
  }
  more() {
    if (!this.loading() && !this.error() && this.after()) {
      this.cursor = this.after();
      this.reload(false, true);
    }
  }
  older() {
    if (!this.loading() && this.after()) {
      this.cursor = this.after();
      this.reload();
    }
  }
}
