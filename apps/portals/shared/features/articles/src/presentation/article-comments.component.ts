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
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';
import type { PublicComment, PublicCommentThread } from '@domains/discussion';
import { ArticleCommentsService } from '../application/article-comments.service';
import { provideArticleComments } from '../article-comments.providers';

type EditingComment = {
  type: 'reply' | 'edit';
  id: string;
  revision: number;
  label: string;
};
@Component({
  selector: 'article-comments',
  standalone: true,
  imports: [
    MentionMemberPickerComponent,
    MentionedMembersComponent,
    DatePipe,
    FormsModule,
    TuiAppearance,
    TuiButton,
  ],
  providers: [provideArticleComments()],
  templateUrl: './article-comments.component.html',
  styleUrl: './article-comments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleCommentsComponent {
  readonly articleId = input.required<string>();
  readonly threadId = input<string | null>(null);
  readonly comments = inject(ArticleCommentsService);
  readonly name = signal('');
  readonly text = signal('');
  readonly mentions = signal<string[]>([]);
  readonly editing = signal<EditingComment | null>(null);
  readonly removing = signal<{
    comment: PublicComment;
    revision: number;
  } | null>(null);
  private readonly body =
    viewChild<ElementRef<HTMLTextAreaElement>>('commentBody');
  constructor() {
    effect(() => {
      const id = this.articleId();
      const thread = this.threadId();
      this.comments.sessionVersion();
      untracked(() => {
        this.name.set('');
        this.text.set('');
        this.mentions.set([]);
        this.editing.set(null);
        this.removing.set(null);
        this.comments.open(id, thread);
      });
    });
    effect(() => {
      this.comments.completed();
      untracked(() => {
        this.text.set('');
        this.mentions.set([]);
        this.editing.set(null);
        this.removing.set(null);
      });
    });
  }
  submit() {
    const editing = this.editing(),
      content = {
        displayName: this.name(),
        text: this.text(),
        ...(this.mentions().length ? { mentions: this.mentions() } : {}),
      },
      articleId = this.articleId();
    if (!editing) {
      if (this.threadId() !== null) return;
      this.comments.change({ type: 'create', articleId, content });
    } else if (editing.type === 'reply')
      this.comments.change({
        type: 'reply',
        articleId,
        id: editing.id,
        content,
      });
    else
      this.comments.change({
        type: 'edit',
        articleId,
        id: editing.id,
        expectedRevision: editing.revision,
        content,
      });
  }
  select(
    type: EditingComment['type'],
    comment: PublicComment,
    thread: PublicCommentThread
  ) {
    if (!comment.content || this.comments.saving() || this.comments.pending())
      return;
    this.editing.set({
      type,
      id: comment.id,
      revision: thread.revision,
      label: comment.content.displayName,
    });
    this.mentions.set(type === 'edit' ? comment.content.mentions ?? [] : []);
    if (type === 'edit') {
      this.name.set(comment.content.displayName);
      this.text.set(comment.content.text);
    }
    this.body()?.nativeElement.focus();
  }
  parentLabel(comment: PublicComment, thread: PublicCommentThread) {
    return (
      thread.comments.find((item) => item.id === comment.parentId)?.content
        ?.displayName ?? 'removed comment'
    );
  }
  remove() {
    const selected = this.removing();
    this.removing.set(null);
    if (selected)
      this.comments.change({
        type: 'remove',
        articleId: this.articleId(),
        id: selected.comment.id,
        expectedRevision: selected.revision,
      });
  }
}
