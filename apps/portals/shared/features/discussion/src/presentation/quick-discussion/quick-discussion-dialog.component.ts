import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiDialogContext, TuiError, TuiTextfield } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import { LOCAL_APPLICATION_DATA, LocalDiscussionsService } from '@portals/shared/features/application-overview';
import { DiscussionThreadComponent, DiscussionPostComponent, DiscussionPostHeaderComponent, DiscussionExpandablePostContentComponent } from '@ui/discussion';
import { ContentStateComponent } from '@ui/layout';
import type { QuickDiscussionData } from './quick-discussion.service';

@Component({
  selector: 'discussion-quick-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, TuiButton, TuiError, TuiTextfield, TuiTextarea,
    DiscussionThreadComponent, DiscussionPostComponent, DiscussionPostHeaderComponent, DiscussionExpandablePostContentComponent, ContentStateComponent],
  templateUrl: './quick-discussion-dialog.component.html',
  styleUrl: './quick-discussion-dialog.component.scss',
})
export class QuickDiscussionDialogComponent {
  readonly context = injectContext<TuiDialogContext<void, QuickDiscussionData>>();
  private readonly data = inject(LocalDiscussionsService);
  private readonly injector = inject(Injector);
  readonly localMode = inject(LOCAL_APPLICATION_DATA);
  readonly appSlug = this.context.data.appSlug;
  readonly thread = computed(() => this.data.threads(this.appSlug).find(d => d.slug === this.context.data.discussionSlug));
  readonly reply = signal('');
  readonly saveError = signal('');
  readonly saved = signal(false);
  readonly canSubmit = computed(() => this.localMode && !!this.thread() && !!this.reply().trim() && this.reply().trim().length <= 5000);
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  edit(value: string): void {
    this.reply.set(value);
    this.saveError.set('');
    this.saved.set(false);
  }

  saveReply(): void {
    const topic = this.thread();
    if (!topic || !this.canSubmit()) return;
    try {
      this.data.reply(this.appSlug, topic.slug, this.reply());
      this.reply.set('');
      this.saveError.set('');
      this.saved.set(true);
      this.scrollToLatest();
    } catch {
      this.saveError.set('Could not save on this device. Your comment is kept here; try again.');
    }
  }

  close(): void { this.context.completeWith(); }

  private scrollToLatest(): void {
    afterNextRender(() => {
      const element = this.body()?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    }, { injector: this.injector });
  }
}
