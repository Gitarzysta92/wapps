import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { LocalDiscussionsService } from '@portals/shared/features/application-overview';
import { QuickDiscussionService } from './quick-discussion.service';

@Component({
  selector: 'discussion-quick-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TuiButton],
  template: `
    <button tuiButton type="button" size="xs" appearance="flat" iconStart="@tui.message-circle"
      aria-haspopup="dialog" [attr.aria-label]="label()" (click)="open()">{{ count() }}</button>
  `,
})
export class QuickDiscussionButtonComponent {
  readonly appSlug = input.required<string>();
  readonly discussionSlug = input.required<string>();
  private readonly data = inject(LocalDiscussionsService);
  private readonly dialog = inject(QuickDiscussionService);
  private readonly thread = computed(() => this.data.threads(this.appSlug()).find(d => d.slug === this.discussionSlug()));
  readonly count = computed(() => this.thread()?.replies.length ?? 0);
  readonly label = computed(() => `Read and comment: ${this.thread()?.title ?? 'Discussion'} (${this.count()} replies)`);

  open(): void {
    this.dialog.open({ appSlug: this.appSlug(), discussionSlug: this.discussionSlug() });
  }
}
