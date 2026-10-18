import {
  commentObject,
  publicCommentId,
  publicDiscussionTopic,
  parseDiscussionSelection,
} from '@domains/community';

/** Account is the Wapps consumer of opaque Discussion bindings. */
export function profileFavoriteDiscussions(input: unknown, ids: string[]) {
  const page = commentObject(input, ['items']);
  if (!Array.isArray(page.items) || page.items.length > ids.length)
    throw new Error('Invalid favorite discussion selection');
  return parseDiscussionSelection(
    {
      items: page.items.map((value) => {
        const row = commentObject(value, [
          'id',
          'bindingKey',
          'revision',
          'replyCount',
          'comments',
          'pinned',
          'canPin',
        ]);
        if (
          typeof row.bindingKey !== 'string' ||
          !row.bindingKey.startsWith('application:') ||
          !Array.isArray(row.comments) ||
          row.comments.length !== 1
        )
          throw new Error('Invalid favorite discussion binding');
        const applicationId = publicCommentId(
          row.bindingKey.slice('application:'.length)
        );
        if (row.bindingKey !== `application:${applicationId}`)
          throw new Error('Invalid favorite discussion binding');
        const root = commentObject(row.comments[0], [
          'id',
          'parentId',
          'depth',
          'content',
          'createdAt',
          'updatedAt',
          'editable',
          'removable',
        ]);
        if (root.id !== row.id || root.parentId !== null || root.depth !== 0)
          throw new Error('Invalid favorite discussion root');
        const topic = publicDiscussionTopic(root.content);
        return {
          id: row.id,
          applicationId,
          title: topic.title,
          revision: row.revision,
          replyCount: row.replyCount,
        };
      }),
    },
    ids
  );
}
