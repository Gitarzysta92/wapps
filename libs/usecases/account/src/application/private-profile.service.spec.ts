import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import { PrivateProfileService } from './private-profile.service';

const ctx = { identityId: 'Uid', timestamp: 1, subject: { roles: [] } };
const input = {
  name: 'Alice',
  bio: null,
  location: null,
  socialLinks: {},
  expectedRevision: 2,
};
function fixture() {
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  const authority = new (class extends AuthorityValidationService {})({
    evaluate,
  });
  const store = {
    getProfile: jest.fn(),
    updateProfile: jest
      .fn()
      .mockResolvedValue({ identityId: 'Uid', revision: 3 }),
  };
  return {
    evaluate,
    store,
    service: new PrivateProfileService(authority, store),
  };
}

describe('self profile application boundary', () => {
  it('authorizes the trusted self resource before touching storage', async () => {
    const f = fixture();
    expect(await f.service.update(input, 'key', ctx)).toEqual(
      ok({ identityId: 'Uid', revision: 3 })
    );
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: 'Uid',
        actionName: 'identity.profile.update',
        resource: { type: 'user', id: 'Uid' },
        subject: { roles: [] },
      })
    );
    expect(f.store.updateProfile).toHaveBeenCalledWith('Uid', input, 'key');
    expect(f.evaluate.mock.invocationCallOrder[0]).toBeLessThan(
      f.store.updateProfile.mock.invocationCallOrder[0]
    );
  });
  it.each([false, 'true', null])(
    'denies non-true policy decisions before validating content: %j',
    async (decision) => {
      const f = fixture();
      f.evaluate.mockResolvedValue(ok(decision));
      expect(await f.service.update(null, 'key', ctx)).toEqual(
        err(expect.any(CanonicalIdentityAccessDenied))
      );
      expect(await f.service.read(ctx)).toEqual(
        err(expect.any(CanonicalIdentityAccessDenied))
      );
      expect(f.store.getProfile).not.toHaveBeenCalled();
      expect(f.store.updateProfile).not.toHaveBeenCalled();
    }
  );
  it('fails closed on policy outages without leaking diagnostics', async () => {
    const f = fixture();
    f.evaluate.mockResolvedValue(err(new Error('private diagnostic')));
    const result = await f.service.update(input, 'key', ctx);
    expect(result).toEqual(err(expect.any(CanonicalIdentityUnavailable)));
    expect(f.store.updateProfile).not.toHaveBeenCalled();
  });
  it('rejects identity injection and missing command keys', async () => {
    const f = fixture();
    expect(
      await f.service.update({ ...input, identityId: 'Other' }, 'key', ctx)
    ).toEqual(err(expect.any(CanonicalIdentityInputError)));
    expect(await f.service.update(input, '', ctx)).toEqual(
      err(expect.any(CanonicalIdentityInputError))
    );
    expect(f.store.updateProfile).not.toHaveBeenCalled();
  });
  it('propagates conflicts without retrying new intent', async () => {
    const f = fixture();
    f.store.updateProfile.mockRejectedValue(
      new CanonicalIdentityConflict('revision changed')
    );
    expect(await f.service.update(input, 'key', ctx)).toEqual(
      err(expect.any(CanonicalIdentityConflict))
    );
    expect(f.store.updateProfile).toHaveBeenCalledTimes(1);
  });
});
