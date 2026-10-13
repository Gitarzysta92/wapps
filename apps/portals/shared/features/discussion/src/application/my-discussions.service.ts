import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  defer,
  distinctUntilChanged,
  of,
  Subject,
  takeUntil,
} from 'rxjs';
import { err } from '@sdk/kernel/standard';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { MY_DISCUSSIONS, type MyDiscussionView } from './my-discussions.port';

@Injectable()
export class MyDiscussionsService {
  private readonly port = inject(MY_DISCUSSIONS);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly changed = new Subject<void>();
  private cursor: string | null = null;
  readonly items = signal<MyDiscussionView[]>([]);
  readonly next = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly signedIn = signal(false);
  readonly olderPage = signal(false);

  constructor() {
    this.session.token$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((token) => {
        this.signedIn.set(token !== null);
        this.reload(true);
      });
  }

  reload(latest = false) {
    this.changed.next();
    this.items.set([]);
    this.next.set(null);
    this.error.set('');
    this.loading.set(false);
    if (latest) this.cursor = null;
    this.olderPage.set(this.cursor !== null);
    const token = this.session.getToken();
    if (!token) return;
    this.loading.set(true);
    defer(() => this.port.list(this.cursor))
      .pipe(
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(err(new Error('Your discussions could not be loaded. Try again.')))
        )
      )
      .subscribe((result) => {
        if (token !== this.session.getToken()) return;
        this.loading.set(false);
        if (result.ok) {
          this.items.set(result.value.items);
          this.next.set(result.value.next);
        } else this.error.set(result.error.message);
      });
  }

  older() {
    if (this.next() && !this.loading()) {
      this.cursor = this.next();
      this.reload();
    }
  }
}
