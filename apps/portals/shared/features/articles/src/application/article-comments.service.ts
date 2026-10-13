import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, of, Subject, takeUntil } from 'rxjs';
import { err } from '@sdk/kernel/standard';
import {
  publicCommentContent,
  publicCommentId,
  type PublicCommentThread,
} from '@domains/discussion';
import { ARTICLE_SESSION, ArticleRequestError } from './article-workspace.port';
import {
  ARTICLE_COMMENTS,
  type ArticleCommentCommand,
} from './article-comments.port';
import { ArticleCommentRecoveryService } from './article-comment-recovery.service';

@Injectable()
export class ArticleCommentsService {
  private readonly port = inject(ARTICLE_COMMENTS);
  private readonly session = inject(ARTICLE_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly recovery = inject(ArticleCommentRecoveryService);
  private readonly changed = new Subject<void>();
  private readonly reads = new Subject<void>();
  private id: string | null = null;
  private cursor: string | null = null;
  private thread: string | null = null;
  readonly items = signal<PublicCommentThread[]>([]);
  readonly next = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly signedIn = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly pending = this.recovery.attempt;
  readonly sessionVersion = signal(0);
  readonly completed = signal(0);
  readonly expanded = signal<string[]>([]);
  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((key) => {
        this.changed.next();
        this.reads.next();
        this.sessionVersion.update((value) => value + 1);
        this.signedIn.set(key !== null);
        this.items.set([]);
        this.expanded.set([]);
        this.error.set('');
        this.feedback.set('');
        this.saving.set(false);
        if (this.id) this.reload();
      });
  }
  open(id: string, thread: string | null = null) {
    if (id !== this.id || thread !== this.thread) {
      this.id = id;
      this.thread = thread;
      this.cursor = null;
      this.reload();
    }
  }
  reload(latest = false) {
    this.reads.next();
    this.items.set([]);
    this.expanded.set([]);
    this.error.set('');
    this.next.set(null);
    if (latest) this.cursor = null;
    if (!this.id) return;
    if (this.thread !== null) {
      try {
        publicCommentId(this.thread);
      } catch {
        this.loading.set(false);
        this.error.set('This comment thread link is invalid.');
        return;
      }
      this.loading.set(true);
      const thread = this.thread;
      this.port
        .read(this.id, thread)
        .pipe(
          takeUntil(this.reads),
          takeUntil(this.changed),
          takeUntilDestroyed(this.destroy),
          catchError(() =>
            of(
              err(
                new Error('The comment thread could not be loaded. Try again.')
              )
            )
          )
        )
        .subscribe((result) => {
          this.loading.set(false);
          if (result.ok) {
            this.items.set([result.value]);
            this.expanded.set([thread]);
          } else this.error.set(result.error.message);
        });
      return;
    }
    this.loading.set(true);
    this.port
      .list(this.id, this.cursor)
      .pipe(
        takeUntil(this.reads),
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(err(new Error('Comments could not be loaded. Try again.')))
        )
      )
      .subscribe((result) => {
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
  expand(id: string) {
    if (!this.id || this.loading()) return;
    this.reads.next();
    this.loading.set(true);
    this.error.set('');
    this.port
      .read(this.id, id)
      .pipe(
        takeUntil(this.reads),
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(
            err(new Error('The comment thread could not be loaded. Try again.'))
          )
        )
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result.ok) {
          this.items.update((items) =>
            items.map((item) => (item.id === id ? result.value : item))
          );
          this.expanded.update((ids) => [...new Set([...ids, id])]);
        } else {
          this.items.set([]);
          this.error.set(result.error.message);
        }
      });
  }
  change(command: ArticleCommentCommand) {
    if (this.saving() || this.pending() || !this.signedIn()) return;
    try {
      publicCommentId(command.articleId);
      if ('id' in command) publicCommentId(command.id);
      if (
        'expectedRevision' in command &&
        (!Number.isSafeInteger(command.expectedRevision) ||
          command.expectedRevision < 1)
      )
        throw new Error('Reload the thread before changing this comment.');
      const validated =
        'content' in command
          ? { ...command, content: publicCommentContent(command.content) }
          : command;
      this.pending.set({ command: { ...validated }, key: crypto.randomUUID() });
      this.retry();
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Check your comment.'
      );
    }
  }
  retry() {
    const attempt = this.pending();
    if (!attempt || this.saving() || !this.signedIn()) return;
    this.saving.set(true);
    this.error.set('');
    this.feedback.set('');
    this.port
      .change(attempt.command, attempt.key)
      .pipe(
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(
            err(
              new ArticleRequestError(
                'The comment change could not be confirmed. Retry the same request.',
                true
              )
            )
          )
        )
      )
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.pending.set(null);
          this.completed.update((value) => value + 1);
          this.feedback.set(
            'Comment change saved. Its public view may still be updating.'
          );
          this.reload(true);
        } else {
          if (
            !(result.error instanceof ArticleRequestError) ||
            !result.error.uncertain
          )
            this.pending.set(null);
          this.error.set(result.error.message);
        }
      });
  }
}
