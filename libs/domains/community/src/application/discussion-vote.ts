import { commentObject, PublicCommentInputError } from './public-comment';

export type DiscussionVote = -1 | 0 | 1;
export interface DiscussionVoteState {
  upvotes: number;
  downvotes: number;
  mine: DiscussionVote;
}

export function discussionVote(input: unknown): DiscussionVote {
  if (input !== -1 && input !== 0 && input !== 1)
    throw new PublicCommentInputError('Choose an upvote, downvote or no vote');
  return input;
}

export function discussionVoteChange(input: unknown): {
  value: DiscussionVote;
  expectedRevision: number;
} {
  const row = commentObject(input, ['value', 'expectedRevision']);
  const revision = row['expectedRevision'];
  if (
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    throw new PublicCommentInputError(
      'A positive expected revision is required'
    );
  return { value: discussionVote(row['value']), expectedRevision: revision };
}

export function discussionVoteState(input: unknown): DiscussionVoteState {
  const row = commentObject(input, ['upvotes', 'downvotes', 'mine']);
  const upvotes = row['upvotes'],
    downvotes = row['downvotes'];
  if (
    typeof upvotes !== 'number' ||
    !Number.isSafeInteger(upvotes) ||
    upvotes < 0 ||
    typeof downvotes !== 'number' ||
    !Number.isSafeInteger(downvotes) ||
    downvotes < 0
  )
    throw new PublicCommentInputError('Invalid discussion vote totals');
  const mine = discussionVote(row['mine']);
  if ((mine === 1 && upvotes === 0) || (mine === -1 && downvotes === 0))
    throw new PublicCommentInputError('Inconsistent discussion vote totals');
  return { upvotes, downvotes, mine };
}
