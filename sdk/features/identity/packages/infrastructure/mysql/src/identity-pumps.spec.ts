import type { IConfirmedQueueChannel } from '@sdk/platform/queue';
import { CompleteIdentityDeletion } from '@sdk/features/identity/libs/management';
import { IdentityEventPump } from './identity-event-pump';
import { IdentityDeletionPump } from './identity-deletion-pump';

describe('identity worker coordination', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const config = {
    host: 'localhost',
    port: '5672',
    username: 'test',
    password: 'test',
  };

  it('does not claim SQL work while the broker is unavailable, then reconnects', async () => {
    const queue = {
      isOpen: () => true,
      assertQueue: jest.fn().mockResolvedValue({ queue: 'identity-events' }),
    } as unknown as IConfirmedQueueChannel;
    const broker = {
      close: jest.fn().mockResolvedValue(undefined),
      connect: jest
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue(queue),
    };
    const outbox = {
      claim: jest.fn().mockResolvedValue(null),
      delivered: jest.fn(),
      failed: jest.fn(),
    };
    const pump = new IdentityEventPump(
      outbox,
      broker,
      config,
      'identity-events',
      jest.fn()
    );
    pump.start();
    pump.start();
    await jest.advanceTimersByTimeAsync(1);
    expect(outbox.claim).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1000);
    expect(outbox.claim).toHaveBeenCalledTimes(1);
    await pump.stop();
    await jest.advanceTimersByTimeAsync(10000);
    expect(broker.connect).toHaveBeenCalledTimes(2);
  });

  it('does not overlap deletion batches and waits for active work on shutdown', async () => {
    let release!: () => void;
    const removal = new Promise<void>((resolve) => {
      release = resolve;
    });
    const jobs = {
      claim: jest
        .fn()
        .mockResolvedValue({
          identityId: 'Uid',
          revision: 2,
          attempts: 0,
          tombstone: true,
        }),
      complete: jest.fn().mockResolvedValue(true),
      failed: jest.fn(),
    };
    const worker = new CompleteIdentityDeletion(
      jobs,
      { remove: () => removal },
      () => 'lease'
    );
    const pump = new IdentityDeletionPump(worker, jest.fn());
    pump.start();
    await jest.advanceTimersByTimeAsync(5000);
    expect(jobs.claim).toHaveBeenCalledTimes(1);
    let stopped = false;
    const stop = pump.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    release();
    await stop;
    await jest.advanceTimersByTimeAsync(10000);
    expect(jobs.complete).toHaveBeenCalledTimes(1);
    expect(jobs.claim).toHaveBeenCalledTimes(1);
  });
});
