import { defaultAccountPreferences } from '@domains/customer/preferences';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import { AccountPreferencesService } from './account-preferences.service';

const ctx = { identityId: 'Uid', timestamp: 1, subject: { roles: [] } };
const input = { expectedRevision: 2, preferences: defaultAccountPreferences() };

function fixture() {
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  const authority = new (class extends AuthorityValidationService {})({
    evaluate,
  });
  const store = {
    getPreferences: jest.fn(),
    updatePreferences: jest
      .fn()
      .mockResolvedValue({ identityId: 'Uid', revision: 3 }),
  };
  return {
    evaluate,
    store,
    service: new AccountPreferencesService(authority, store),
  };
}

describe('self preferences application boundary', () => {
  it('authorizes the trusted self resource before touching storage', async () => {
    const f = fixture();
    expect(await f.service.update(input, 'key', ctx)).toEqual(
      ok({ identityId: 'Uid', revision: 3 })
    );
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: 'Uid',
        actionName: 'identity.preferences.update',
        resource: { type: 'user', id: 'Uid' },
        subject: { roles: [] },
      })
    );
    expect(f.store.updatePreferences).toHaveBeenCalledWith('Uid', input, 'key');
    expect(f.evaluate.mock.invocationCallOrder[0]).toBeLessThan(
      f.store.updatePreferences.mock.invocationCallOrder[0]
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
      expect(f.store.getPreferences).not.toHaveBeenCalled();
      expect(f.store.updatePreferences).not.toHaveBeenCalled();
    }
  );
  it('fails closed on policy outages without leaking diagnostics', async () => {
    const f = fixture();
    f.evaluate.mockResolvedValue(err(new Error('private diagnostic')));
    const result = await f.service.update(input, 'key', ctx);
    expect(result).toEqual(err(expect.any(CanonicalIdentityUnavailable)));
    expect(f.store.updatePreferences).not.toHaveBeenCalled();
  });
  it('rejects identity injection and missing command keys', async () => {
    const f = fixture();
    expect(
      await f.service.update({ ...input, identityId: 'Other' }, 'key', ctx)
    ).toEqual(err(expect.any(CanonicalIdentityInputError)));
    expect(await f.service.update(input, '', ctx)).toEqual(
      err(expect.any(CanonicalIdentityInputError))
    );
    expect(f.store.updatePreferences).not.toHaveBeenCalled();
  });
  it('propagates conflicts without retrying new intent', async () => {
    const f = fixture();
    f.store.updatePreferences.mockRejectedValue(
      new CanonicalIdentityConflict('revision changed')
    );
    expect(await f.service.update(input, 'key', ctx)).toEqual(
      err(expect.any(CanonicalIdentityConflict))
    );
    expect(f.store.updatePreferences).toHaveBeenCalledTimes(1);
  });
});
