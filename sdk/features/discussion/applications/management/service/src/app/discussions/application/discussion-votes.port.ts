import type { DiscussionVoteState } from '@sdk/features/discussion/core';

export interface DiscussionVotesReader {
  /** Returns one consistent SQL snapshot, bound to the loaded thread revision. */
  read(
    discussionId: string,
    revision: number,
    identityId: string | null
  ): Promise<Map<string, DiscussionVoteState>>;
}
