import { EncryptedProfileDiscussionCursors } from './profile-discussion-cursors';
import { profileDiscussionsCursor } from '@domains/community';

const cursor = {
  at: 1700000000000,
  id: '00000000-0000-4000-8000-000000000001',
};
describe('confidential scoped profile continuation', () => {
  const adapter = new EncryptedProfileDiscussionCursors('qualification-secret');
  it('survives a process recreation without exposing skipped identifiers', () => {
    const token = adapter.seal(cursor, 'OwnerUid', 'default');
    expect(profileDiscussionsCursor(token)).toBe(token);
    expect(
      new EncryptedProfileDiscussionCursors('qualification-secret').open(
        token,
        'OwnerUid',
        'default'
      )
    ).toEqual(cursor);
    expect(
      Buffer.from(token.slice(3), 'base64url').includes(Buffer.from(cursor.id))
    ).toBe(false);
    expect(adapter.seal(cursor, 'OwnerUid', 'default')).not.toBe(token);
  });
  it('rejects tampering, cross-owner, cross-tenant, wrong key and noncanonical encodings', () => {
    const token = adapter.seal(cursor, 'OwnerUid', 'default');
    const raw = Buffer.from(token.slice(3), 'base64url');
    raw[raw.length - 1] ^= 1;
    for (const [value, owner, tenant] of [
      ['v1.' + raw.toString('base64url'), 'OwnerUid', 'default'],
      [token, 'OtherUid', 'default'],
      [token, 'OwnerUid', 'other'],
      [token + '=', 'OwnerUid', 'default'],
      ['v1.' + 'a'.repeat(100), 'OwnerUid', 'default'],
    ])
      expect(() => adapter.open(value, owner, tenant)).toThrow(
        'Invalid shared discussion cursor'
      );
    expect(() =>
      new EncryptedProfileDiscussionCursors('rotated').open(
        token,
        'OwnerUid',
        'default'
      )
    ).toThrow();
  });
});
