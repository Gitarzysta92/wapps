import type { PublicCommentThread } from '@sdk/features/discussion/core';
import {
  PublicDiscussions,
  type PublicDiscussionIndex,
} from './public-discussions';
import { DurableDiscussionCommands } from './durable-discussion-commands';
import { DiscussionQueries } from './discussion-queries';
import type { DiscussionWriteRepository } from './discussion-write.port';
import type { DiscussionTargets } from './discussion-targets.port';

export type {
  PublicDiscussionCursor as ArticleCommentCursor,
  PublicDiscussionIndex as ArticleCommentThreads,
} from './public-discussions';

export class ArticleComments extends PublicDiscussions<PublicCommentThread> {
  constructor(
    commands: DurableDiscussionCommands,
    queries: DiscussionQueries,
    writes: DiscussionWriteRepository,
    threads: PublicDiscussionIndex,
    targets: DiscussionTargets,
    publicTenant: string
  ) {
    super(commands, queries, writes, threads, targets, publicTenant, {
      kind: 'article',
      thread: (value) => value,
    });
  }
}
