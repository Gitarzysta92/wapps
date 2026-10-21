import {
  commentObject,
  parseDiscussionSelection,
  parseMyDiscussionPage,
  publicCommentContent,
  publicCommentId,
  publicDiscussionReply,
  publicDiscussionTopic,
} from '@domains/community';
import {
  discussionPage,
  discussionThread,
} from './portal-discussions.contract';
import {
  articleCommentPage,
  articleCommentThread,
} from './portal-article-comments.contract';

/** Wapps owns the key namespace and the presentation of consumer content. */
export function portalDiscussionBinding(
  kind: 'application' | 'article',
  id: string
): string {
  return `${kind}:${publicCommentId(id)}`;
}

function boundThread(input: unknown, bindingKey: string, application: boolean) {
  const row = commentObject(input, [
    'id',
    'bindingKey',
    'revision',
    'replyCount',
    'pinned',
    'canPin',
    'comments',
  ]);
  if (
    row.bindingKey !== bindingKey ||
    typeof row.pinned !== 'boolean' ||
    typeof row.canPin !== 'boolean' ||
    !Array.isArray(row.comments) ||
    !row.comments.length ||
    row.comments.length > 2000
  )
    throw new Error('Invalid bound discussion');
  let title: string | undefined;
  let tags: string[] | undefined;
  const comments = row.comments.map((value, index) => {
    const node = commentObject(value, [
      'id',
      'parentId',
      'depth',
      'content',
      'createdAt',
      'updatedAt',
      'editable',
      'removable',
      ...(application ? ['votes'] : []),
    ]);
    let content = node.content;
    if (application && index === 0) {
      const topic = publicDiscussionTopic(content);
      title = topic.title;
      tags = topic.tags;
      content = {
        displayName: topic.displayName,
        text: topic.text,
        ...(topic.mentions?.length ? { mentions: topic.mentions } : {}),
      };
    } else if (content !== null)
      content = application
        ? publicDiscussionReply(content)
        : publicCommentContent(content);
    return { ...node, content };
  });
  return {
    id: row.id,
    revision: row.revision,
    replyCount: row.replyCount,
    comments,
    ...(application
      ? { title, tags, pinned: row.pinned, canPin: row.canPin }
      : {}),
  };
}

export function applicationBoundThread(
  input: unknown,
  bindingKey: string,
  rootOnly: boolean
) {
  return discussionThread(boundThread(input, bindingKey, true), rootOnly);
}

export function articleBoundThread(
  input: unknown,
  bindingKey: string,
  rootOnly: boolean
) {
  return articleCommentThread(boundThread(input, bindingKey, false), rootOnly);
}

export function applicationBoundPage(input: unknown, bindingKey: string) {
  const row = commentObject(input, ['items', 'next']);
  if (!Array.isArray(row.items) || row.items.length > 10)
    throw new Error('Invalid discussion page');
  return discussionPage({
    items: row.items.map((item) =>
      applicationBoundThread(item, bindingKey, true)
    ),
    next: row.next,
  });
}

export function articleBoundPage(input: unknown, bindingKey: string) {
  const row = commentObject(input, ['items', 'next']);
  if (!Array.isArray(row.items) || row.items.length > 10)
    throw new Error('Invalid comment page');
  return articleCommentPage({
    items: row.items.map((item) => articleBoundThread(item, bindingKey, true)),
    next: row.next,
  });
}

function applicationForBinding(input: unknown): string {
  if (typeof input !== 'string' || !input.startsWith('application:'))
    throw new Error('Unexpected discussion binding');
  const id = publicCommentId(input.slice('application:'.length));
  if (portalDiscussionBinding('application', id) !== input)
    throw new Error('Unexpected discussion binding');
  return id;
}

export function applicationBoundParticipation(input: unknown) {
  const page = commentObject(input, ['items', 'next']);
  if (!Array.isArray(page.items) || page.items.length > 10)
    throw new Error('Invalid discussion membership page');
  const items = page.items.map((value) => {
    const row = commentObject(value, ['thread', 'at', 'participation']);
    const binding =
      row.thread && typeof row.thread === 'object' && 'bindingKey' in row.thread
        ? row.thread.bindingKey
        : undefined;
    const applicationId = applicationForBinding(binding);
    const thread = applicationBoundThread(
      row.thread,
      portalDiscussionBinding('application', applicationId),
      true
    );
    if (row.at !== thread.comments[0].createdAt)
      throw new Error('Invalid discussion membership timestamp');
    return {
      id: thread.id,
      applicationId,
      title: thread.title,
      createdAt: row.at,
      replyCount: thread.replyCount,
      participation: row.participation,
    };
  });
  return parseMyDiscussionPage({ items, next: page.next });
}

export function applicationBoundSelection(input: unknown, ids: string[]) {
  const page = commentObject(input, ['items']);
  if (!Array.isArray(page.items) || page.items.length > ids.length)
    throw new Error('Invalid discussion selection');
  const items = page.items.map((value) => {
    const binding =
      value && typeof value === 'object' && 'bindingKey' in value
        ? value.bindingKey
        : undefined;
    const applicationId = applicationForBinding(binding);
    const thread = applicationBoundThread(
      value,
      portalDiscussionBinding('application', applicationId),
      true
    );
    return {
      id: thread.id,
      applicationId,
      title: thread.title,
      revision: thread.revision,
      replyCount: thread.replyCount,
    };
  });
  return parseDiscussionSelection({ items }, ids);
}
