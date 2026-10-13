import { createHash } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import { S3ApplicationImages } from './s3-application-images';

describe('private image reads with caller cancellation', () => {
  const bytes = Buffer.from('normalized image bytes');
  const asset = {
    id: '019a0010-0000-7000-8000-000000000001',
    purpose: 'banner' as const,
    contentType: 'image/webp' as const,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    width: 800,
    height: 300,
  };
  let client: S3Client, send: jest.SpyInstance;
  beforeEach(() => {
    client = new S3Client({
      region: 'us-east-1',
      credentials: { accessKeyId: 'fixture', secretAccessKey: 'fixture' },
    });
    send = jest.spyOn(client, 'send');
  });
  afterEach(() => {
    client.destroy();
    jest.restoreAllMocks();
  });
  const reader = () => new S3ApplicationImages(client, 'private-images');
  const response = (Body: Readable) => ({
    Body,
    ContentLength: bytes.length,
    ContentType: asset.contentType,
  });

  it('does no I/O for an already cancelled capture', async () => {
    const controller = new AbortController();
    controller.abort(new Error('capture stopped'));
    await expect(reader().read(asset, controller.signal)).rejects.toThrow(
      'capture stopped'
    );
    expect(send).not.toHaveBeenCalled();
  });
  it('destroys a stalled body when the caller cancels', async () => {
    const stream = new PassThrough();
    send.mockResolvedValue(response(stream));
    const controller = new AbortController();
    const pending = reader().read(asset, controller.signal);
    const rejected = expect(pending).rejects.toThrow('unavailable');
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await rejected;
    expect(stream.destroyed).toBe(true);
    expect(send.mock.calls[0][1].abortSignal.aborted).toBe(true);
  });
  it('discards a response acquired after cancellation and releases its body', async () => {
    const stream = Readable.from([bytes]);
    let deliver: (value: ReturnType<typeof response>) => void = () => undefined;
    send.mockImplementation(
      () =>
        new Promise((resolve) => {
          deliver = resolve;
        })
    );
    const controller = new AbortController();
    const pending = reader().read(asset, controller.signal);
    controller.abort();
    deliver(response(stream));
    await expect(pending).rejects.toThrow('unavailable');
    expect(stream.destroyed).toBe(true);
  });
  it('retains byte/hash verification and removes the caller listener after success', async () => {
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    send.mockResolvedValueOnce(response(Readable.from([bytes])));
    expect(await reader().read(asset, controller.signal)).toEqual(bytes);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    send.mockResolvedValueOnce(
      response(Readable.from([Buffer.alloc(bytes.length)]))
    );
    await expect(reader().read(asset, controller.signal)).rejects.toThrow(
      'descriptor'
    );
  });
});
