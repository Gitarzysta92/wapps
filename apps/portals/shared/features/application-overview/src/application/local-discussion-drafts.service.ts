import { inject, Injectable } from '@angular/core';
import type { DiscussionPostDto } from '@domains/discussion';
import {
  LOCAL_DISCUSSION_DRAFTS,
  LocalDiscussionDrafts,
  LocalDiscussionPost,
  LocalDiscussionThread,
} from './local-discussion-drafts.port';

@Injectable({ providedIn: 'root' })
export class LocalDiscussionDraftsService implements LocalDiscussionDrafts {
  private readonly drafts = inject(LOCAL_DISCUSSION_DRAFTS);

  threads(slug: string | null) {
    return this.drafts.threads(slug);
  }
  previews(slug: string | null) {
    return this.drafts.previews(slug);
  }
  create(slug: string, title: string, content: string) {
    return this.drafts.create(slug, title, content);
  }
  reply(
    appSlug: string,
    discussionSlug: string,
    content: string,
    replyToId?: string
  ) {
    return this.drafts.reply(appSlug, discussionSlug, content, replyToId);
  }

  replyTarget(
    thread: LocalDiscussionThread,
    post: LocalDiscussionPost
  ): DiscussionPostDto | null {
    return post.replyToId
      ? [thread, ...thread.replies].find(
          (candidate) => candidate.id === post.replyToId
        ) ?? null
      : null;
  }
}
