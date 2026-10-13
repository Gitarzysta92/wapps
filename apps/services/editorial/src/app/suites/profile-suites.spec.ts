import { ok, err } from '@sdk/kernel/standard';
import { ProfileSuites, PROFILE_READER_ID } from './profile-suites';

describe('Editorial profile collection service authority', () => {
  const actor = {
    identityId: PROFILE_READER_ID,
    tenantId: 'default',
    roles: ['editorial:profile-reader'],
  };
  const input = { ownerIdentityId: 'OwnerUid', after: null };
  const profile = jest.fn();
  const evaluate = jest.fn();
  const service = new ProfileSuites({ profile }, { evaluate }, 'default');
  beforeEach(() => {
    jest.resetAllMocks();
    evaluate.mockResolvedValue(ok(true));
    profile.mockResolvedValue({ sharing: 'visible', items: [], after: null });
  });
  it('uses only the configured public tenant and service role', async () => {
    await service.read(input, actor);
    expect(profile).toHaveBeenCalledWith('OwnerUid', null);
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'default',
        resource: {
          id: 'OwnerUid',
          type: 'profile-suite-collection',
          tenantId: 'default',
        },
      })
    );
  });
  it.each([
    { ...actor, identityId: 'OwnerUid' },
    { ...actor, roles: ['admin'] },
    { ...actor, tenantId: 'private' },
  ])(
    'denies impersonated or wrong-tenant actor %j before catalog access',
    async (value) => {
      await expect(service.read(input, value)).rejects.toThrow();
      expect(profile).not.toHaveBeenCalled();
      expect(evaluate).not.toHaveBeenCalled();
    }
  );
  it.each([ok(false), err(new Error('offline'))])(
    'fails closed on policy %j',
    async (decision) => {
      evaluate.mockResolvedValue(decision);
      await expect(service.read(input, actor)).rejects.toThrow();
      expect(profile).not.toHaveBeenCalled();
    }
  );
  it.each([
    { ...input, tenantId: 'private' },
    { ...input, after: ['id'] },
    { ...input, ownerIdentityId: '' },
    { ...input, ownerIdentityId: 'Owner\nUid' },
  ])('rejects invalid internal scope %j', async (value) => {
    await expect(service.read(value, actor)).rejects.toThrow();
    expect(profile).not.toHaveBeenCalled();
  });
});
