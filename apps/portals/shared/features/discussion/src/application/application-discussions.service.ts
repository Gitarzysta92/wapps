import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  distinctUntilChanged,
  of,
  Subject,
  takeUntil,
  type Observable,
} from 'rxjs';
import { err, type Result } from '@sdk/kernel/standard';
import {
  publicCommentId,
  publicDiscussionReply,
  publicDiscussionTopic,
  discussionVote,
  discussionPinChange,
  type PublicApplicationDiscussion,
  type PublicApplicationDiscussionPage,
} from '@domains/discussion';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  APPLICATION_DISCUSSIONS,
  DiscussionRequestError,
  type ApplicationDiscussionCommand,
  type ApplicationDiscussionReceipt,
} from './application-discussions.port';
import { ApplicationDiscussionRecoveryService } from './application-discussion-recovery.service';

@Injectable()
export class ApplicationDiscussionsService {
  private readonly port = inject(APPLICATION_DISCUSSIONS);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly recovery = inject(ApplicationDiscussionRecoveryService);
  private readonly changed = new Subject<void>();
  private readonly reads = new Subject<void>();
  private applicationId: string | null = null;
  private threadId: string | null = null;
  private cursor: string | null = null;
  readonly items = signal<PublicApplicationDiscussion[]>([]);
  readonly next = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly signedIn = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly missing = signal(false);
  readonly pending = this.recovery.attempt;
  readonly sessionVersion = signal(0);
  readonly completed = signal(0);
  readonly accepted = signal<ApplicationDiscussionReceipt | null>(null);
  constructor() {
    this.session.token$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((key) => {
        this.changed.next();
        this.sessionVersion.update((value) => value + 1);
        this.signedIn.set(key !== null);
        this.feedback.set('');
        this.accepted.set(null);
        this.saving.set(false);
        this.reload(true);
      });
  }
  open(applicationId: string | null, threadId: string | null = null) {
    if (applicationId === this.applicationId && threadId === this.threadId)
      return;
    this.changed.next();
    this.saving.set(false);
    this.applicationId = applicationId;
    this.threadId = threadId;
    this.feedback.set('');
    this.accepted.set(null);
    this.reload(true);
  }
  reload(latest = false) {
    this.reads.next();
    this.items.set([]);
    this.error.set('');
    this.next.set(null);
    this.missing.set(false);
    this.loading.set(false);
    if (latest) this.cursor = null;
    if (!this.applicationId) return;
    this.loading.set(true);
    const request: Observable<
      Result<
        PublicApplicationDiscussion | PublicApplicationDiscussionPage,
        Error
      >
    > = this.threadId
      ? this.port.read(this.applicationId, this.threadId)
      : this.port.list(this.applicationId, this.cursor);
    request
      .pipe(
        takeUntil(this.reads),
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(err(new Error('Discussions could not be loaded. Try again.')))
        )
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result.ok) {
          const value = result.value;
          this.items.set('items' in value ? value.items : [value]);
          this.next.set('items' in value ? value.next : null);
        } else {
          this.error.set(result.error.message);
          this.missing.set(
            result.error instanceof DiscussionRequestError &&
              result.error.status === 404
          );
        }
      });
  }
  older() {
    if (this.next() && !this.loading()) {
      this.cursor = this.next();
      this.reload();
    }
  }
  change(command: ApplicationDiscussionCommand) {
    if (this.saving() || this.pending() || !this.signedIn()) return;
    try {
      publicCommentId(command.applicationId);
      if (command.applicationId !== this.applicationId)
        throw new Error('Reload the application before posting.');
      if ('id' in command) publicCommentId(command.id);
      if (
        'expectedRevision' in command &&
        (!Number.isSafeInteger(command.expectedRevision) ||
          command.expectedRevision < 1)
      )
        throw new Error('Reload the discussion before changing this post.');
      const validated: ApplicationDiscussionCommand =
        command.type === 'create'
          ? { ...command, content: publicDiscussionTopic(command.content) }
          : command.type === 'edit'
          ? {
              ...command,
              content: command.root
                ? publicDiscussionTopic(command.content)
                : publicDiscussionReply(command.content),
            }
          : command.type === 'reply'
          ? { ...command, content: publicDiscussionReply(command.content) }
          : command.type === 'vote'
          ? { ...command, value: discussionVote(command.value) }
          : command.type === 'pin'
          ? {
              ...command,
              ...discussionPinChange({
                pinned: command.pinned,
                expectedRevision: command.expectedRevision,
              }),
            }
          : { ...command };
      this.pending.set({ command: validated, key: crypto.randomUUID() });
      this.retry();
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Check your post.'
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
              new DiscussionRequestError(
                'The discussion change could not be confirmed. Retry the same request.',
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
          if (attempt.command.type !== 'vote' && attempt.command.type !== 'pin')
            this.completed.update((value) => value + 1);
          this.feedback.set(
            'Discussion change saved. Its public view may still be updating.'
          );
          if (attempt.command.applicationId === this.applicationId)
            this.accepted.set(result.value);
          this.reload(true);
        } else {
          if (
            !(result.error instanceof DiscussionRequestError) ||
            !result.error.uncertain
          )
            this.pending.set(null);
          this.error.set(result.error.message);
        }
      });
  }
}
