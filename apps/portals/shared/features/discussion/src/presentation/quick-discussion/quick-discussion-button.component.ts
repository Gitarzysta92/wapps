import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import {
  LOCAL_APPLICATION_DATA,
  LocalDiscussionDraftsService,
} from '@portals/shared/features/application-overview';
import { QuickDiscussionService } from './quick-discussion.service';

@Component({
  selector: 'discussion-quick-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TuiButton],
  template: `
    <button
      tuiButton
      type="button"
      size="xs"
      appearance="flat"
      iconStart="@tui.message-circle"
      aria-haspopup="dialog"
      [attr.aria-label]="label()"
      (click)="open()"
      [disabled]="loading()"
    >
      {{ count() === null ? 'Quick discussion' : count() }}
    </button>
    @if (error()) { <span role="alert">{{ error() }}</span> }
  `,
})
export class QuickDiscussionButtonComponent {
  readonly appSlug = input.required<string>();
  readonly discussionSlug = input.required<string>();
  readonly replyCount = input<number | null>(null);
  readonly topicTitle = input('Discussion');
  readonly closed = output<void>();
  private readonly demo = inject(LOCAL_APPLICATION_DATA);
  private readonly data = inject(LocalDiscussionDraftsService);
  private readonly dialog = inject(QuickDiscussionService);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly thread = computed(() =>
    this.demo
      ? this.data
          .threads(this.appSlug())
          .find((d) => d.slug === this.discussionSlug())
      : undefined
  );
  readonly count = computed(() => {
    if (this.demo) return this.thread()?.replies.length ?? 0;
    const value = this.replyCount();
    return value !== null &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= 1999
      ? value
      : null;
  });
  readonly label = computed(
    () =>
      `Read and comment: ${this.thread()?.title ?? this.topicTitle()}${
        this.count() === null ? '' : ` (${this.count()} replies)`
      }`
  );

  async open(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.dialog.open({
        appSlug: this.appSlug(),
        discussionSlug: this.discussionSlug(),
      });
      this.closed.emit();
    } catch {
      this.error.set('The discussion could not be opened. Try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
