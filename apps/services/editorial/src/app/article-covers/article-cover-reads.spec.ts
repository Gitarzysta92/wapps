import { err, ok } from '@sdk/kernel/standard';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  ArticleCoverNotFoundError,
  type ArticleCoverAsset,
} from '@domains/catalog/media';
import {
  ArticleCoverReads,
  type ArticleCoverReadStore,
} from './article-cover-reads';
import type { ArticleCoverObjects } from './article-cover.ports';

const id = '019a0010-0000-7000-8000-000000000001';
const imageId = '019a0010-0000-7000-8000-000000000002';
const actor = { identityId: 'Alice', tenantId: 'default', roles: [] };
const asset: ArticleCoverAsset = {
  id: imageId,
  contentType: 'image/webp',
  bytes: 12,
  sha256: 'a'.repeat(64),
  width: 12,
  height: 12,
};
describe('article cover access', () => {
  let store: jest.Mocked<ArticleCoverReadStore>,
    objects: jest.Mocked<ArticleCoverObjects>,
    policy: jest.Mocked<IPolicyEvaluator>;
  beforeEach(() => {
    store = {
      submission: jest.fn().mockResolvedValue(asset),
      published: jest.fn().mockResolvedValue(asset),
    };
    objects = {
      read: jest.fn().mockResolvedValue(new Uint8Array(12)),
      putImmutable: jest.fn(),
    };
    policy = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  });
  const service = () => new ArticleCoverReads(store, objects, policy);
  it.each([false, true])(
    'denies private access before SQL and object I/O (review: %s)',
    async (review) => {
      policy.evaluate.mockResolvedValue(ok(false));
      await expect(
        service().submission(actor, id, 2, review)
      ).rejects.toBeInstanceOf(PermissionDeniedError);
      expect(store.submission).not.toHaveBeenCalled();
      expect(objects.read).not.toHaveBeenCalled();
    }
  );
  it.each(['throw', 'result'])(
    'fails closed on policy outage (%s)',
    async (mode) => {
      if (mode === 'throw')
        policy.evaluate.mockRejectedValue(new Error('offline'));
      else policy.evaluate.mockResolvedValue(err(new Error('offline')));
      await expect(service().submission(actor, id, 2, true)).rejects.toThrow(
        'authorization is unavailable'
      );
      expect(objects.read).not.toHaveBeenCalled();
    }
  );
  it('resolves the frozen submission under independent review policy twice', async () => {
    await service().submission(actor, id, 7, true);
    expect(store.submission).toHaveBeenCalledTimes(2);
    expect(store.submission).toHaveBeenCalledWith(actor, id, 7, true);
    expect(policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'editorial.article.review',
        resource: { type: 'article-review', id, tenantId: 'default' },
      })
    );
  });
  it('withholds already-loaded bytes after policy revocation', async () => {
    policy.evaluate
      .mockResolvedValueOnce(ok(true))
      .mockResolvedValueOnce(ok(false));
    await expect(
      service().submission(actor, id, 2, true)
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(objects.read).toHaveBeenCalledTimes(1);
  });
  it.each(['submission', 'published'] as const)(
    'rechecks %s authority after object I/O',
    async (kind) => {
      store[kind]
        .mockResolvedValueOnce(asset)
        .mockRejectedValueOnce(new ArticleCoverNotFoundError('Withdrawn'));
      const result =
        kind === 'published'
          ? service().published(id, imageId)
          : service().submission(actor, id, 2, false);
      await expect(result).rejects.toThrow('Withdrawn');
      expect(store[kind]).toHaveBeenCalledTimes(2);
      expect(objects.read).toHaveBeenCalledTimes(1);
    }
  );
  it('rejects a reference replaced during object I/O', async () => {
    store.published
      .mockResolvedValueOnce(asset)
      .mockResolvedValueOnce({ ...asset, sha256: 'b'.repeat(64) });
    await expect(service().published(id, imageId)).rejects.toThrow(
      'changed while loading'
    );
  });
  it('uses canonical public authority without depending on a private session', async () => {
    await expect(service().published(id, imageId)).resolves.toEqual({
      asset,
      bytes: new Uint8Array(12),
    });
    expect(store.published).toHaveBeenCalledTimes(2);
    expect(policy.evaluate).not.toHaveBeenCalled();
  });
});
