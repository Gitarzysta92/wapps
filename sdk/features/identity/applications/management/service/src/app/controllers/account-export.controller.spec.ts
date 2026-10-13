import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { ok } from '@sdk/kernel/standard';
import { ACCOUNT_EXPORT_LIMITS } from '@sdk/features/identity/core';
import type { AccountExportService } from '@sdk/features/identity/libs/management';
import { AccountExportController } from './account-export.controller';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('account download cancellation and capacity', () => {
  const id = '00000000-0000-4000-8000-000000000042';
  const bytes = Buffer.from('archive');
  const user = { userId: 'Member', isAnonymous: false as const };
  const job = {
    id,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const download = jest.fn();
  let controller: AccountExportController;
  beforeEach(() => {
    jest.useFakeTimers();
    download.mockReset();
    controller = new AccountExportController({
      download,
    } as unknown as AccountExportService);
  });
  afterEach(() => jest.useRealTimers());

  function call() {
    const request = Object.assign(new EventEmitter(), {
      headers: {},
      aborted: false,
    });
    const response = Object.assign(new EventEmitter(), {
      destroyed: false,
      headersSent: false,
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
      write: jest.fn(() => {
        response.headersSent = true;
        return true;
      }),
      end: jest.fn(),
      destroy: jest.fn(() => {
        response.destroyed = true;
      }),
    });
    const done = controller.download(
      user,
      id,
      {},
      request as unknown as Request,
      response as unknown as Response
    );
    return { request, response, done };
  }

  function stalled(firstChunk = false) {
    const started = deferred<void>();
    const pending = deferred<void>();
    const closed = jest.fn();
    download.mockImplementation(async () =>
      ok({
        job,
        chunks: (async function* () {
          try {
            if (firstChunk) yield bytes.subarray(0, 1);
            started.resolve();
            await pending.promise;
            yield bytes;
          } finally {
            closed();
          }
        })(),
      })
    );
    return { started, pending, closed };
  }

  it('times out a stalled initial read and observes late iterator rejection', async () => {
    const stream = stalled();
    const { done, response, request } = call();
    const rejected = expect(done).rejects.toThrow('timed out');
    await stream.started.promise;
    await jest.advanceTimersByTimeAsync(ACCOUNT_EXPORT_LIMITS.attemptMs);
    await rejected;
    expect(response.write).not.toHaveBeenCalled();
    expect(response.removeHeader).toHaveBeenCalledWith('Content-Length');
    expect(request.listenerCount('aborted')).toBe(0);
    expect(response.listenerCount('close')).toBe(0);
    stream.pending.reject(new Error('Late SQL failure'));
    await jest.advanceTimersByTimeAsync(0);
    expect(stream.closed).toHaveBeenCalledTimes(1);
  });

  it('destroys an incomplete response on deadline even while its next read stalls', async () => {
    const stream = stalled(true);
    const { done, response } = call();
    await stream.started.promise;
    await jest.advanceTimersByTimeAsync(ACCOUNT_EXPORT_LIMITS.attemptMs);
    await done;
    expect(response.destroy).toHaveBeenCalledTimes(1);
    expect(response.end).not.toHaveBeenCalled();
    stream.pending.resolve();
    await jest.advanceTimersByTimeAsync(0);
    expect(stream.closed).toHaveBeenCalledTimes(1);
    expect(response.write).toHaveBeenCalledTimes(1);
  });

  it('closes disconnected handlers promptly while bounding outstanding SQL reads', async () => {
    const stream = stalled();
    const active = Array.from({ length: 4 }, () => call());
    await jest.advanceTimersByTimeAsync(0);
    for (const { response } of active) {
      response.destroyed = true;
      response.emit('close');
    }
    await Promise.all(active.map(({ done }) => done));
    await expect(call().done).rejects.toThrow('downloads are busy');
    expect(stream.closed).not.toHaveBeenCalled();
    stream.pending.resolve();
    await jest.advanceTimersByTimeAsync(0);
    expect(stream.closed).toHaveBeenCalledTimes(4);
    const recovered = call();
    await recovered.done;
    expect(recovered.response.end).toHaveBeenCalledTimes(1);
  });
});
