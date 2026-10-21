import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton, type TuiDialogContext } from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';
import {
  ApplicationContentStateComponent,
  readApplicationContent,
} from '@portals/shared/features/application-overview';
import { ApplicationDiscussionsService } from '../../application/application-discussions.service';
import { ApplicationDiscussionsComponent } from '../application-discussions.component';
import type { QuickDiscussionData } from './quick-discussion.service';

@Component({
  selector: 'discussion-quick-api-dialog',
  standalone: true,
  imports: [
    RouterLink,
    TuiButton,
    ApplicationDiscussionsComponent,
    ApplicationContentStateComponent,
  ],
  providers: [ApplicationDiscussionsService],
  templateUrl: './quick-discussion-api-dialog.component.html',
  styleUrl: './quick-discussion-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickDiscussionApiDialogComponent {
  readonly context =
    injectContext<TuiDialogContext<void, QuickDiscussionData>>();
  readonly discussions = inject(ApplicationDiscussionsService);
  readonly app = readApplicationContent(() => this.context.data.appSlug);
  readonly application = this.app.application;
  readonly title = computed(() =>
    this.application()
      ? this.discussions.items()[0]?.title ?? 'Discussion'
      : 'Discussion'
  );
  readonly threadId = this.context.data.discussionSlug;
  readonly threadLink = (id: string) =>
    `/apps/${
      this.application()?.slug ?? this.context.data.appSlug
    }/discussions/${id}`;
  constructor() {
    effect(() => {
      const id = this.application()?.id ?? null;
      untracked(() => this.discussions.open(id, this.threadId));
    });
  }
  close() {
    this.context.completeWith();
  }
}
