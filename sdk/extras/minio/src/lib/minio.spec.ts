import { Readable } from 'node:stream';
import {
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  GetBucketVersioningCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { MinioClient } from './minio';

jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual('@aws-sdk/client-s3'),
  S3Client: jest.fn(),
}));

describe('MinIO bounded immutable object access', () => {
  const send = jest.fn();
  let client: MinioClient;
  beforeEach(() => {
    send.mockReset();
    jest
      .mocked(S3Client)
      .mockImplementation(() => ({ send } as unknown as S3Client));
    client = new MinioClient({
      host: 'http://localhost:9000',
      accessKey: 'test',
      secretKey: 'test',
    });
  });

  it('uses conditional writes so a committed payload key cannot be overwritten', async () => {
    await client.putImmutableBytes('bucket', 'version', Buffer.from('{}'));
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'bucket',
      Key: 'version',
      IfNoneMatch: '*',
    });
  });

  it('returns exact bytes for hash verification', async () => {
    send.mockResolvedValue({
      Body: Readable.from([Buffer.from('a'), Buffer.from('bc')]),
      ContentLength: 3,
    });
    expect(await client.getBytes('bucket', 'version', 3)).toEqual(
      Buffer.from('abc')
    );
  });

  it('reads the reviewed generation with bounded bytes and retirement metadata', async () => {
    const signal = new AbortController().signal;
    send.mockResolvedValue({
      Body: Readable.from([Buffer.from('abc')]),
      ETag: 'reviewed',
      ContentLength: 3,
      ContentType: 'application/json',
      Metadata: { original: 'yes' },
    });
    expect(
      await client.getObjectSnapshot('bucket', 'key', 3, signal, 'reviewed')
    ).toEqual({
      body: Buffer.from('abc'),
      etag: 'reviewed',
      contentType: 'application/json',
      metadata: { original: 'yes' },
    });
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect(send.mock.calls[0][0].input).toMatchObject({
      Key: 'key',
      IfMatch: 'reviewed',
    });
    expect(send.mock.calls[0][1].abortSignal).toBe(signal);
  });

  it('does not retire a different generation than the operator reviewed', async () => {
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ETag: 'changed', ContentLength: 3 });
    await expect(
      client.retireImmutableBytes('bucket', 'key', 'reviewed')
    ).rejects.toThrow('generation changed');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('rechecks the reviewed generation after a conditional marker conflict', async () => {
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ETag: 'reviewed', ContentLength: 3 })
      .mockRejectedValueOnce(
        Object.assign(new Error('race'), { name: 'PreconditionFailed' })
      )
      .mockResolvedValueOnce({ ETag: 'changed', ContentLength: 4 });
    await expect(
      client.retireImmutableBytes('bucket', 'key', 'reviewed')
    ).rejects.toThrow('generation changed');
    expect(send).toHaveBeenCalledTimes(4);
  });

  it('bounds keyset inventory listing and preserves the provider truncation signal', async () => {
    const signal = new AbortController().signal;
    send.mockResolvedValue({
      Contents: [{ Key: 'next', ETag: 'etag', Size: 3 }],
      IsTruncated: true,
    });
    expect(await client.listObjectPage('bucket', 'after', 32, signal)).toEqual({
      objects: [{ Key: 'next', ETag: 'etag', Size: 3 }],
      truncated: true,
    });
    expect(send.mock.calls[0][0]).toBeInstanceOf(ListObjectsV2Command);
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: 'bucket',
      StartAfter: 'after',
      MaxKeys: 32,
    });
    await expect(
      client.listObjectPage('bucket', '', 33, signal)
    ).rejects.toThrow('page size');
    await expect(
      client.listObjectPage(
        'bucket',
        '',
        1,
        AbortSignal.abort(new Error('cancelled'))
      )
    ).rejects.toThrow('cancelled');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each(['Enabled', 'Suspended'])(
    'refuses %s versioning before inventory',
    async (Status) => {
      send.mockResolvedValue({ Status });
      await expect(
        client.requireUnversionedBucket('bucket', new AbortController().signal)
      ).rejects.toThrow('unversioned');
    }
  );

  it('retires an existing object with a conditional permanent empty marker', async () => {
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ETag: 'old', ContentLength: 12 })
      .mockResolvedValueOnce({});
    await client.retireImmutableBytes('bucket', 'key');
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetBucketVersioningCommand);
    expect(send.mock.calls[1][0]).toBeInstanceOf(HeadObjectCommand);
    expect(send.mock.calls[2][0].input).toMatchObject({
      Key: 'key',
      IfMatch: 'old',
      ContentLength: 0,
      Metadata: { 'wapps-retired': '1' },
    });
    expect(send.mock.calls[2][0].input.IfNoneMatch).toBeUndefined();
    expect(send.mock.calls[0][1].abortSignal).toBe(
      send.mock.calls[2][1].abortSignal
    );
  });

  it('blocks a missing-key upload and retries if the upload wins the first race', async () => {
    send
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        Object.assign(new Error('missing'), { name: 'NoSuchKey' })
      )
      .mockRejectedValueOnce(
        Object.assign(new Error('upload won'), {
          $metadata: { httpStatusCode: 412 },
        })
      )
      .mockResolvedValueOnce({ ETag: 'late-upload', ContentLength: 17 })
      .mockResolvedValueOnce({});
    await client.retireImmutableBytes('bucket', 'key');
    expect(send.mock.calls[2][0].input.IfNoneMatch).toBe('*');
    expect(send.mock.calls[4][0].input.IfMatch).toBe('late-upload');
  });

  it('recognizes its own durable marker after a lost response without rewriting it', async () => {
    send.mockResolvedValueOnce({}).mockResolvedValueOnce({
      ContentLength: 0,
      ContentType: 'application/x-wapps-retired-object',
      Metadata: { 'wapps-retired': '1' },
    });
    await client.retireImmutableBytes('bucket', 'key');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it.each(['Enabled', 'Suspended'])(
    'refuses %s bucket versioning because historical bytes would survive',
    async (Status) => {
      send.mockResolvedValueOnce({ Status });
      await expect(
        client.retireImmutableBytes('bucket', 'key')
      ).rejects.toThrow('unversioned');
      expect(send).toHaveBeenCalledTimes(1);
    }
  );

  it('does not acknowledge access failures or exhausted retirement races', async () => {
    send
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(client.retireImmutableBytes('bucket', 'key')).rejects.toThrow(
      'AccessDenied'
    );
    send.mockReset().mockResolvedValueOnce({});
    for (let i = 0; i < 3; i++)
      send.mockResolvedValueOnce({ ETag: `race-${i}` }).mockRejectedValueOnce(
        Object.assign(new Error('race'), {
          $metadata: { httpStatusCode: 409 },
        })
      );
    await expect(client.retireImmutableBytes('bucket', 'key')).rejects.toThrow(
      'did not converge'
    );
    expect(send).toHaveBeenCalledTimes(7);
  });

  it.each([undefined, 3])(
    'enforces stream limits even when ContentLength is %s',
    async (ContentLength) => {
      const Body = Readable.from([Buffer.from('abc'), Buffer.from('def')]);
      send.mockResolvedValue({ Body, ContentLength });
      await expect(client.getBytes('bucket', 'version', 3)).rejects.toThrow(
        'size limit'
      );
      expect(Body.destroyed).toBe(true);
    }
  );

  it('rejects an oversized advertised object before consuming its body', async () => {
    const Body = Readable.from([Buffer.from('too large')]);
    send.mockResolvedValue({ Body, ContentLength: 9 });
    await expect(client.getBytes('bucket', 'version', 3)).rejects.toThrow(
      'size limit'
    );
    expect(Body.destroyed).toBe(true);
  });

  it('does not turn an access failure into a missing object or create a bucket', async () => {
    send.mockRejectedValue(new Error('AccessDenied'));
    await expect(client.objectExists('bucket', 'key')).rejects.toThrow(
      'AccessDenied'
    );
    await expect(client.ensureBucket('bucket')).rejects.toThrow('AccessDenied');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('recognizes missing objects', async () => {
    send.mockRejectedValue(
      Object.assign(new Error('Missing'), { name: 'NoSuchKey' })
    );
    expect(await client.objectExists('bucket', 'key')).toBe(false);
  });

  it('does not open an object for an already cancelled read', async () => {
    const controller = new AbortController();
    controller.abort(new Error('Export cancelled'));
    await expect(
      client.getBytes('bucket', 'key', 10, controller.signal)
    ).rejects.toThrow('Export cancelled');
    expect(send).not.toHaveBeenCalled();
  });

  it('passes cancellation to object acquisition and destroys a stalled body', async () => {
    const controller = new AbortController();
    const Body = new Readable({
      read() {
        /* The provider never finishes the stream. */
      },
    });
    send.mockResolvedValue({ Body });
    const pending = client.getBytes('bucket', 'key', 10, controller.signal);
    const checked = expect(pending).rejects.toThrow('Export cancelled');
    await Promise.resolve();
    expect(send.mock.calls[0][1]).toEqual({ abortSignal: controller.signal });
    controller.abort(new Error('Export cancelled'));
    await checked;
    expect(Body.destroyed).toBe(true);
  });

  it('discards a late object acquired after cancellation', async () => {
    const controller = new AbortController();
    const Body = Readable.from([Buffer.from('private')]);
    send.mockImplementation(async () => {
      controller.abort(new Error('Export cancelled'));
      return { Body };
    });
    await expect(
      client.getBytes('bucket', 'key', 10, controller.signal)
    ).rejects.toThrow('Export cancelled');
    expect(Body.destroyed).toBe(true);
  });
});
