import {
  changeProfileFollow,
  parseProfileFollow,
  parseProfileFollowChange,
  parsePublicProfile,
  parsePublicProfileView,
  type ProfileFollowStatus,
} from './public-profile';

const ownerId = '00000000-0000-4000-8000-000000000001';
const requesterId = '00000000-0000-4000-8000-000000000002';
const profile = {
  id: ownerId,
  name: 'Alice',
  bio: null,
  location: null,
  avatarId: null,
  socialLinks: {},
  registeredAt: 1,
};

describe('public profile and approved follower contracts', () => {
  it('accepts only the explicit contact field, including an intentionally hidden address', () => {
    expect(parsePublicProfile({ ...profile, contactEmail: null }).contactEmail).toBeNull();
    expect(parsePublicProfile({ ...profile, contactEmail: 'contact@example.test' }).contactEmail).toBe('contact@example.test');
    expect(() => parsePublicProfile({ ...profile, contactEmail: 'a@example.test\nBcc:b@example.test' })).toThrow();
    expect(() => parsePublicProfile({ ...profile, email: 'credential@example.test' })).toThrow();
  });
  it('exposes only explicitly public fields and canonical public IDs', () => {
    expect(parsePublicProfile(profile)).toEqual(profile);
    for (const field of [
      'email',
      'identityId',
      'revision',
      'avatarUri',
      'preferences',
    ])
      expect(() =>
        parsePublicProfile({ ...profile, [field]: 'private' })
      ).toThrow();
    expect(() =>
      parsePublicProfile({ ...profile, id: 'firebase-uid' })
    ).toThrow();
    expect(() =>
      parsePublicProfile({
        ...profile,
        socialLinks: { website: 'javascript:alert(1)' },
      })
    ).toThrow();
  });
  it.each(['name', 'bio', 'location'])('rejects controls in %s', (key) => {
    expect(() =>
      parsePublicProfile({ ...profile, [key]: 'test\u0000' })
    ).toThrow();
  });
  it('does not accept a hidden payload or a fabricated owner preview', () => {
    expect(() =>
      parsePublicProfileView({
        access: 'followers',
        profile,
        isOwner: false,
        follow: null,
      })
    ).toThrow();
    expect(() =>
      parsePublicProfileView({
        access: 'followers',
        profile: null,
        isOwner: true,
        follow: null,
      })
    ).toThrow();
    expect(
      parsePublicProfileView({
        access: 'followers',
        profile: null,
        isOwner: false,
        follow: null,
      }).profile
    ).toBeNull();
  });
  it('rejects self-follow, unversioned access, unknown actions and injected authority', () => {
    expect(() =>
      parseProfileFollow({
        ownerId,
        requesterId: ownerId,
        revision: 0,
        status: 'none',
      })
    ).toThrow();
    expect(() =>
      parseProfileFollow({
        ownerId,
        requesterId,
        revision: 0,
        status: 'approved',
      })
    ).toThrow();
    expect(() =>
      parseProfileFollowChange({
        ownerId,
        requesterId,
        expectedRevision: 0,
        action: 'grant',
      })
    ).toThrow();
    expect(() =>
      parseProfileFollowChange({
        ownerId,
        requesterId,
        expectedRevision: 0,
        action: 'request',
        roles: ['admin'],
      })
    ).toThrow();
  });
  it.each([
    ['none', 'request', 'pending'],
    ['pending', 'approve', 'approved'],
    ['pending', 'cancel', 'none'],
    ['approved', 'cancel', 'none'],
    ['pending', 'remove', 'none'],
    ['approved', 'remove', 'none'],
  ] as const)('%s -> %s advances the pair revision', (status, action, next) => {
    expect(
      changeProfileFollow({ ownerId, requesterId, revision: 7, status }, action)
    ).toEqual({ ownerId, requesterId, revision: 8, status: next });
  });
  it.each(['pending', 'approved'] as ProfileFollowStatus[])(
    'cannot issue a fresh request over %s',
    (status) => {
      expect(() =>
        changeProfileFollow(
          { ownerId, requesterId, revision: 7, status },
          'request'
        )
      ).toThrow();
    }
  );
  it.each(['none', 'approved'] as ProfileFollowStatus[])(
    'cannot approve %s',
    (status) => {
      expect(() =>
        changeProfileFollow(
          { ownerId, requesterId, revision: 7, status },
          'approve'
        )
      ).toThrow();
    }
  );
});
