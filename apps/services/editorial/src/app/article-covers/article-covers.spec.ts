import { createHash } from 'node:crypto';
import { err, ok } from '@sdk/kernel/standard';
import {
  ARTICLE_COVER_UPLOAD_LIFETIME,
  type ArticleCoverUpload,
} from '@domains/catalog/media';
import { ArticleCovers } from './article-covers';
import type {
  ArticleCoverStore,
  ArticleCoverNormalizer,
  ArticleCoverObjects,
} from './article-cover.ports';

const id = '019a0010-0000-7000-8000-000000000001';
const articleId = '019a0010-0000-7000-8000-000000000002';
const actor = { identityId: 'Uploader', tenantId: 'default', roles: [] };
const bytes = Buffer.from('source image bytes');
const normalized = Buffer.from('normalized image bytes');
const digest = (value: Uint8Array) =>
  createHash('sha256').update(value).digest('hex');
const source = {
  contentType: 'image/png' as const,
  bytes: bytes.length,
  sha256: digest(bytes),
};
const input = { articleId, source };
const upload: ArticleCoverUpload = {
  ...input,
  id,
  revision: 1,
  status: 'pending',
  createdAt: 10,
  expiresAt: 10 + ARTICLE_COVER_UPLOAD_LIFETIME,
  asset: null,
};
const receipt = { id, revision: 2, status: 'ready' as const };

