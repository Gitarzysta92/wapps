import { createHash } from 'node:crypto';
import { MinioClient } from '@sdk/extras/minio';
import { MinioDiscussionExportPayloads } from './discussion-export-payloads';

const nodeId = '00000000-0000-4000-8000-000000000001';
const key = `discussions/${nodeId}/versions/00000000-0000-4000-8000-000000000002.json`;
const body = Buffer.from(
  JSON.stringify({
    content: { text: 'My contribution' },
    internal: 'Do not export envelope fields',
  })
);
const reference = {
  key,
  sha256: createHash('sha256').update(body).digest('hex'),
  bytes: body.length,
};

describe('Discussion account export immutable payloads', () => {
  const read = jest.fn();
  const minio = { getBytes: read } as unknown as MinioClient;
  const source = new MinioDiscussionExportPayloads(minio);
  beforeEach(() => read.mockReset().mockResolvedValue(body));
  afterEach(() => jest.useRealTimers());

  it('exports only authored content after verifying exact immutable bytes', async () => {
    await expect(
      source.read(nodeId, reference, new AbortController().signal)
    ).resolves.toEqual({ text: 'My contribution' });
    expect(read).toHaveBeenCalledWith(
      'discussion-content',
      key,
      body.length,
      expect.any(AbortSignal)
    );
  });

  it.each([
    { key: key.replace(nodeId, '00000000-0000-4000-8000-000000000009') },
    { key: '../../credentials.json' },
    { bytes: 0 },
    { bytes: 256 * 1024 + 1 },
    { sha256: 'invalid' },
  ])(
    'rejects foreign or malformed committed references before I/O: %p',
    async (change) => {
      await expect(
        source.read(
          nodeId,
          { ...reference, ...change },
          new AbortController().signal
        )
      ).rejects.toThrow('reference');
      expect(read).not.toHaveBeenCalled();
    }
  );

  it.each([Buffer.from('truncated'), Buffer.alloc(body.length, 32)])(
    'rejects missing or changed bytes',
    async (bytes) => {
      read.mockResolvedValue(bytes);
      await expect(
        source.read(nodeId, reference, new AbortController().signal)
      ).rejects.toThrow('integrity');
    }
  );

  it.each([
    Buffer.from('{'),
    Buffer.from('{"missing":1}'),
    Buffer.from('[1]'),
    Buffer.from([0xff]),
  ])('rejects malformed JSON or UTF-8', async (bytes) => {
    read.mockResolvedValue(bytes);
    await expect(
      source.read(
        nodeId,
        {
          key,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
        new AbortController().signal
      )
    ).rejects.toThrow('content');
  });

  it('propagates object loss without reporting source completion', async () => {
    read.mockRejectedValue(new Error('NoSuchKey'));
    await expect(
      source.read(nodeId, reference, new AbortController().signal)
    ).rejects.toThrow('NoSuchKey');
  });

  it('distinguishes an absent unconfirmed upload from a missing confirmed object', async () => {
    read.mockRejectedValue(
      Object.assign(new Error('Missing'), { name: 'NoSuchKey' })
    );
    await expect(
      source.observe(nodeId, reference, new AbortController().signal)
    ).resolves.toEqual({ kind: 'absent' });
    await expect(
      source.read(nodeId, reference, new AbortController().signal)
    ).rejects.toThrow('Confirmed discussion object is missing');
  });

  it('recovers exact reserved bytes after an upload response was lost', async () => {
    await expect(
      source.observe(nodeId, reference, new AbortController().signal)
    ).resolves.toEqual({
      kind: 'present',
      content: { text: 'My contribution' },
    });
  });

  it.each([
    Object.assign(new Error('Missing bucket'), { name: 'NoSuchBucket' }),
    Object.assign(new Error('Generic 404'), {
      $metadata: { httpStatusCode: 404 },
    }),
    Object.assign(new Error('Denied'), { name: 'AccessDenied' }),
    new Error('Storage unavailable'),
  ])('never turns %s into an absent reserved upload', async (error) => {
    read.mockRejectedValue(error);
    await expect(
      source.observe(nodeId, reference, new AbortController().signal)
    ).rejects.toBe(error);
  });

  it('does not mistake a retirement marker for a missing or empty payload', async () => {
    read.mockResolvedValue(Buffer.alloc(0));
    await expect(
      source.observe(nodeId, reference, new AbortController().signal)
    ).rejects.toThrow('integrity');
  });

  it('gives cancellation precedence over an absent-object response', async () => {
    const controller = new AbortController();
    read.mockImplementation(async () => {
      controller.abort(new Error('Cancelled before absence observed'));
      throw Object.assign(new Error('Missing'), { name: 'NoSuchKey' });
    });
    await expect(
      source.observe(nodeId, reference, controller.signal)
    ).rejects.toThrow('Cancelled before absence observed');
  });

  it('stops a provider read at its deadline', async () => {
    jest.useFakeTimers();
    read.mockImplementation(
      (_bucket, _key, _bytes, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        })
    );
    const pending = source.read(
      nodeId,
      reference,
      new AbortController().signal
    );
    const checked = expect(pending).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(10_000);
    await checked;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('forwards cancellation and refuses a late provider result', async () => {
    const controller = new AbortController();
    read.mockImplementation(
      async (_bucket, _key, _bytes, signal: AbortSignal) => {
        controller.abort(new Error('Cancel capture'));
        expect(signal.aborted).toBe(true);
        return body;
      }
    );
    await expect(
      source.read(nodeId, reference, controller.signal)
    ).rejects.toThrow('Cancel capture');
  });
});
