import { err, ok } from '@sdk/kernel/standard';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  ApplicationImageNotFoundError,
  ApplicationImageUnavailableError,
  type ApplicationImageAsset,
} from '@domains/catalog/media';
import {
  ApplicationImageReads,
  type ApplicationImageReadStore,
} from './application-image-reads';
import type { ApplicationImageObjects } from './application-image.ports';

const id = '019a0010-0000-7000-8000-000000000001';
const imageId = '019a0010-0000-7000-8000-000000000002';
const actor = { identityId: 'Alice', tenantId: 'default', roles: [] };
const asset: ApplicationImageAsset = {
  id: imageId,
  purpose: 'logo',
  contentType: 'image/webp',
  bytes: 12,
  sha256: 'a'.repeat(64),
  width: 12,
  height: 12,
};

describe('application image read authority', () => {
  let store: jest.Mocked<ApplicationImageReadStore>;
  let objects: jest.Mocked<ApplicationImageObjects>;
  let policy: jest.Mocked<IPolicyEvaluator>;
  beforeEach(() => {
    store = {
      draft: jest.fn().mockResolvedValue(asset),
      source: jest.fn().mockResolvedValue(asset),
      submission: jest.fn().mockResolvedValue(asset),
      published: jest.fn().mockResolvedValue(asset),
    };
    objects = {
      read: jest.fn().mockResolvedValue(new Uint8Array(12)),
      putImmutable: jest.fn(),
    };
    policy = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  });
  const service = () => new ApplicationImageReads(store, objects, policy);
  it('denies owner and reviewer reads before authority or object storage access', async () => {
    policy.evaluate.mockResolvedValue(ok(false));
    await expect(service().draft(actor, id, 'logo')).rejects.toBeInstanceOf(
      PermissionDeniedError
    );
    await expect(
      service().draft(actor, id, 'logo', true)
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      service().submission(actor, id, 2, 'logo', true)
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    for (const read of Object.values(store))
      expect(read).not.toHaveBeenCalled();
    expect(objects.read).not.toHaveBeenCalled();
  });
  it.each(['result', 'throw'])(
    'fails closed on policy outage (%s)',
    async (failure) => {
      if (failure === 'result')
        policy.evaluate.mockResolvedValue(err(new Error('offline')));
      else policy.evaluate.mockRejectedValue(new Error('offline'));
      await expect(service().draft(actor, id, 'logo')).rejects.toBeInstanceOf(
        ApplicationImageUnavailableError
      );
      expect(objects.read).not.toHaveBeenCalled();
    }
  );
  it('binds owner and independent reviewer access to the appropriate policy and frozen revision', async () => {
    await service().submission(actor, id, 7, 'logo', true);
    expect(store.submission).toHaveBeenNthCalledWith(
      1,
      actor,
      id,
      7,
      'logo',
      true
    );
    expect(store.submission).toHaveBeenNthCalledWith(
      2,
      actor,
      id,
      7,
      'logo',
      true
    );
    expect(policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: 'Alice',
        tenantId: 'default',
        actionName: 'editorial.application.review',
        resource: { type: 'application-review', id, tenantId: 'default' },
      })
    );
    await service().draft(actor, id, 'logo', true);
    expect(store.source).toHaveBeenCalledTimes(2);
    expect(policy.evaluate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionName: 'editorial.application-draft.read',
        resource: {
          type: 'application-workspace',
          id: 'Alice',
          tenantId: 'default',
        },
      })
    );
  });
  it('does not return already-loaded private bytes after permission is revoked', async () => {
    policy.evaluate
      .mockResolvedValueOnce(ok(true))
      .mockResolvedValueOnce(ok(false));
    await expect(service().draft(actor, id, 'logo')).rejects.toBeInstanceOf(
      PermissionDeniedError
    );
    expect(objects.read).toHaveBeenCalledTimes(1);
    expect(store.draft).toHaveBeenCalledTimes(1);
  });
  it.each(['draft', 'source', 'submission', 'published'] as const)(
    'rechecks %s authority after object access',
    async (kind) => {
      store[kind]
        .mockResolvedValueOnce(asset)
        .mockRejectedValueOnce(
          new ApplicationImageNotFoundError('Access retired')
        );
      const reads = service();
      const result =
        kind === 'published'
          ? reads.published(id, 'logo', imageId)
          : kind === 'submission'
          ? reads.submission(actor, id, 2, 'logo', false)
          : reads.draft(actor, id, 'logo', kind === 'source');
      await expect(result).rejects.toThrow('Access retired');
      expect(store[kind]).toHaveBeenCalledTimes(2);
      expect(objects.read).toHaveBeenCalledTimes(1);
    }
  );
  it.each([{ id }, { sha256: 'b'.repeat(64) }, { purpose: 'banner' as const }])(
    'rejects an image reference replaced during I/O (%j)',
    async (change) => {
      store.draft
        .mockResolvedValueOnce(asset)
        .mockResolvedValueOnce({ ...asset, ...change });
      await expect(service().draft(actor, id, 'logo')).rejects.toThrow(
        'reference changed'
      );
    }
  );
  it('uses current public authority independently of private policy', async () => {
    await expect(service().published(id, 'logo', imageId)).resolves.toEqual({
      asset,
      bytes: new Uint8Array(12),
    });
    expect(store.published).toHaveBeenCalledWith(id, 'logo', imageId);
    expect(store.published).toHaveBeenCalledTimes(2);
    expect(policy.evaluate).not.toHaveBeenCalled();
  });
  it('propagates missing object failures without inventing a preview', async () => {
    objects.read.mockRejectedValue(
      new ApplicationImageUnavailableError('Object unavailable')
    );
    await expect(service().published(id, 'logo', imageId)).rejects.toThrow(
      'Object unavailable'
    );
  });
});
