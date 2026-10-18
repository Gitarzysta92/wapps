import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { ACCOUNT_EXPORT_LIMITS } from '@sdk/features/identity/core';
import { PortalExportsClient } from './portal-exports.client';
import { PortalExportDownloads } from './portal-exports.download';

describe('bounded export streaming and cancellation', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  const actor = { identityId: 'Alice', headers: {} };
  const bytes = Buffer.alloc(2 * ACCOUNT_EXPORT_LIMITS.chunkBytes, 1);
  const job = {
    id,
    status: 'ready',
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const inspect = jest.fn(),
    archive = jest.fn();
  let downloads: PortalExportDownloads;
  const sources: Readable[] = [];
  beforeEach(() => {
    jest.useFakeTimers();
    inspect.mockReset().mockResolvedValue(job);
    archive.mockReset();
    sources.length = 0;
    archive.mockImplementation(async (_actor, _job, signal: AbortSignal) => {
      const source = new Readable({
        read() {
          /* Deliberately stalled transport. */
        },
      });
      sources.push(source);
      signal.addEventListener(
        'abort',
        () => source.destroy(new Error('aborted')),
        { once: true }
      );
      return source;
    });
    downloads = new PortalExportDownloads({
      inspect,
      archive,
    } as unknown as PortalExportsClient);
  });
  afterEach(() => {
    for (const source of sources) source.destroy();
    jest.useRealTimers();
  });
  function call() {
    const request = Object.assign(new EventEmitter(), { aborted: false });
    const response = Object.assign(new EventEmitter(), {
      destroyed: false,
      headersSent: false,
      setHeader: jest.fn(),
      end: jest.fn(),
      write: jest.fn<boolean, [Buffer]>(() => {
        response.headersSent = true;
        return true;
      }),
    });
    const done = downloads.send(
      actor,
      id,
      request as unknown as Request,
      response as unknown as Response
    );
    return { request, response, done };
  }
  it('aborts a stalled initial read at the total deadline and releases capacity', async () => {
    const current = call();
    const rejected = expect(current.done).rejects.toThrow('aborted');
    await jest.advanceTimersByTimeAsync(ACCOUNT_EXPORT_LIMITS.attemptMs);
    await rejected;
    expect(sources[0].destroyed).toBe(true);
    expect(current.response.write).not.toHaveBeenCalled();
    expect(current.response.end).not.toHaveBeenCalled();
    expect(current.request.listenerCount('aborted')).toBe(0);
    expect(current.response.listenerCount('close')).toBe(0);
  });
  it.each(['request', 'response'] as const)(
    'cancels upstream when the %s disconnects',
    async (side) => {
      const current = call();
      const rejected = expect(current.done).rejects.toThrow('aborted');
      await jest.advanceTimersByTimeAsync(0);
      current[side].emit(side === 'request' ? 'aborted' : 'close');
      await rejected;
      expect(sources[0].destroyed).toBe(true);
      expect(current.response.end).not.toHaveBeenCalled();
    }
  );
  it('limits the entire metadata/download operation to four concurrent requests', async () => {
    const active = Array.from({ length: 4 }, () => call());
    const pending = active.map((current) =>
      expect(current.done).rejects.toThrow('aborted')
    );
    await jest.advanceTimersByTimeAsync(0);
    await expect(call().done).rejects.toThrow('busy');
    expect(inspect).toHaveBeenCalledTimes(4);
    for (const current of active) current.response.emit('close');
    await Promise.all(pending);
    archive.mockResolvedValue(Readable.from([bytes]));
    await expect(call().done).resolves.toBeUndefined();
  });
  it('propagates cancellation while metadata is pending', async () => {
    inspect.mockImplementation(
      (_actor, _id, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new Error('metadata aborted')),
            { once: true }
          );
        })
    );
    const current = call();
    const rejected = expect(current.done).rejects.toThrow('metadata aborted');
    current.request.emit('aborted');
    await rejected;
    expect(archive).not.toHaveBeenCalled();
  });
  it('waits for downstream drain before sending remaining bytes', async () => {
    archive.mockResolvedValue(Readable.from([bytes]));
    const current = call();
    current.response.write.mockReturnValueOnce(false);
    await jest.advanceTimersByTimeAsync(0);
    expect(current.response.write).toHaveBeenCalledTimes(1);
    expect(current.response.end).not.toHaveBeenCalled();
    current.response.emit('drain');
    await current.done;
    expect(
      Buffer.concat(current.response.write.mock.calls.map(([chunk]) => chunk))
    ).toEqual(bytes);
    expect(current.response.end).toHaveBeenCalledTimes(1);
  });
  it('withholds the final bytes if the complete digest disagrees', async () => {
    inspect.mockResolvedValue({ ...job, sha256: '0'.repeat(64) });
    archive.mockResolvedValue(Readable.from([bytes]));
    const current = call();
    await expect(current.done).rejects.toThrow('corrupt');
    const sent = current.response.write.mock.calls.reduce(
      (total, [chunk]) => total + chunk.length,
      0
    );
    expect(sent).toBeGreaterThan(0);
    expect(sent).toBeLessThan(bytes.length);
    expect(current.response.end).not.toHaveBeenCalled();
  });
});
