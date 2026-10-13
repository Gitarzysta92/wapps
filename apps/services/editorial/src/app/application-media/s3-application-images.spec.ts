import {
  GetBucketVersioningCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  S3ApplicationImages,
  applicationImageObjectKey,
} from './s3-application-images';

describe('private S3 image retirement', () => {
  const id = '019a0010-0000-7000-8000-000000000001';
  const bucket = 'private-images';
  let client: S3Client;
  let send: jest.SpyInstance;
  const status = (code: number) =>
    Object.assign(new Error('storage response'), {
      $metadata: { httpStatusCode: code },
    });
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
  const retire = () => new S3ApplicationImages(client, bucket).retire(id);
  it('replaces only the inspected object generation with an empty permanent marker', async () => {
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ETag: 'generation', ContentLength: 120 })
      .mockResolvedValueOnce({});
    await retire();
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetBucketVersioningCommand);
    expect(send.mock.calls[1][0]).toBeInstanceOf(HeadObjectCommand);
    expect(send.mock.calls[2][0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[2][0].input).toEqual({
      Bucket: bucket,
      Key: applicationImageObjectKey(id),
      Body: new Uint8Array(0),
      ContentLength: 0,
      ContentType: 'application/x-wapps-retired-image',
      CacheControl: 'private, no-store',
      Metadata: { 'retired-image-id': id },
      IfMatch: 'generation',
    });
    expect(send.mock.calls[2][1].abortSignal).toBe(
      send.mock.calls[0][1].abortSignal
    );
  });
  it('creates an absent-key marker conditionally, so a concurrent upload cannot be overwritten blindly', async () => {
    send
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(status(404))
      .mockResolvedValueOnce({});
    await retire();
    expect(send.mock.calls[2][0].input).toMatchObject({
      IfNoneMatch: '*',
      ContentLength: 0,
    });
    expect(send.mock.calls[2][0].input.IfMatch).toBeUndefined();
  });
  it.each([409, 412])(
    'rechecks the current generation after a conditional write race (%s)',
    async (code) => {
      send
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(status(404))
        .mockRejectedValueOnce(status(code))
        .mockResolvedValueOnce({ ETag: 'late-upload', ContentLength: 80 })
        .mockResolvedValueOnce({});
      await retire();
      expect(send.mock.calls[4][0].input.IfMatch).toBe('late-upload');
      expect(send).toHaveBeenCalledTimes(5);
    }
  );
  it('confirms an exact existing marker without rewriting it', async () => {
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        ContentLength: 0,
        ContentType: 'application/x-wapps-retired-image',
        Metadata: { 'retired-image-id': id },
      });
    await retire();
    expect(send).toHaveBeenCalledTimes(2);
  });
  it.each(['Enabled', 'Suspended'])(
    'refuses versioning %s because replacing the live version would retain image bytes',
    async (Status) => {
      send.mockResolvedValueOnce({ Status });
      await expect(retire()).rejects.toThrow('unversioned bucket');
      expect(send).toHaveBeenCalledTimes(1);
    }
  );
  it('bounds conditional race retries without claiming byte reclamation', async () => {
    send.mockResolvedValueOnce({});
    for (let attempt = 0; attempt < 3; attempt++)
      send
        .mockResolvedValueOnce({ ETag: 'changing' })
        .mockRejectedValueOnce(status(412));
    await expect(retire()).rejects.toThrow('Could not confirm');
    expect(send).toHaveBeenCalledTimes(7);
  });
  it('does not interpret permission failures as an absent object', async () => {
    send.mockResolvedValueOnce({}).mockRejectedValueOnce(status(403));
    await expect(retire()).rejects.toThrow('Could not confirm');
    expect(send).toHaveBeenCalledTimes(2);
  });
});
