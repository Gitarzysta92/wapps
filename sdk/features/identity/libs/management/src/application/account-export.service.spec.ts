import {
  ACCOUNT_EXPORT_LIMITS,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok } from '@sdk/kernel/standard';
import { AccountExportService } from './account-export.service';

const id = '00000000-0000-4000-8000-000000000001';
const ctx = { identityId: 'Member', timestamp: 1, subject: { roles: [] } };
function fixture() {
  const job = {
    id,
    status: 'queued',
    requestedAt: 100,
    expiresAt: 100 + ACCOUNT_EXPORT_LIMITS.retentionMs,
    attempts: 0,
    bytes: null,
    sha256: null,
    readyAt: null,
    failure: null,
  };
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  const authority = new (class extends AuthorityValidationService {})({
    evaluate,
  });
  const store = {
    request: jest.fn().mockResolvedValue(job),
    latest: jest.fn().mockResolvedValue(job),
    inspect: jest.fn().mockResolvedValue(job),
    cancel: jest.fn().mockResolvedValue({ ...job, status: 'cancelled' }),
    download: jest.fn().mockReturnValue(
      (async function* () {
        yield new Uint8Array([1]);
      })()
    ),
  };
  return {
    job,
    evaluate,
    store,
    service: new AccountExportService(authority, store),
  };
}
describe('self-authorized account exports', () => {
  it('authorizes all operations against the authenticated identity', async () => {
    const f = fixture();
    expect(await f.service.request('request-key', ctx)).toEqual(ok(f.job));
    expect(await f.service.latest(ctx)).toEqual(ok(f.job));
    expect(await f.service.inspect(id, ctx)).toEqual(ok(f.job));
    expect(await f.service.cancel(id, ctx)).toEqual(
      ok({ ...f.job, status: 'cancelled' })
    );
    expect(f.store.request).toHaveBeenCalledWith('Member', 'request-key');
    expect(f.store.inspect).toHaveBeenCalledWith('Member', id);
    expect(f.evaluate).toHaveBeenCalledTimes(4);
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: 'Member',
        actionName: 'identity.account-export.manage',
        resource: { type: 'user', id: 'Member' },
      })
    );
  });
  it.each([false, 'true', null])(
    'rejects non-true authorization before storage: %p',
    async (value) => {
      const f = fixture();
      f.evaluate.mockResolvedValue(ok(value));
      for (const response of await Promise.all([
        f.service.request('key', ctx),
        f.service.latest(ctx),
        f.service.inspect(id, ctx),
        f.service.cancel(id, ctx),
        f.service.download(id, ctx),
      ]))
        expect(response).toEqual(
          err(expect.any(CanonicalIdentityAccessDenied))
        );
      for (const method of Object.values(f.store))
        expect(method).not.toHaveBeenCalled();
    }
  );
  it('fails closed on unavailable policy and absent authentication', async () => {
    const f = fixture();
    f.evaluate.mockResolvedValue(err(new Error('down')));
    expect(await f.service.latest(ctx)).toEqual(
      err(expect.any(CanonicalIdentityUnavailable))
    );
    expect(await f.service.request('key', { ...ctx, identityId: '' })).toEqual(
      err(expect.any(CanonicalIdentityAccessDenied))
    );
    expect(f.store.latest).not.toHaveBeenCalled();
  });
  it('requires a valid key and job ID after authorization', async () => {
    const f = fixture();
    expect(await f.service.request('with spaces', ctx)).toEqual(
      err(expect.any(CanonicalIdentityInputError))
    );
    expect(await f.service.inspect('not-a-uuid', ctx)).toEqual(
      err(expect.any(CanonicalIdentityInputError))
    );
    expect(f.store.request).not.toHaveBeenCalled();
    expect(f.store.inspect).not.toHaveBeenCalled();
  });
  it('never starts a partial or failed archive download', async () => {
    const f = fixture();
    expect(await f.service.download(id, ctx)).toEqual(
      err(expect.any(CanonicalIdentityConflict))
    );
    expect(f.store.download).not.toHaveBeenCalled();
    f.store.inspect.mockResolvedValue({
      ...f.job,
      status: 'ready',
      attempts: 1,
      readyAt: 101,
      bytes: 1,
      sha256: 'a'.repeat(64),
    });
    expect(await f.service.download(id, ctx)).toMatchObject({ ok: true });
    expect(f.store.download).toHaveBeenCalledWith('Member', id);
  });
  it('rejects corrupted or mismatched storage responses as unavailable', async () => {
    const f = fixture();
    f.store.latest.mockResolvedValue({ ...f.job, secret: 'unexpected' });
    expect(await f.service.latest(ctx)).toEqual(
      err(expect.any(CanonicalIdentityUnavailable))
    );
    f.store.inspect.mockResolvedValue({
      ...f.job,
      id: '00000000-0000-4000-8000-000000000002',
    });
    expect(await f.service.inspect(id, ctx)).toEqual(
      err(expect.any(CanonicalIdentityUnavailable))
    );
  });
  it('represents no request explicitly and preserves storage conflicts', async () => {
    const f = fixture();
    f.store.latest.mockResolvedValue(null);
    expect(await f.service.latest(ctx)).toEqual(ok(null));
    f.store.request.mockRejectedValue(
      new CanonicalIdentityConflict('existing export')
    );
    expect(await f.service.request('key', ctx)).toEqual(
      err(expect.any(CanonicalIdentityConflict))
    );
  });
});
