import { err, ok } from '@sdk/kernel/standard';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import { DiscussionMentionRecipients } from './discussion-mention-recipients';
import {
  PublicProfileNotFound,
  type PublicProfileSnapshot,
} from './ports/public-profile.port';

const id = '00000000-0000-4000-8000-000000000001';
const context = {
  identityId: 'wapps-notification-worker',
  tenantId: 'notifications',
  timestamp: 1,
  subject: { roles: ['notification:worker'] },
};
const input = { authorId: 'Author', profileIds: [id] };
function fixture() {
  const snapshot: PublicProfileSnapshot = {
    profile: {
      id,
      name: 'Member',
      bio: null,
      location: null,
      avatarId: null,
      socialLinks: {},
      registeredAt: 1,
    },
    facts: {
      ownerId: id,
      viewerId: '00000000-0000-4000-8000-000000000002',
      visibility: 'public',
      ownerActive: true,
      viewerActive: true,
      viewerRegistered: true,
      approved: false,
    },
    follow: null,
    stamp: 'canonical',
  };
  const authority = new (class extends AuthorityValidationService {
    override validate = jest.fn().mockResolvedValue(ok(true));
  })({ evaluate: async () => ok(false) });
  const audience = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  const profiles = {
    inspect: jest.fn().mockResolvedValue(snapshot),
    confirm: jest.fn().mockResolvedValue(snapshot),
    contentOwner: jest.fn().mockResolvedValue('Recipient'),
    avatar: jest.fn(),
    directory: jest.fn(),
    followers: jest.fn(),
    following: jest.fn(),
    prepareFollow: jest.fn(),
    changeFollow: jest.fn(),
  };
  return {
    snapshot,
    authority,
    audience,
    profiles,
    service: new DiscussionMentionRecipients(authority, audience, profiles),
  };
}

describe('private mention recipient resolution', () => {
  it('requires exact service scope then current profile audience before resolving identity', async () => {
    const f = fixture();
    expect(await f.service.resolve(input, context)).toEqual(
      ok({ recipients: [{ profileId: id, identityId: 'Recipient' }] })
    );
    expect(f.authority.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'identity.mention-recipients.read',
        resource: {
          type: 'mention-recipients',
          id: 'account',
          tenantId: 'notifications',
        },
      })
    );
    expect(f.audience.evaluate).toHaveBeenCalledWith('read', f.snapshot.facts);
    expect(f.profiles.contentOwner).toHaveBeenCalledWith(f.snapshot, 'Author');
    expect(f.profiles.confirm).toHaveBeenCalledWith(f.snapshot, 'Author');
  });
  it.each([
    { ...context, identityId: 'Admin', subject: { roles: ['admin'] } },
    { ...context, tenantId: 'default' },
    { ...context, subject: { roles: [] } },
  ])('rejects non-service credentials %j before data access', async (actor) => {
    const f = fixture(),
      result = await f.service.resolve(input, actor);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toBeInstanceOf(CanonicalIdentityAccessDenied);
    expect(f.authority.validate).not.toHaveBeenCalled();
    expect(f.profiles.inspect).not.toHaveBeenCalled();
  });
  it.each([ok(false), err(new Error('OPA down'))])(
    'fails closed on service authorization %j',
    async (decision) => {
      const f = fixture();
      f.authority.validate.mockResolvedValue(decision);
      expect((await f.service.resolve(input, context)).ok).toBe(false);
      expect(f.profiles.inspect).not.toHaveBeenCalled();
    }
  );
  it('rejects unbounded input without profile lookups', async () => {
    const f = fixture(),
      result = await f.service.resolve(
        { ...input, profileIds: Array(11).fill(id) },
        context
      );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toBeInstanceOf(CanonicalIdentityInputError);
    expect(f.profiles.inspect).not.toHaveBeenCalled();
  });
  it('omits inaccessible profiles before resolving private identities', async () => {
    const f = fixture();
    f.audience.evaluate.mockResolvedValue(ok(false));
    expect(await f.service.resolve(input, context)).toEqual(
      ok({ recipients: [] })
    );
    expect(f.profiles.contentOwner).not.toHaveBeenCalled();
  });
  it('does not disguise policy outage as an empty recipient list', async () => {
    const f = fixture();
    f.audience.evaluate.mockResolvedValue(err(new Error('offline')));
    const result = await f.service.resolve(input, context);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toBeInstanceOf(CanonicalIdentityUnavailable);
    expect(f.profiles.contentOwner).not.toHaveBeenCalled();
  });
  it.each(['viewerActive', 'viewerRegistered'] as const)(
    'suppresses recipients for an ineligible author: %s',
    async (field) => {
      const f = fixture();
      f.snapshot.facts[field] = false;
      expect(await f.service.resolve(input, context)).toEqual(
        ok({ recipients: [] })
      );
      expect(f.profiles.contentOwner).not.toHaveBeenCalled();
    }
  );
  it('omits suspended recipients and self mentions', async () => {
    const f = fixture();
    f.snapshot.facts.ownerActive = false;
    expect(await f.service.resolve(input, context)).toEqual(
      ok({ recipients: [] })
    );
    f.snapshot.facts.ownerActive = true;
    f.profiles.contentOwner.mockResolvedValue('Author');
    expect(await f.service.resolve(input, context)).toEqual(
      ok({ recipients: [] })
    );
  });
  it('rechecks privacy changes after authorization and after private lookup', async () => {
    const f = fixture();
    f.profiles.contentOwner.mockRejectedValueOnce(new PublicProfileNotFound());
    expect(await f.service.resolve(input, context)).toEqual(
      ok({ recipients: [] })
    );
    f.profiles.confirm.mockResolvedValue(null);
    expect(await f.service.resolve(input, context)).toEqual(
      ok({ recipients: [] })
    );
  });
  it('rejects mismatched scope and broken identity mappings', async () => {
    const f = fixture();
    f.profiles.contentOwner.mockResolvedValue('');
    expect((await f.service.resolve(input, context)).ok).toBe(false);
    f.snapshot.facts.ownerId = 'foreign';
    expect((await f.service.resolve(input, context)).ok).toBe(false);
  });
});
