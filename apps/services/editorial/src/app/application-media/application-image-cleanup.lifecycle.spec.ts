import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ApplicationImageCleanup } from './application-image-cleanup';
import { ApplicationImageCleanupLifecycle } from './application-image-cleanup.lifecycle';

describe('image cleanup background lifecycle', () => {
  const report = {
    retired: 0,
    attempted: 0,
    completed: 0,
    scheduled: 0,
    failed: 0,
    unconfirmed: 0,
  };
  let run: jest.SpyInstance;
  const worker = (enabled?: string) =>
    new ApplicationImageCleanupLifecycle(
      new ApplicationImageCleanup(
        {
          retireUnused: jest.fn(),
          claim: jest.fn(),
          complete: jest.fn(),
          fail: jest.fn(),
        },
        { retire: jest.fn() }
      ),
      new ConfigService({ EDITORIAL_MEDIA_CLEANUP_ENABLED: enabled })
    );
  beforeEach(() => {
    jest.useFakeTimers();
    run = jest
      .spyOn(ApplicationImageCleanup.prototype, 'runBatch')
      .mockResolvedValue(report);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it.each([undefined, 'false'])(
    'does no background work without explicit activation (%s)',
    async (enabled) => {
      const lifecycle = worker(enabled);
      lifecycle.onModuleInit();
      await jest.advanceTimersByTimeAsync(3000);
      expect(run).not.toHaveBeenCalled();
      await lifecycle.onModuleDestroy();
    }
  );
  it('refuses ambiguous activation settings', () => {
    expect(() => worker('1').onModuleInit()).toThrow('true or false');
  });
  it('never overlaps batches and waits for in-flight work when stopping', async () => {
    let finish!: () => void;
    run.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(report);
        })
    );
    const lifecycle = worker('true');
    lifecycle.onModuleInit();
    await jest.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(1);
    let stopped = false;
    const stopping = lifecycle.onModuleDestroy().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    finish();
    await stopping;
    await jest.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('keeps recovery scheduled after database failure and clears its timer at shutdown', async () => {
    run.mockRejectedValueOnce(new Error('database unavailable'));
    const lifecycle = worker('true');
    lifecycle.onModuleInit();
    await jest.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(2);
    await lifecycle.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
