import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import { AccountFavoritesService } from './account-favorites.service';

const ctx = { identityId: 'Uid', timestamp: 1, subject: { roles: [] } };
const input = {
  expectedRevision: 2,
  target: { kind: 'applications', id: '019a0010-0000-7000-8000-000000000001' },
  saved: true,
};
function fixture() {
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  const authority = new (class extends AuthorityValidationService {})({
    evaluate,
  });
  const receipt = { identityId: 'Uid', revision: 3 };
  const store = {
    read: jest.fn(),
    inspectChange: jest.fn().mockResolvedValue(null),
    change: jest.fn().mockResolvedValue(receipt),
  };
  const targets = { available: jest.fn().mockResolvedValue(true) };
  return {
    evaluate,
    store,
    targets,
    receipt,
    service: new AccountFavoritesService(authority, store, targets, {
      read: jest.fn().mockResolvedValue({
        target: input.target,
        version: 1,
        at: 100,
        content: {
          title: 'App',
          destination: { kind: 'applications', slug: 'app' },
        },
      }),
    }),
  };
}
describe('account favorites application boundary', () => {
  it('authorizes self before lifecycle/receipt, target lookup and commit', async () => {
    const f = fixture();
    expect(await f.service.change(input, 'key', ctx)).toEqual(ok(f.receipt));
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'identity.favorites.update',
        identityId: 'Uid',
        resource: { type: 'user', id: 'Uid' },
      })
    );
    const calls = [
      f.evaluate,
      f.store.inspectChange,
      f.targets.available,
      f.store.change,
    ].map((mock) => mock.mock.invocationCallOrder[0]);
    expect(calls).toEqual([...calls].sort((a, b) => a - b));
    expect(f.store.change).toHaveBeenCalledWith('Uid', input, 'key', {
      version: 1,
      at: 100,
    });
  });
  it.each([false, null, 'true'])(
    'denies non-true decisions before any store/target I/O: %j',
    async (value) => {
      const f = fixture();
      f.evaluate.mockResolvedValue(ok(value));
      expect(await f.service.change(null, '', ctx)).toEqual(
        err(expect.any(CanonicalIdentityAccessDenied))
      );
      expect(await f.service.read(ctx)).toEqual(
        err(expect.any(CanonicalIdentityAccessDenied))
      );
      expect(f.store.read).not.toHaveBeenCalled();
      expect(f.store.inspectChange).not.toHaveBeenCalled();
      expect(f.store.change).not.toHaveBeenCalled();
      expect(f.targets.available).not.toHaveBeenCalled();
    }
  );
  it('fails closed for policy failure and anonymous identity', async () => {
    const f = fixture();
    f.evaluate.mockResolvedValue(err(new Error('policy diagnostic')));
    expect(await f.service.change(input, 'key', ctx)).toEqual(
      err(expect.any(CanonicalIdentityUnavailable))
    );
    expect(await f.service.read({ ...ctx, identityId: '' })).toEqual(
      err(expect.any(CanonicalIdentityAccessDenied))
    );
    expect(f.store.inspectChange).not.toHaveBeenCalled();
  });
  it('replays a confirmed command even if the target has disappeared', async () => {
    const f = fixture();
    f.store.inspectChange.mockResolvedValue(f.receipt);
    f.targets.available.mockResolvedValue(false);
    expect(await f.service.change(input, 'key', ctx)).toEqual(ok(f.receipt));
    expect(f.targets.available).not.toHaveBeenCalled();
    expect(f.store.change).not.toHaveBeenCalled();
  });
  it('removes saved relations without depending on the target service', async () => {
    const f = fixture();
    f.targets.available.mockRejectedValue(new Error('offline'));
    expect(
      await f.service.change({ ...input, saved: false }, 'key', ctx)
    ).toEqual(ok(f.receipt));
    expect(f.targets.available).not.toHaveBeenCalled();
  });
  it('preserves conflicts and rejects unavailable or failed target reads before mutations', async () => {
    const f = fixture();
    f.store.inspectChange.mockRejectedValueOnce(
      new CanonicalIdentityConflict('conflict')
    );
    expect(await f.service.change(input, 'key', ctx)).toEqual(
      err(expect.any(CanonicalIdentityConflict))
    );
    expect(f.targets.available).not.toHaveBeenCalled();
    f.targets.available
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('private diagnostic'));
    expect(await f.service.change(input, 'key', ctx)).toEqual(
      err(expect.any(CanonicalIdentityInputError))
    );
    expect(await f.service.change(input, 'key', ctx)).toEqual(
      err(expect.any(CanonicalIdentityUnavailable))
    );
    expect(f.store.change).not.toHaveBeenCalled();
  });
  it('rejects identity injection and malformed command keys before storage', async () => {
    const f = fixture();
    expect(
      await f.service.change({ ...input, identityId: 'Other' }, 'key', ctx)
    ).toEqual(err(expect.any(CanonicalIdentityInputError)));
    for (const key of ['', 'k\n', 'with space', 'x'.repeat(129)])
      expect(await f.service.change(input, key, ctx)).toEqual(
        err(expect.any(CanonicalIdentityInputError))
      );
    expect(f.store.inspectChange).not.toHaveBeenCalled();
  });
});
