import type { DiscussionMentionRecipient } from '@sdk/features/discussion/core';

export interface DiscussionMentionDirectory {
  resolve(
    authorId: string,
    profileIds: string[]
  ): Promise<DiscussionMentionRecipient[]>;
}
