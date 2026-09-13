import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiDialogContext } from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';
import { LOCAL_APPLICATION_DATA, LocalDiscussionsService } from '@portals/shared/features/application-overview';
import { DiscussionThreadComponent, DiscussionPostComponent, DiscussionPostHeaderComponent, DiscussionExpandablePostContentComponent } from '@ui/discussion';
import { ContentStateComponent } from '@ui/layout';
import type { QuickDiscussionData } from './quick-discussion.service';
import { LocalDiscussionReplyComponent } from '../local-discussion-reply/local-discussion-reply.component';

@Component({
  selector: 'discussion-quick-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TuiButton, LocalDiscussionReplyComponent,
    DiscussionThreadComponent, DiscussionPostComponent, DiscussionPostHeaderComponent, DiscussionExpandablePostContentComponent, ContentStateComponent],
  templateUrl: './quick-discussion-dialog.component.html',
  styleUrl: './quick-discussion-dialog.component.scss',
})
export class QuickDiscussionDialogComponent {
  readonly context = injectContext<TuiDialogContext<void, QuickDiscussionData>>();
  readonly data = inject(LocalDiscussionsService);
  private readonly injector = inject(Injector);
  readonly localMode = inject(LOCAL_APPLICATION_DATA);
  readonly appSlug = this.context.data.appSlug;
  readonly thread = computed(() => this.data.threads(this.appSlug).find(d => d.slug === this.context.data.discussionSlug));
  readonly activeReplyId = signal<string | null>(null);
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  close(): void { this.context.completeWith(); }

  scrollToLatest(): void {
    afterNextRender(() => {
      const element = this.body()?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    }, { injector: this.injector });
  }
}
