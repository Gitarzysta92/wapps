import { DestroyRef, Injectable, inject, signal } from '@angular/core';
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
import type { ReplyInboxItem } from '@domains/discussion';
import { AUTHENTICATION_SESSION } from './authentication-session.port';
import { REPLY_INBOX } from './reply-inbox.port';

@Injectable()
export class ReplyInboxService {
  private readonly port = inject(REPLY_INBOX);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly changed = new Subject<void>();
  private cursor: string | null = null;
  private generation = 0;
  readonly items = signal<ReplyInboxItem[]>([]);
  readonly next = signal<string | null>(null);
  readonly loading = signal(false);
  readonly reading = signal<string | null>(null);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly signedIn = signal(false);
  readonly enabled = signal(true);
  readonly olderPage = signal(false);

  constructor() {
    this.session.token$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((token) => {
        this.signedIn.set(!!token);
        this.reload(true);
      });
  }
  reload(latest = false): void {
    this.changed.next();
    const generation = ++this.generation;
    this.items.set([]);
    this.next.set(null);
    this.error.set('');
    this.feedback.set('');
    this.loading.set(false);
    this.reading.set(null);
    this.enabled.set(true);
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
          of(err(new Error('Notifications could not be loaded. Try again.')))
        )
      )
      .subscribe((result) => {
        if (generation !== this.generation || token !== this.session.getToken())
          return;
        this.loading.set(false);
        if (result.ok) {
          this.enabled.set(result.value.enabled);
          this.items.set(result.value.items);
          this.next.set(result.value.next);
        } else this.error.set(result.error.message);
      });
  }
  older(): void {
    if (!this.loading() && !this.reading() && this.next()) {
      this.cursor = this.next();
      this.reload();
    }
  }
  markRead(id: string): void {
    const token = this.session.getToken(),
      item = this.items().find((row) => row.id === id);
    if (
      !token ||
      !item ||
      item.readAt !== null ||
      this.loading() ||
      this.reading()
    )
      return;
    const generation = this.generation;
    this.reading.set(id);
    this.feedback.set('');
    defer(() => this.port.markRead(id))
      .pipe(
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(
            err(
              new Error(
                'The read receipt could not be confirmed. Refresh before trying again.'
              )
            )
          )
        )
      )
      .subscribe((result) => {
        if (generation !== this.generation || token !== this.session.getToken())
          return;
        this.reading.set(null);
        if (
          result.ok &&
          result.value.id === id &&
          result.value.readAt >= item.at
        ) {
          this.items.update((items) =>
            items.map((row) =>
              row.id === id ? { ...row, readAt: result.value.readAt } : row
            )
          );
          this.feedback.set('Notification marked as read.');
        } else {
          this.items.set([]);
          this.next.set(null);
          this.error.set(
            result.ok
              ? 'The read receipt was incomplete. Refresh your inbox.'
              : result.error.message
          );
        }
      });
  }
}
