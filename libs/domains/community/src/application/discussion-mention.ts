import {
  commentObject,
  publicCommentId,
  PublicCommentInputError,
} from './public-comment';
import { notificationRecipient } from './reply-notification';

export const DISCUSSION_MENTION_LIMIT = 10;

/** Public content references profile IDs; private delivery resolves canonical recipients separately. */
export function discussionMentionProfiles(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > DISCUSSION_MENTION_LIMIT)
    throw new PublicCommentInputError('Choose at most ten mentioned members');
  const ids = value.map(publicCommentId);
  if (new Set(ids).size !== ids.length)
    throw new PublicCommentInputError('Mentioned members must be distinct');
  return ids.sort();
}

export interface DiscussionMentionRecipient {
  profileId: string;
  identityId: string;
}

export function discussionMentionResolution(value: unknown): {
  authorId: string;
  profileIds: string[];
} {
  const input = commentObject(value, ['authorId', 'profileIds']);
  return {
    authorId: notificationRecipient(input['authorId']),
    profileIds: discussionMentionProfiles(input['profileIds']),
  };
}

export function discussionMentionRecipients(
  value: unknown,
  requested: string[]
): DiscussionMentionRecipient[] {
  const ids = discussionMentionProfiles(requested);
  if (!Array.isArray(value) || value.length > ids.length)
    throw new PublicCommentInputError('Invalid mention recipients');
  const result = value.map((input) => {
    const row = commentObject(input, ['profileId', 'identityId']);
    const profileId = publicCommentId(row['profileId']);
    if (!ids.includes(profileId))
      throw new PublicCommentInputError('Mention recipient scope differs');
    return { profileId, identityId: notificationRecipient(row['identityId']) };
  });
  if (
    new Set(result.map((row) => row.profileId)).size !== result.length ||
    new Set(result.map((row) => row.identityId)).size !== result.length
  )
    throw new PublicCommentInputError('Ambiguous mention recipients');
  return result.sort((a, b) => a.profileId.localeCompare(b.profileId));
}