describe('article cover orchestration', () => {
  let store: jest.Mocked<ArticleCoverStore>;
  let normalizer: jest.Mocked<ArticleCoverNormalizer>;
  let objects: jest.Mocked<ArticleCoverObjects>;
  beforeEach(() => {
    store = {
      list: jest.fn(),
      cancel: jest.fn(),
      create: jest.fn(),
      read: jest.fn(),
      reserve: jest.fn().mockResolvedValue({ upload, lease: 'fenced' }),
      complete: jest.fn().mockResolvedValue(receipt),
      fail: jest.fn().mockResolvedValue(undefined),
    };
    normalizer = {
      normalize: jest
        .fn()
        .mockResolvedValue({ bytes: normalized, width: 64, height: 64 }),
    };
    objects = {
      putImmutable: jest.fn().mockResolvedValue(undefined),
      read: jest.fn(),
    };
  });
  const service = (policy = { evaluate: async () => ok(true) }) =>
    new ArticleCovers(
      store,
      normalizer,
      objects,
      policy,
      { generate: () => id },
      () => 20
    );
  it('requires explicit authorization before reading, reserving, decoding or storing images', async () => {
    const denied = service({ evaluate: async () => ok(false) });
    await expect(denied.create(actor, input, 'key')).rejects.toThrow();
    await expect(denied.read(actor, id)).rejects.toThrow();
    await expect(denied.list(actor, articleId)).rejects.toThrow();
    await expect(
      denied.cancel(actor, id, { expectedRevision: 1 }, 'key')
    ).rejects.toThrow();
    await expect(
      denied.upload(actor, id, { expectedRevision: 1 }, bytes, 'key')
    ).rejects.toThrow();
    expect(store.create).not.toHaveBeenCalled();
    expect(store.read).not.toHaveBeenCalled();
    expect(store.reserve).not.toHaveBeenCalled();
    expect(store.list).not.toHaveBeenCalled();
    expect(store.cancel).not.toHaveBeenCalled();
    expect(normalizer.normalize).not.toHaveBeenCalled();
    expect(objects.putImmutable).not.toHaveBeenCalled();
  });
  it('fails closed on policy outage', async () => {
    const unavailable = new ArticleCovers(
      store,
      normalizer,
      objects,
      { evaluate: async () => err(new Error('offline')) },
      { generate: () => id }
    );
    await expect(unavailable.create(actor, input, 'key')).rejects.toThrow(
      'authorization unavailable'
    );
    await expect(unavailable.list(actor, articleId)).rejects.toThrow(
      'authorization unavailable'
    );
    await expect(
      unavailable.cancel(actor, id, { expectedRevision: 1 }, 'key')
    ).rejects.toThrow('authorization unavailable');
    expect(store.create).not.toHaveBeenCalled();
    expect(store.list).not.toHaveBeenCalled();
    expect(store.cancel).not.toHaveBeenCalled();
  });
  it('lists retained uploads only through the authorized canonical draft scope', async () => {
    store.list.mockResolvedValue([upload]);
    await expect(service().list(actor, articleId)).resolves.toEqual([upload]);
    expect(store.list).toHaveBeenCalledWith(actor, articleId, 20);
    await expect(service().list(actor, 'invalid')).rejects.toThrow();
    expect(store.list).toHaveBeenCalledTimes(1);
  });
  it('binds cancellation retries to the image and expected revision without object I/O', async () => {
    const evaluate = jest.fn().mockResolvedValue(ok(true));
    const cancelled = { id, revision: 2, status: 'cancelled' as const };
    store.cancel.mockResolvedValue(cancelled);
    const api = service({ evaluate });
    await expect(
      api.cancel(actor, id, { expectedRevision: 1 }, 'cancel-key')
    ).resolves.toEqual(cancelled);
    await api.cancel(actor, id, { expectedRevision: 1 }, 'cancel-key');
    const first = store.cancel.mock.calls[0][0];
    expect(store.cancel.mock.calls[1][0]).toEqual(first);
    expect(first).toEqual({
      actor,
      id,
      expectedRevision: 1,
      key: 'cancel-key',
      at: 20,
      fingerprint: digest(
        Buffer.from(
          JSON.stringify({ action: 'cancel', id, expectedRevision: 1 })
        )
      ),
    });
    await api.cancel(actor, id, { expectedRevision: 2 }, 'cancel-key');
    expect(store.cancel.mock.calls[2][0].fingerprint).not.toBe(
      first.fingerprint
    );
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'editorial.article-cover.cancel',
      })
    );
    expect(objects.putImmutable).not.toHaveBeenCalled();
    expect(objects.read).not.toHaveBeenCalled();
    expect(normalizer.normalize).not.toHaveBeenCalled();
  });
  it.each([
    [{ expectedRevision: 0 }, 'key'],
    [{ expectedRevision: 1, ownerIdentityId: 'other' }, 'key'],
    [{ expectedRevision: '1' }, 'key'],
    [{ expectedRevision: 1 }, ''],
  ])(
    'rejects invalid cancellation intent before persistence %#',
    async (input, key) => {
      await expect(service().cancel(actor, id, input, key)).rejects.toThrow();
      expect(store.cancel).not.toHaveBeenCalled();
    }
  );
  it('reserves immutable input under the trusted actor without writing objects', async () => {
    await service().create(actor, input, 'create-key');
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({ actor, id, key: 'create-key', input })
    );
    expect(objects.putImmutable).not.toHaveBeenCalled();
  });
  it('commits normalized metadata only after immutable storage and fences completion with the lease', async () => {
    const gate = jest.fn();
    objects.putImmutable.mockImplementation(async () => {
      gate();
    });
    store.complete.mockImplementation(async () => {
      expect(gate).toHaveBeenCalledTimes(1);
      return receipt;
    });
    await expect(
      service().upload(actor, id, { expectedRevision: 1 }, bytes, 'content-key')
    ).resolves.toEqual(receipt);
    expect(normalizer.normalize).toHaveBeenCalledWith(bytes, 'image/png');
    const asset = {
      id,
      contentType: 'image/webp',
      bytes: normalized.length,
      width: 64,
      height: 64,
      sha256: digest(normalized),
    };
    expect(objects.putImmutable).toHaveBeenCalledWith(asset, normalized);
    expect(store.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        id,
        key: 'content-key',
        sourceSha256: source.sha256,
        sourceBytes: bytes.length,
      }),
      'fenced',
      asset,
      20
    );
  });
  it('replays a recorded receipt without needing the decoder or object store', async () => {
    store.reserve.mockResolvedValue({ receipt });
    await expect(
      service().upload(actor, id, { expectedRevision: 1 }, bytes, 'content-key')
    ).resolves.toEqual(receipt);
    expect(normalizer.normalize).not.toHaveBeenCalled();
    expect(objects.putImmutable).not.toHaveBeenCalled();
    expect(store.complete).not.toHaveBeenCalled();
  });
  it('never commits ready metadata after an object-storage failure', async () => {
    objects.putImmutable.mockRejectedValue(new Error('object store offline'));
    await expect(
      service().upload(actor, id, { expectedRevision: 1 }, bytes, 'key')
    ).rejects.toThrow('offline');
    expect(store.complete).not.toHaveBeenCalled();
    expect(store.fail).toHaveBeenCalledWith(
      expect.objectContaining({ id, key: 'key' }),
      'fenced',
      20
    );
  });
  it('rechecks canonical access after loading private bytes', async () => {
    store.read
      .mockResolvedValueOnce({
        ...upload,
        status: 'ready',
        asset: {
          id,
          contentType: 'image/webp',
          bytes: normalized.length,
          sha256: digest(normalized),
          width: 64,
          height: 64,
        },
      })
      .mockRejectedValueOnce(new Error('draft deleted'));
    objects.read.mockResolvedValue(normalized);
    await expect(service().content(actor, id)).rejects.toThrow('draft deleted');
    expect(store.read).toHaveBeenCalledTimes(2);
  });
  it('does not claim completion when its fenced SQL commit fails after object upload', async () => {
    store.complete.mockRejectedValue(new Error('lease replaced'));
    await expect(
      service().upload(actor, id, { expectedRevision: 1 }, bytes, 'key')
    ).rejects.toThrow('lease replaced');
    expect(objects.putImmutable).toHaveBeenCalledTimes(1);
  });
  it('rejects a mismatched reserved source before decoding or object writes', async () => {
    await expect(
      service().upload(
        actor,
        id,
        { expectedRevision: 1 },
        Buffer.from('another image'),
        'key'
      )
    ).rejects.toThrow('exact file');
    expect(normalizer.normalize).not.toHaveBeenCalled();
    expect(objects.putImmutable).not.toHaveBeenCalled();
  });
  it('rejects invalid command fields before reserving storage', async () => {
    await expect(
      service().upload(
        actor,
        id,
        { expectedRevision: 1, ownerIdentityId: 'other' },
        bytes,
        'key'
      )
    ).rejects.toThrow();
    await expect(
      service().upload(actor, id, { expectedRevision: 1 }, bytes, '')
    ).rejects.toThrow();
    expect(store.reserve).not.toHaveBeenCalled();
  });
});
