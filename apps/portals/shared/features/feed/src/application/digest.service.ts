import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, Subject, take, takeUntil } from 'rxjs';
import { selectDigest, type DigestSelection } from '@domains/feed';
import { DIGEST_PORT } from './digest.port';
import { FeedChoicesService } from './feed-choices.service';

@Injectable()
export class DigestService {
  private readonly port = inject(DIGEST_PORT);
  private readonly choices = inject(FeedChoicesService);
  private readonly destroy = inject(DestroyRef);
  private readonly changed = new Subject<void>();
  private generation = 0;
  private readonly snapshot = signal<{
    key: string | null;
    loading: boolean;
    error: string;
    content: DigestSelection | null;
  }>({ key: null, loading: false, error: '', content: null });
  private readonly current = computed(() => {
    const state = this.snapshot();
    return this.choices.matches(state.key) ? state : null;
  });
  readonly content = computed(() => this.current()?.content ?? null);
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
  reload() {
    this.changed.next();
    const generation = ++this.generation;
    const choices = this.choices.current();
    this.snapshot.set({
      key: choices.key,
      loading: false,
      error: '',
      content: null,
    });
    if (choices.status !== 'ready') return;
    this.snapshot.update((state) => ({ ...state, loading: true }));
    defer(() => this.port.read())
      .pipe(take(1), takeUntil(this.changed), takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          if (
            generation !== this.generation ||
            !this.choices.matches(choices.key)
          )
            return;
          this.snapshot.set({
            key: choices.key,
            loading: false,
            error: result.ok ? '' : result.error.message,
            content: result.ok
              ? selectDigest(result.value, choices.selection)
              : null,
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
              content: null,
              error: 'Digest could not be loaded. Please try again.',
            });
        },
      });
  }
  retry() {
    if (!this.choices.retry()) this.reload();
  }
}
