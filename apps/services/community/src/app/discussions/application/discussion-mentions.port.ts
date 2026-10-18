import type { DiscussionMentionRecipient } from '@domains/community';

export interface DiscussionMentionDirectory {
  resolve(
    authorId: string,
    profileIds: string[]
  ): Promise<DiscussionMentionRecipient[]>;
}
