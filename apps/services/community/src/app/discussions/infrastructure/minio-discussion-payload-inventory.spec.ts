import { createHash } from 'node:crypto';
import { MinioClient } from '@sdk/extras/minio';
import { MinioDiscussionPayloadInventory } from './minio-discussion-payload-inventory';

describe('Discussion inventory object adapter', () => {
  const client = new MinioClient({
    host: 'http://localhost:9000',
    accessKey: 'test',
    secretKey: 'test',
  });
  const objects = new MinioDiscussionPayloadInventory(client);
  const entry = { Key: 'key', ETag: 'etag', Size: 3 };
  afterEach(() => jest.restoreAllMocks());
  it.each([
    { objects: [entry], truncated: undefined },
    { objects: [], truncated: true },
    { objects: [entry, entry], truncated: false },
    { objects: [{ ...entry, Size: -1 }], truncated: false },
    { objects: [{ ...entry, ETag: '' }], truncated: false },
    { objects: [{ ...entry, Key: 'x'.repeat(1025) }], truncated: false },
  ])('fails closed for malformed provider pages %p', async (page) => {
    jest.spyOn(client, 'listObjectPage').mockResolvedValue(page);
    await expect(objects.page('')).rejects.toThrow('Invalid object inventory');
  });
  it('rejects entries behind the durable cursor', async () => {
    jest
      .spyOn(client, 'listObjectPage')
      .mockResolvedValue({ objects: [entry], truncated: false });
    await expect(objects.page('z')).rejects.toThrow('ordering');
  });
  it('checks exact body size and reviewed generation independently of the provider', async () => {
    const read = jest
      .spyOn(client, 'getObjectSnapshot')
      .mockResolvedValue({
        body: Buffer.from('abc'),
        etag: 'changed',
        contentType: 'application/json',
        metadata: {},
      });
    await expect(
      objects.read({ key: 'key', etag: 'etag', bytes: 3 })
    ).rejects.toThrow('generation changed');
    read.mockResolvedValue({
      body: Buffer.from('a'),
      etag: 'etag',
      contentType: 'application/json',
      metadata: {},
    });
    await expect(
      objects.read({ key: 'key', etag: 'etag', bytes: 3 })
    ).rejects.toThrow('generation changed');
  });
  it('only accepts an exact permanent empty retirement marker', async () => {
    const read = jest
      .spyOn(client, 'getObjectSnapshot')
      .mockResolvedValue({
        body: Buffer.alloc(0),
        etag: 'etag',
        contentType: 'application/json',
        metadata: {},
      });
    await expect(
      objects.read({ key: 'key', etag: 'etag', bytes: 0 })
    ).rejects.toThrow('without a retirement marker');
    read.mockResolvedValue({
      body: Buffer.alloc(0),
      etag: 'etag',
      contentType: 'application/x-wapps-retired-object',
      metadata: { 'wapps-retired': '1' },
    });
    expect(
      (await objects.read({ key: 'key', etag: 'etag', bytes: 0 })).retired
    ).toBe(true);
  });
  it('only replays a conditional-copy conflict when stored bytes match the reservation', async () => {
    const body = Buffer.from('abc');
    const reference = {
      key: 'key',
      bytes: 3,
      sha256: createHash('sha256').update(body).digest('hex'),
    };
    jest
      .spyOn(client, 'putImmutableBytes')
      .mockRejectedValue(
        Object.assign(new Error('exists'), { name: 'PreconditionFailed' })
      );
    const read = jest.spyOn(client, 'getBytes').mockResolvedValue(body);
    await objects.copy(reference, body);
    read.mockResolvedValue(Buffer.from('bad'));
    await expect(objects.copy(reference, body)).rejects.toThrow('differs');
  });
  it('does not turn storage outage into successful copy replay', async () => {
    jest
      .spyOn(client, 'putImmutableBytes')
      .mockRejectedValue(new Error('unavailable'));
    const read = jest.spyOn(client, 'getBytes');
    await expect(
      objects.copy(
        { key: 'key', bytes: 1, sha256: 'a'.repeat(64) },
        Buffer.from('a')
      )
    ).rejects.toThrow('unavailable');
    expect(read).not.toHaveBeenCalled();
  });
});
