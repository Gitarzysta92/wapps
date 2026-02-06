import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { of, delay } from 'rxjs';
import { TuiIcon } from '@taiga-ui/core';
import {
  DiscussionStatsBadgeComponent,
  OpeningPostComponent,
  TopCommentComponent,
  type OpeningPostVM,
  type TopCommentVM,
} from '@portals/shared/features/discussion';
import { DISCUSSIONS } from '@portals/shared/data';

@Component({
  selector: 'discussion-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiIcon,
    DiscussionStatsBadgeComponent,
    OpeningPostComponent,
    TopCommentComponent,
  ],
  templateUrl: './discussion-page.component.html',
  styleUrl: './discussion-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscussionPageComponent {
  public readonly slug = input<string | null>(null, { alias: 'discussionSlug' });

  public readonly discussion = rxResource({
    request: () => this.slug(),
    loader: ({ request }) => {
      const thread = DISCUSSIONS.find((d) => d.slug === request) ?? null;
      return of(thread).pipe(delay(400));
    },
  });

  public readonly openingPost = computed<OpeningPostVM | null>(() => {
    const t = this.discussion.value();
    if (!t) return null;

    return {
      id: t.id,
      title: t.title,
      content: t.content,
      authorName: t.author.name,
      authorId: t.author.id,
      authorBadges: [],
      authorAvatarUrl: t.author.avatar?.url ?? '',
      date: t.publishedTime,
      engagement: {
        upvotes: t.upvotesCount ?? 0,
        downvotes: t.downvotesCount ?? 0,
        replies: t.repliesCount ?? (t.replies?.length ?? 0),
        views: t.viewsCount ?? 0,
      },
      tags: (t.tags ?? []).map((x) => ({ id: x.slug, name: x.name })),
      isPinned: t.isPinned ?? false,
      isLocked: false,
      isEdited: t.isEdited ?? false,
      editedAt: undefined,
    };
  });

  public readonly stats = computed(() => {
    const t = this.discussion.value();
    if (!t) return { participants: 0, views: 0 };
    return {
      participants: t.repliesCount ?? (t.replies?.length ?? 0),
      views: t.viewsCount ?? 0,
    };
  });

  public readonly topComments = computed<TopCommentVM[]>(() => {
    const t = this.discussion.value();
    if (!t) return [];

    return (t.replies ?? [])
      .slice(0, 5)
      .map((r) => ({
        content: r.content,
        authorName: r.author.name,
        authorBadges: [],
        authorAvatarUrl: r.author.avatar?.url ?? '',
        date: r.publishedTime,
        upvotes: r.upvotesCount ?? 0,
        discussionLink: `/discussions/${t.slug}`,
      }));
  });
}

