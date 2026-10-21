import { EncryptedProfileActivityCursors } from './profile-activity-cursors';

describe('profile activity encrypted continuations', () => {
  const position = { at: 123, key: 'article:00000000-0000-4000-8000-000000000001' };
  it('survives restart with the same secret, conceals scan points, and uses fresh nonces', () => {
    const first = new EncryptedProfileActivityCursors('local-test-secret');
    const token = first.seal(position, 'profile');
    expect(token).not.toContain('article');
    expect(first.seal(position, 'profile')).not.toBe(token);
    expect(new EncryptedProfileActivityCursors('local-test-secret').open(token, 'profile')).toEqual(position);
  });
  it('rejects tampering, cross-profile reuse, rotation and foreign token contexts', () => {
    const reader = new EncryptedProfileActivityCursors('local-test-secret');
    const token = reader.seal(position, 'profile');
    expect(() => reader.open(token, 'other')).toThrow();
    expect(() => new EncryptedProfileActivityCursors('rotated').open(token, 'profile')).toThrow();
    expect(() => reader.open(token.slice(0, 15) + (token[15] === 'a' ? 'b' : 'a') + token.slice(16), 'profile')).toThrow();
    expect(() => reader.open(token.replace('a1.', 'v1.'), 'profile')).toThrow();
  });
});
