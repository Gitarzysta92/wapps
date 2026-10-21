import { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager } from 'typeorm';
import { RabbitMqQueueClient } from '@sdk/extras/queue-rabbitmq';
import type { IConfirmedQueueChannel } from '@sdk/platform/queue';
import { EDITORIAL_PROJECTION_QUEUE } from '@apps/shared';
import { EditorialOutboxDispatcher } from './editorial-outbox.dispatcher';

describe('Editorial outbox production coordinator', () => {
  function fixture() {
    const queue = {
      assertQueue: jest
        .fn()
        .mockResolvedValue({ queue: EDITORIAL_PROJECTION_QUEUE }),
      isOpen: jest.fn().mockReturnValue(true),
      publishConfirmed: jest.fn().mockResolvedValue(undefined),
    };
    const connect = jest
      .spyOn(RabbitMqQueueClient.prototype, 'connect')
      .mockResolvedValue(queue as unknown as IConfirmedQueueChannel);
    const close = jest
      .spyOn(RabbitMqQueueClient.prototype, 'close')
      .mockResolvedValue(undefined);
    const query = jest.fn().mockResolvedValue([]);
    const transaction = jest.fn(
      async (
        _isolation: string,
        run: (manager: EntityManager) => Promise<unknown>
      ) => run({ query } as unknown as EntityManager)
    );
    const source = { transaction, query } as unknown as DataSource;
    const config = new ConfigService({
      QUEUE_HOST: 'localhost',
      QUEUE_USERNAME: 'test',
      QUEUE_PASSWORD: 'test',
    });
    return {
      queue,
      connect,
      close,
      query,
      transaction,
      source,
      dispatcher: new EditorialOutboxDispatcher(source, config),
    };
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('declares a durable quorum queue before dispatch and stops polling on shutdown', async () => {
    const f = fixture();
    f.dispatcher.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    expect(f.queue.assertQueue).toHaveBeenCalledWith(
      EDITORIAL_PROJECTION_QUEUE,
      {
        durable: true,
        arguments: { 'x-queue-type': 'quorum', 'x-delivery-limit': -1 },
      }
    );
    expect(f.transaction).toHaveBeenCalledTimes(1);
    await f.dispatcher.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(2000);
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.close).toHaveBeenCalled();
  });

  it('does not claim SQL work until a failed queue declaration has recovered', async () => {
    const f = fixture();
    f.queue.assertQueue.mockRejectedValueOnce(
      new Error('broker rejected topology')
    );
    f.dispatcher.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    expect(f.transaction).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1000);
    expect(f.connect).toHaveBeenCalledTimes(2);
    expect(f.transaction).toHaveBeenCalledTimes(1);
    await f.dispatcher.onModuleDestroy();
  });

  it('never overlaps drains while a SQL request is still running', async () => {
    const f = fixture();
    let release: () => void = () => undefined;
    f.query.mockImplementationOnce(
      () =>
        new Promise<unknown[]>((resolve) => {
          release = () => resolve([]);
        })
    );
    f.dispatcher.onModuleInit();
    await jest.advanceTimersByTimeAsync(2000);
    expect(f.transaction).toHaveBeenCalledTimes(1);
    release();
    await f.dispatcher.onModuleDestroy();
  });

  it('requires configured broker credentials before starting its poller', () => {
    const f = fixture();
    const config = {
      getOrThrow: () => {
        throw new Error('Missing broker configuration');
      },
    } as unknown as ConfigService;
    expect(() =>
      new EditorialOutboxDispatcher(f.source, config).onModuleInit()
    ).toThrow('Missing broker configuration');
    expect(f.connect).not.toHaveBeenCalled();
  });
});
