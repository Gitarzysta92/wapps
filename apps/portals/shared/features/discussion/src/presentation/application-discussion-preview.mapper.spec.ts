import type { PublicApplicationDiscussion } from '@domains/community';
import { mapApplicationDiscussionPreview } from './application-discussion-preview.mapper';

const thread: PublicApplicationDiscussion = {
  id: 'thread-id', title: 'A public topic', tags: ['workflows'], pinned: true,
  canPin: false, revision: 2, replyCount: 3,
  comments: [{
    id: 'thread-id', parentId: null, depth: 0, createdAt: 1000, updatedAt: null,
    editable: false, removable: false, content: { displayName: 'Root author', text: 'Root text' },
  }],
};

describe('application discussion card mapping', () => {
  it('keeps canonical identity, root attribution, tags, pin and authoritative reply totals', () => {
    expect(mapApplicationDiscussionPreview(thread)).toMatchObject({
      id: thread.id, slug: thread.id, title: thread.title, author: 'Root author',
      excerpt: 'Root text', createdAt: new Date(1000), repliesCount: 3,
      tags: ['workflows'], isPinned: true, repliesIncludeRemoved: true,
      viewsUnavailableLabel: 'Views unavailable', authorAvatar: '',
    });
    expect(mapApplicationDiscussionPreview(thread).viewsCount).toBeUndefined();
  });

  it('does not use a reply as root attribution when the opening post is absent', () => {
    const preview = mapApplicationDiscussionPreview({ ...thread, comments: [{
      ...thread.comments[0], parentId: thread.id, id: 'reply-id',
      content: { displayName: 'Reply author', text: 'Reply text' },
    }] });
    expect(preview.author).toBe('Author unavailable');
    expect(preview.excerpt).toBe('Opening post unavailable');
    expect(preview.createdAt).toBeNull();
  });

  it('retains the real date and reply count of a removed opening post without inventing content', () => {
    expect(mapApplicationDiscussionPreview({ ...thread, comments: [{
      ...thread.comments[0], content: null,
    }] })).toMatchObject({ author: 'Author unavailable', excerpt: 'Opening post unavailable', createdAt: new Date(1000), repliesCount: 3 });
  });
});
