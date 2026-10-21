import { InjectionToken } from '@angular/core';
import type {
  DiscussionPostDto,
  DiscussionPreviewDto,
  DiscussionThreadDto,
} from '@domains/discussion';

export type LocalDiscussionPost = (DiscussionPostDto | DiscussionThreadDto) & {
  replyToId?: string;
};
export type LocalDiscussionThread = Omit<DiscussionThreadDto, 'replies'> & {
  replies: LocalDiscussionPost[];
};

/** Browser-local demo data only; this port does not represent server discussions. */
export interface LocalDiscussionDrafts {
  threads(slug: string | null): LocalDiscussionThread[];
  previews(slug: string | null): DiscussionPreviewDto[];
  create(slug: string, title: string, content: string): DiscussionThreadDto;
  reply(
    appSlug: string,
    discussionSlug: string,
    content: string,
    replyToId?: string
  ): void;
}

const unavailable = () => {
  throw new Error('Local discussion drafts require explicit demo mode');
};
export const disabledLocalDiscussionDrafts: LocalDiscussionDrafts =
  Object.freeze({
    threads: () => [],
    previews: () => [],
    create: unavailable,
    reply: unavailable,
  });

export const LOCAL_DISCUSSION_DRAFTS =
  new InjectionToken<LocalDiscussionDrafts>('LOCAL_DISCUSSION_DRAFTS', {
    factory: () => disabledLocalDiscussionDrafts,
  });
