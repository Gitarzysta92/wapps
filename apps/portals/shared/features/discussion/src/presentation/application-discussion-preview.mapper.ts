import type { PublicApplicationDiscussion } from '@domains/community';
import type { DiscussionSmallCardData } from './discussion-small-card/discussion-small-card.component';

/** Map the bounded public preview without borrowing a reply's author or date. */
export function mapApplicationDiscussionPreview(
  thread: PublicApplicationDiscussion
): DiscussionSmallCardData {
  const root = thread.comments.find((comment) => comment.parentId === null);
  return {
    id: thread.id,
    slug: thread.id,
    title: thread.title,
    excerpt: root?.content?.text ?? 'Opening post unavailable',
    author: root?.content?.displayName ?? 'Author unavailable',
    authorAvatar: '',
    createdAt: root?.createdAt != null ? new Date(root.createdAt) : null,
    tags: thread.tags,
    isPinned: thread.pinned,
    repliesCount: thread.replyCount,
    repliesIncludeRemoved: true,
    viewsUnavailableLabel: 'Views unavailable',
  };
}
