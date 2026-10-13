import {
  MentionMemberPickerComponent,
  MentionedMembersComponent,
} from '@portals/shared/features/user-profile';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import type {
  PublicComment,
  PublicApplicationDiscussion,
  DiscussionVote,
} from '@domains/discussion';
import { ApplicationDiscussionsService } from '../application/application-discussions.service';
import { QuickDiscussionButtonComponent } from './quick-discussion/quick-discussion-button.component';
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';

type EditingPost = {
  type: 'reply' | 'edit';
  id: string;
  revision: number;
  root: boolean;
  label: string;
};

@Component({
  selector: 'application-discussions',
  standalone: true,
  imports: [
    MentionMemberPickerComponent,
    MentionedMembersComponent,
    DatePipe,
    SlicePipe,
    FormsModule,
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiLink,
    QuickDiscussionButtonComponent,
    FavoriteToggleButtonComponent,
  ],
  templateUrl: './application-discussions.component.html',
  styleUrl: './application-discussions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationDiscussionsComponent {
  readonly applicationId = input.required<string>();
  readonly threadId = input<string | null>(null);
  readonly threadLink = input.required<(id: string) => string>();
  readonly applicationSlug = input<string | null>(null);
  readonly idPrefix = input('application-discussion');
  readonly discussions = inject(ApplicationDiscussionsService);
  readonly name = signal('');
  readonly title = signal('');
  readonly tags = signal('');
  readonly text = signal('');
  readonly mentions = signal<string[]>([]);
  readonly editing = signal<EditingPost | null>(null);
  readonly removing = signal<{
    comment: PublicComment;
    revision: number;
  } | null>(null);
  private readonly body =
    viewChild<ElementRef<HTMLTextAreaElement>>('postBody');
  constructor() {
    effect(() => {
      this.applicationId();
      this.threadId();
      this.discussions.sessionVersion();
      untracked(() => {
        this.name.set('');
        this.reset();
      });
    });
    effect(() => {
      this.discussions.completed();
      untracked(() => this.reset());
    });
  }
  private reset() {
    this.text.set('');
    this.title.set('');
    this.tags.set('');
    this.mentions.set([]);
    this.editing.set(null);
    this.removing.set(null);
  }
  submit() {
    const applicationId = this.applicationId(),
      editing = this.editing();
    const content = {
      displayName: this.name(),
      text: this.text(),
      ...(this.mentions().length ? { mentions: this.mentions() } : {}),
    };
    const topic = {
      ...content,
      title: this.title(),
      tags: this.tags().trim()
        ? this.tags()
            .split(',')
            .map((tag) => tag.trim())
        : [],
    };
    if (editing?.type === 'edit') {
      this.discussions.change({
        type: 'edit',
        applicationId,
        id: editing.id,
        root: editing.root,
        expectedRevision: editing.revision,
        content: editing.root ? topic : content,
      });
    } else if (editing || this.threadId()) {
      const id = editing?.id ?? this.threadId();
      if (id)
        this.discussions.change({ type: 'reply', applicationId, id, content });
    } else
      this.discussions.change({
        type: 'create',
        applicationId,
        content: topic,
      });
  }
  select(
    type: EditingPost['type'],
    comment: PublicComment,
    thread: PublicApplicationDiscussion
  ) {
    if (
      !comment.content ||
      this.discussions.saving() ||
      this.discussions.pending()
    )
      return;
    this.editing.set({
      type,
      id: comment.id,
      revision: thread.revision,
      root: comment.depth === 0,
      label: comment.content.displayName,
    });
    this.mentions.set(type === 'edit' ? comment.content.mentions ?? [] : []);
    if (type === 'edit') {
      this.name.set(comment.content.displayName);
      this.text.set(comment.content.text);
      this.title.set(thread.title);
      this.tags.set(thread.tags.join(', '));
    }
    this.body()?.nativeElement.focus();
  }
  parentLabel(comment: PublicComment, thread: PublicApplicationDiscussion) {
    return (
      thread.comments.find((item) => item.id === comment.parentId)?.content
        ?.displayName ?? 'removed post'
    );
  }
  remove() {
    const selected = this.removing();
    this.removing.set(null);
    if (selected)
      this.discussions.change({
        type: 'remove',
        applicationId: this.applicationId(),
        id: selected.comment.id,
        expectedRevision: selected.revision,
      });
  }

  vote(
    comment: PublicComment,
    thread: PublicApplicationDiscussion,
    value: DiscussionVote
  ) {
    if (!comment.content || !comment.votes) return;
    this.discussions.change({
      type: 'vote',
      applicationId: this.applicationId(),
      id: comment.id,
      expectedRevision: thread.revision,
      value: comment.votes.mine === value ? 0 : value,
    });
  }

  pin(thread: PublicApplicationDiscussion) {
    if (!thread.canPin) return;
    this.discussions.change({
      type: 'pin',
      applicationId: this.applicationId(),
      id: thread.id,
      expectedRevision: thread.revision,
      pinned: !thread.pinned,
    });
  }
}
