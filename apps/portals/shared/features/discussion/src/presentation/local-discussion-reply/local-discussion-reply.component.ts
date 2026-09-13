import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiError, TuiTextfield } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { TuiAutoFocus } from '@taiga-ui/cdk';
import { LOCAL_APPLICATION_DATA, LocalDiscussionsService } from '@portals/shared/features/application-overview';
import { DiscussionReplyButtonComponent, type DiscussionPostVM } from '@ui/discussion';

@Component({
  selector: 'discussion-local-reply',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TuiButton, TuiError, TuiTextfield, TuiTextarea, TuiAutoFocus, DiscussionReplyButtonComponent],
  templateUrl: './local-discussion-reply.component.html',
  styleUrl: './local-discussion-reply.component.scss',
})
export class LocalDiscussionReplyComponent {
  readonly appSlug = input.required<string>();
  readonly discussionSlug = input.required<string>();
  readonly post = input.required<DiscussionPostVM>();
  readonly expanded = model(false);
  readonly replied = output<void>();
  readonly localMode = inject(LOCAL_APPLICATION_DATA);
  private readonly data = inject(LocalDiscussionsService);
  private readonly trigger = viewChild('trigger', { read: ElementRef });
  readonly draft = signal('');
  readonly saveError = signal('');
  readonly saved = signal(false);
  readonly canSubmit = computed(() => this.localMode && !!this.draft().trim() && this.draft().trim().length <= 5000);
  readonly guidanceId = computed(() => `reply-guidance-${this.post().id}`);
  private readonly replyKey = computed(() => `${this.appSlug()}/${this.discussionSlug()}/${this.post().id}`);

  constructor() {
    effect(() => {
      this.replyKey();
      this.edit('');
    });
  }

  edit(value: string | null): void {
    this.draft.set(value ?? '');
    this.saveError.set('');
    this.saved.set(false);
  }

  saveReply(): void {
    if (!this.expanded() || !this.canSubmit()) return;
    try {
      this.data.reply(this.appSlug(), this.discussionSlug(), this.draft(), this.post().id);
      this.edit('');
      this.saved.set(true);
      this.close();
      this.replied.emit();
    } catch {
      this.saveError.set('Could not save on this device. Your reply is kept here; try again.');
    }
  }

  cancel(): void { this.edit(''); this.close(); }

  private close(): void {
    this.expanded.set(false);
    this.trigger()?.nativeElement.querySelector('button')?.focus({ preventScroll: true });
  }
}
