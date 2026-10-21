import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok } from '@sdk/kernel/standard';
import { ProfileAvatarService } from './profile-avatar.service';

const ctx = { identityId: 'OwnerUid', timestamp: 1, subject: { roles: [] } };
const input = {
  expectedRevision: 2,
  source: { contentType: 'image/png', bytes: 20, sha256: 'a'.repeat(64) },
};
function fixture() {
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  const store = {
    inspect: jest.fn().mockResolvedValue(null),
    change: jest
      .fn()
      .mockResolvedValue({ identityId: 'OwnerUid', revision: 3 }),
    read: jest.fn(),
  };
  const normalizer = {
    normalize: jest
      .fn()
      .mockResolvedValue({ bytes: new Uint8Array(20), width: 1, height: 1 }),
  };
  return {
    evaluate,
    store,
    normalizer,
    service: new ProfileAvatarService(
      new (class extends AuthorityValidationService {})({ evaluate }),
      store,
      normalizer
    ),
  };
}

describe('private photo application authorization and retry boundary', () => {
  it.each([ok(false), ok('true'), err(new Error('policy offline'))])(
    'prevents storage and decoding on policy failure %j',
    async (decision) => {
      const f = fixture();
      f.evaluate.mockResolvedValue(decision);
      expect(
        (await f.service.change(input, 'key', new Uint8Array(20), ctx)).ok
      ).toBe(false);
      expect((await f.service.inspect(input, 'key', ctx)).ok).toBe(false);
      expect(
        (await f.service.read('00000000-0000-0000-0000-000000000001', ctx)).ok
      ).toBe(false);
      expect(f.store.inspect).not.toHaveBeenCalled();
      expect(f.store.read).not.toHaveBeenCalled();
      expect(f.store.change).not.toHaveBeenCalled();
      expect(f.normalizer.normalize).not.toHaveBeenCalled();
    }
  );
  it('authorizes only the trusted self resource before decoding or committing', async () => {
    const f = fixture();
    expect(
      (await f.service.change(input, 'key', new Uint8Array(20), ctx)).ok
    ).toBe(true);
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: { type: 'user', id: ctx.identityId },
        actionName: 'identity.profile.update',
      })
    );
    expect(f.store.inspect.mock.invocationCallOrder[0]).toBeLessThan(
      f.normalizer.normalize.mock.invocationCallOrder[0]
    );
    expect(f.normalizer.normalize.mock.invocationCallOrder[0]).toBeLessThan(
      f.store.change.mock.invocationCallOrder[0]
    );
  });
  it('returns committed historical receipts without requiring the old bytes or a decoder', async () => {
    const f = fixture();
    f.store.inspect.mockResolvedValue({
      identityId: ctx.identityId,
      revision: 3,
    });
    expect(await f.service.change(input, 'key', null, ctx)).toEqual(
      ok({ identityId: ctx.identityId, revision: 3 })
    );
    expect(f.normalizer.normalize).not.toHaveBeenCalled();
    expect(f.store.change).not.toHaveBeenCalled();
  });
  it('propagates decode failure without writing; removal uses the same canonical boundary', async () => {
    const f = fixture();
    f.normalizer.normalize.mockRejectedValue(new Error('invalid'));
    expect(
      (await f.service.change(input, 'key', new Uint8Array(20), ctx)).ok
    ).toBe(false);
    expect(f.store.change).not.toHaveBeenCalled();
    expect(
      (
        await f.service.change(
          { expectedRevision: 2, source: null },
          'remove',
          null,
          ctx
        )
      ).ok
    ).toBe(true);
    expect(f.store.change).toHaveBeenCalledWith(
      ctx.identityId,
      { expectedRevision: 2, source: null },
      'remove',
      null
    );
  });
  it.each([
    { ...input, identityId: 'Other' },
    { ...input, source: { ...input.source, bytes: 3_000_000 } },
    { ...input, source: { ...input.source, contentType: 'image/svg+xml' } },
    { ...input, expectedRevision: '2' },
  ])('rejects invalid commands %j', async (value) => {
    const f = fixture();
    expect(
      (await f.service.change(value, 'key', new Uint8Array(20), ctx)).ok
    ).toBe(false);
    expect(f.store.inspect).not.toHaveBeenCalled();
  });
  it('requires valid session and key and refuses mismatched bodies', async () => {
    const f = fixture();
    expect((await f.service.inspect(input, '', ctx)).ok).toBe(false);
    expect(
      (await f.service.inspect(input, 'key', { ...ctx, identityId: '' })).ok
    ).toBe(false);
    expect((await f.service.change(input, 'key', null, ctx)).ok).toBe(false);
    expect(f.normalizer.normalize).not.toHaveBeenCalled();
    expect(f.store.change).not.toHaveBeenCalled();
  });
});
