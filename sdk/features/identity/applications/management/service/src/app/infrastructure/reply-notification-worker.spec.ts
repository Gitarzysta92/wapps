import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliverReplyNotifications } from '@sdk/features/identity/libs/management';
import { ReplyNotificationWorker } from './reply-notification-worker';

describe('reply delivery runtime worker', () => {
  let advance: jest.SpyInstance, pump: ReplyNotificationWorker;
  const create = (enabled?: string) =>
    new ReplyNotificationWorker(
      Object.create(
        DeliverReplyNotifications.prototype
      ) as DeliverReplyNotifications,
      new ConfigService({ REPLY_NOTIFICATION_WORKER_ENABLED: enabled })
    );
  beforeEach(() => {
    jest.useFakeTimers();
    advance = jest
      .spyOn(DeliverReplyNotifications.prototype, 'advance')
      .mockResolvedValue(false);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    pump = create('true');
  });
  afterEach(async () => {
    await pump.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it('requires explicit activation', async () => {
    pump = create();
    pump.onModuleInit();
    await jest.advanceTimersByTimeAsync(5000);
    expect(advance).not.toHaveBeenCalled();
  });
  it('bounds each drain and stops future scheduling on shutdown', async () => {
    advance.mockResolvedValue(true);
    pump.onModuleInit();
    pump.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    expect(advance).toHaveBeenCalledTimes(10);
    advance.mockResolvedValue(false);
    await jest.advanceTimersByTimeAsync(1000);
    expect(advance).toHaveBeenCalledTimes(11);
    await pump.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(2000);
    expect(advance).toHaveBeenCalledTimes(11);
  });
  it('waits for in-flight work and never overlaps leases in this process', async () => {
    let complete!: (value: boolean) => void;
    advance.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          complete = resolve;
        })
    );
    pump.onModuleInit();
    await jest.advanceTimersByTimeAsync(5000);
    expect(advance).toHaveBeenCalledTimes(1);
    const stopped = pump.onModuleDestroy();
    complete(true);
    await stopped;
    await jest.advanceTimersByTimeAsync(5000);
    expect(advance).toHaveBeenCalledTimes(1);
  });
  it('resumes durable work after failure without logging private identifiers', async () => {
    advance
      .mockRejectedValueOnce(new Error('private recipient'))
      .mockResolvedValue(false);
    pump.onModuleInit();
    await jest.advanceTimersByTimeAsync(1000);
    expect(advance).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).not.toHaveBeenCalledWith(
      expect.stringContaining('private recipient')
    );
  });
});
