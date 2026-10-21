import { discussionKey } from '@sdk/features/discussion/core';
import {
  DiscussionValidationError,
  type DiscussionOrder,
  type DiscussionPageCursor,
  type NewDiscussion,
  type DiscussionEdit,
} from '@sdk/features/discussion/libs/management';

export function discussionObject(
  value: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new DiscussionValidationError('Invalid discussion input');
  return value as Record<string, unknown>;
}

export function discussionId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  )
    throw new DiscussionValidationError('Invalid discussion identifier');
  return value;
}

export function discussionRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new DiscussionValidationError(
      'A positive expected revision is required'
    );
  return value;
}

function flag(value: unknown): boolean {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new DiscussionValidationError('Invalid discussion query flag');
}

export function discussionQuery(
  value: unknown,
  mode: 'list' | 'read' | 'write'
) {
  const row = discussionObject(value, [
    'bindingKey',
    ...(mode === 'list'
      ? ['cursor', 'order', 'includeVotes']
      : mode === 'read'
      ? ['rootOnly', 'includeVotes']
      : []),
  ]);
  const bindingKey = discussionKey(row.bindingKey);
  const order: DiscussionOrder =
    row.order === undefined || row.order === 'created'
      ? 'created'
      : row.order === 'pinned'
      ? 'pinned'
      : invalidOrder();
  let cursor: DiscussionPageCursor | null = null;
  if (row.cursor !== undefined) {
    if (typeof row.cursor !== 'string' || row.cursor.length > 64)
      throw new DiscussionValidationError('Invalid discussion cursor');
    const parts = row.cursor.split('.');
    const pin = order === 'pinned' ? parts.shift() : undefined;
    const [at, id, extra] = parts;
    if (
      (order === 'pinned' && pin !== '0' && pin !== '1') ||
      extra !== undefined ||
      !/^\d{1,16}$/.test(at) ||
      !Number.isSafeInteger(Number(at))
    )
      throw new DiscussionValidationError('Invalid discussion cursor');
    cursor = {
      at: Number(at),
      id: discussionId(id),
      ...(order === 'pinned' ? { pinned: pin === '1' } : {}),
    };
  }
  return {
    bindingKey,
    order,
    cursor,
    rootOnly: flag(row.rootOnly),
    includeVotes: flag(row.includeVotes),
  };
}

function invalidOrder(): never {
  throw new DiscussionValidationError('Invalid discussion order');
}

/** Only an empty query selects the legacy unbound contract. Invalid scopes fail closed. */
export function discussionScope(
  value: unknown,
  mode: 'list' | 'read' | 'write'
) {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  )
    return undefined;
  return discussionQuery(value, mode);
}

export function discussionDiscoveryInput(value: unknown, selection: boolean) {
  const row = discussionObject(value, [
    'bindingPrefix',
    'includeVotes',
    selection ? 'ids' : 'cursor',
  ]);
  const prefix = discussionKey(row.bindingPrefix);
  let ids: string[] = [];
  if (selection) {
    if (typeof row.ids !== 'string' || row.ids.length > 1850)
      throw new DiscussionValidationError('Invalid discussion selection');
    ids = row.ids.split(',').map(discussionId);
    if (!ids.length || ids.length > 50 || new Set(ids).size !== ids.length)
      throw new DiscussionValidationError('Invalid discussion selection');
  }
  const { cursor } = discussionQuery(
    {
      bindingKey: prefix,
      ...(row.cursor !== undefined ? { cursor: row.cursor } : {}),
    },
    'list'
  );
  return { prefix, ids, cursor, includeVotes: flag(row.includeVotes) };
}

function lifecycle(
  row: Record<string, unknown>
): Pick<NewDiscussion, 'state' | 'visibility'> {
  if (
    row.state !== undefined &&
    row.state !== 'draft' &&
    row.state !== 'published' &&
    row.state !== 'archived'
  )
    throw new DiscussionValidationError('Invalid discussion state');
  if (
    row.visibility !== undefined &&
    row.visibility !== 'public' &&
    row.visibility !== 'unlisted' &&
    row.visibility !== 'private'
  )
    throw new DiscussionValidationError('Invalid discussion visibility');
  return {
    ...(row.state !== undefined ? { state: row.state } : {}),
    ...(row.visibility !== undefined ? { visibility: row.visibility } : {}),
  };
}

export function discussionCreate(
  value: unknown
): Omit<NewDiscussion, 'bindingKey'> {
  const row = discussionObject(value, [
    'content',
    'subjectId',
    'state',
    'visibility',
  ]);
  return {
    content: row.content,
    ...lifecycle(row),
    ...(row.subjectId !== undefined
      ? { subjectId: discussionId(row.subjectId) }
      : {}),
  };
}

export function discussionEdit(value: unknown): DiscussionEdit {
  const row = discussionObject(value, [
    'content',
    'expectedRevision',
    'state',
    'visibility',
  ]);
  return {
    content: row.content,
    expectedRevision: discussionRevision(row.expectedRevision),
    ...lifecycle(row),
  };
}
