import {
  DISCUSSION_MAX_DEPTH,
  DISCUSSION_MAX_NODES,
  DISCUSSION_MAX_PAYLOAD_BYTES,
  DISCUSSION_MAX_GENERATION_BYTES,
} from '@sdk/features/discussion/core';
import { commentObject } from '@domains/community';
import { discussionInteger } from './portal-discussions.contract';

export function genericDiscussionId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  )
    throw new Error('Invalid discussion ID');
  return value;
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value || value.length > max)
    throw new Error('Invalid discussion metadata');
  return value;
}

function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  const found = choices.find((item) => item === value);
  if (!found) throw new Error('Invalid discussion state');
  return found;
}

function json(value: unknown, depth = 0): void {
  if (depth > 32) throw new Error('Discussion content nesting exceeds limit');
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach((item) => json(item, depth + 1));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => json(item, depth + 1));
    return;
  }
  throw new Error('Invalid discussion JSON');
}

function content(value: unknown, nullable = false): void {
  if (
    !nullable &&
    (value == null || (typeof value === 'string' && !value.trim()))
  )
    throw new Error('Discussion content is required');
  json(value);
  if (
    Buffer.byteLength(JSON.stringify({ content: value })) >
    DISCUSSION_MAX_PAYLOAD_BYTES
  )
    throw new Error('Discussion content exceeds limit');
}

export type GenericDiscussionAction =
  | 'create'
  | 'reply'
  | 'edit'
  | 'remove'
  | 'like'
  | 'unlike';

export function genericDiscussionChange(
  action: GenericDiscussionAction,
  input: unknown
) {
  if (action === 'like' || action === 'unlike') {
    if (input !== undefined) commentObject(input, []);
    return undefined;
  }
  const row = commentObject(
    input,
    action === 'create'
      ? ['content', 'subjectId', 'state', 'visibility']
      : action === 'reply'
      ? ['content']
      : action === 'edit'
      ? ['content', 'expectedRevision', 'state', 'visibility']
      : ['expectedRevision']
  );
  if (action !== 'remove') content(row.content);
  if (action === 'edit' || action === 'remove')
    discussionInteger(row.expectedRevision, 1);
  if (row.subjectId != null) genericDiscussionId(row.subjectId);
  if (row.state != null) choice(row.state, ['draft', 'published', 'archived']);
  if (row.visibility != null)
    choice(row.visibility, ['public', 'unlisted', 'private']);
  return row;
}

function time(value: unknown) {
  return value === null ? null : discussionInteger(value);
}

function head(input: unknown) {
  const row = commentObject(input, [
    '_id',
    'schemaVersion',
    'tenantId',
    'generation',
    'fingerprint',
    'revision',
    'subjectId',
    'subjectReferenceKey',
    'visibility',
    'state',
    'deletedAt',
    'createdAt',
    'lastActivityAt',
    'descendantsCount',
    'nodeCount',
  ]);
  genericDiscussionId(row._id);
  discussionInteger(row.schemaVersion, 1);
  text(row.tenantId, 128);
  text(row.generation, 256);
  if (
    typeof row.fingerprint !== 'string' ||
    !/^[a-f0-9]{64}$/.test(row.fingerprint)
  )
    throw new Error('Invalid discussion fingerprint');
  discussionInteger(row.revision, 1);
  if (row.subjectId !== null) genericDiscussionId(row.subjectId);
  if (row.subjectReferenceKey !== null)
    genericDiscussionId(row.subjectReferenceKey);
  choice(row.visibility, ['public', 'unlisted', 'private']);
  choice(row.state, ['draft', 'published', 'archived']);
  if (row.deletedAt !== null) throw new Error('Deleted discussion returned');
  discussionInteger(row.createdAt);
  discussionInteger(row.lastActivityAt);
  const count = discussionInteger(row.nodeCount, 1);
  if (
    count > DISCUSSION_MAX_NODES ||
    discussionInteger(row.descendantsCount) >= count
  )
    throw new Error('Invalid discussion size');
  return row;
}

export function genericDiscussionList(input: unknown) {
  if (!Array.isArray(input) || input.length > 50)
    throw new Error('Invalid discussion list');
  const rows = input.map(head);
  if (new Set(rows.map((row) => row._id)).size !== rows.length)
    throw new Error('Duplicate discussion');
  return rows;
}

export function genericDiscussionThread(input: unknown, id: string) {
  const row = commentObject(input, ['aggregate', 'nodes']);
  const aggregate = head(row.aggregate);
  if (
    genericDiscussionId(aggregate._id).toLowerCase() !== id.toLowerCase() ||
    !Array.isArray(row.nodes) ||
    row.nodes.length !== aggregate.nodeCount ||
    Buffer.byteLength(JSON.stringify(row)) >
      DISCUSSION_MAX_GENERATION_BYTES + 2 * 1024 * 1024
  )
    throw new Error('Invalid discussion generation');
  const nodes = row.nodes.map((input) => {
    const redacted =
      !!input && typeof input === 'object' && input.redacted === true;
    const node = commentObject(
      input,
      redacted
        ? ['id', 'parentId', 'depth', 'kind', 'payload', 'redacted']
        : [
            '_id',
            'id',
            'referenceKey',
            'kind',
            'parentId',
            'ownerIdentityId',
            'state',
            'visibility',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'likeCount',
            'payload',
            'schemaVersion',
            'discussionId',
            'generation',
            'revision',
            'depth',
          ]
    );
    genericDiscussionId(node.id);
    if (node.parentId !== null) genericDiscussionId(node.parentId);
    if (discussionInteger(node.depth) > DISCUSSION_MAX_DEPTH)
      throw new Error('Invalid discussion depth');
    choice(node.kind, ['discussion', 'comment']);
    if (redacted) {
      if (node.payload !== null) throw new Error('Redacted content returned');
    } else {
      text(node._id, 320);
      genericDiscussionId(node.referenceKey);
      if (node.ownerIdentityId !== null) text(node.ownerIdentityId, 128);
      choice(node.state, ['draft', 'published', 'archived']);
      choice(node.visibility, ['public', 'unlisted', 'private']);
      discussionInteger(node.createdAt);
      time(node.updatedAt);
      discussionInteger(node.likeCount);
      if (
        node.deletedAt !== null ||
        node.discussionId !== aggregate._id ||
        node.revision !== aggregate.revision ||
        node.generation !== aggregate.generation ||
        node.schemaVersion !== aggregate.schemaVersion
      )
        throw new Error('Mixed discussion generation');
      const payload = commentObject(node.payload, ['content']);
      content(payload.content, node.ownerIdentityId === null);
    }
    return node;
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const root = byId.get(aggregate._id);
  if (
    byId.size !== nodes.length ||
    !root ||
    root.redacted ||
    root.kind !== 'discussion' ||
    root.parentId !== null ||
    root.depth !== 0 ||
    nodes.some(
      (node) =>
        node !== root &&
        (node.kind !== 'comment' ||
          typeof node.depth !== 'number' ||
          byId.get(node.parentId)?.depth !== node.depth - 1)
    ) ||
    nodes.filter((node) => node !== root && !node.redacted).length !==
      aggregate.descendantsCount
  )
    throw new Error('Invalid discussion ancestry');
  return { aggregate, nodes };
}
