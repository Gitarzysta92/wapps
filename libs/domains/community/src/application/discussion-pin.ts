import {
  commentObject,
  publicCommentId,
  PublicCommentInputError,
} from './public-comment';

export function discussionPinChange(input: unknown): {
  pinned: boolean;
  expectedRevision: number;
} {
  const value = commentObject(input, ['pinned', 'expectedRevision']);
  const pinned = value['pinned'],
    expectedRevision = value['expectedRevision'];
  if (
    typeof pinned !== 'boolean' ||
    typeof expectedRevision !== 'number' ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1
  )
    throw new PublicCommentInputError(
      'Choose a pin state and positive saved revision'
    );
  return { pinned, expectedRevision };
}

export function applicationDiscussionCursor(input: unknown): {
  pinned: boolean;
  at: number;
  id: string;
} {
  if (
    typeof input !== 'string' ||
    !/^[01]\.\d{1,16}\.[0-9a-f-]{36}$/.test(input)
  )
    throw new PublicCommentInputError('Invalid discussion cursor');
  const [pinned, at, id] = input.split('.');
  if (!Number.isSafeInteger(Number(at)))
    throw new PublicCommentInputError('Invalid discussion cursor');
  return { pinned: pinned === '1', at: Number(at), id: publicCommentId(id) };
}
