import type { DataSource } from 'typeorm';
import type { Db } from 'mongodb';
import type {
  IConfirmedQueueChannel,
  IQueuedMessage,
} from '@sdk/platform/queue';
import { PlatformMongoClient } from '@sdk/extras/mongo';
import { RabbitMqQueueClient } from '@sdk/extras/queue-rabbitmq';
import { EDITORIAL_PROJECTION_FAILED_QUEUE } from '@apps/shared';
import * as maintenance from './maintenance';
import { runEditorialMaterializer } from './projection-runtime';
import { MysqlEditorialSnapshotReader } from './app/infrastructure/mysql-editorial-snapshot';
import { MongoEditorialProjections } from './app/infrastructure/mongo-editorial-projections';
import {
  appSnapshot,
  editorialEvent,
} from './testing/editorial-projection-fixtures';

describe('Editorial worker runtime lifecycle', () => {
  const environment = {
    MONGO_HOST: 'localhost',
    MONGO_PORT: '27017',
    MONGO_USERNAME: 'test',
    MONGO_PASSWORD: 'test',
    MONGO_DATABASE: 'isolated',
    QUEUE_HOST: 'localhost',
    QUEUE_USERNAME: 'test',
    QUEUE_PASSWORD: 'test',
  };
  const previousExitCode = process.exitCode;
  afterEach(() => {
    jest.restoreAllMocks();
    process.exitCode = previousExitCode;
  });

  function fixture() {
    const source = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: true,
      query: jest.fn().mockResolvedValue([]),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    jest
      .spyOn(maintenance, 'editorialMaintenanceSource')
      .mockReturnValue(source as unknown as DataSource);
    const signals = new Map<string, () => void>();
    const originalOnce = process.once.bind(process);
    jest.spyOn(process, 'once').mockImplementation((name, listener) => {
      if (name === 'SIGINT' || name === 'SIGTERM') {
        signals.set(name, listener);
        return process;
      }
      return originalOnce(name, listener);
    });
    let closed: () => void = () => undefined;
    let deliver: (message: IQueuedMessage | null) => void = () => undefined;
    let subscribed: () => void = () => undefined;
    const subscription = new Promise<void>((resolve) => {
      subscribed = resolve;
    });
    const queue = {
      closed: new Promise<void>((resolve) => {
        closed = resolve;
      }),
      prefetch: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue({ queue: 'test' }),
      consume: jest.fn(
        async (
          _name: string,
          callback: (message: IQueuedMessage | null) => void
        ) => {
          deliver = callback;
          subscribed();
          return { consumerTag: 'test' };
        }
      ),
      publishConfirmed: jest.fn().mockResolvedValue(undefined),
    };
    jest
      .spyOn(RabbitMqQueueClient.prototype, 'connect')
      .mockResolvedValue(queue as unknown as IConfirmedQueueChannel);
    const brokerClose = jest
      .spyOn(RabbitMqQueueClient.prototype, 'close')
      .mockResolvedValue(undefined);
    const mongoConnect = jest
      .spyOn(PlatformMongoClient.prototype, 'connect')
      .mockResolvedValue({} as Db);
    // The runtime supplies a collection to its adapter; persistence behavior has separate adapter tests.
    jest
      .spyOn(PlatformMongoClient.prototype, 'collection')
      .mockReturnValue({} as ReturnType<PlatformMongoClient['collection']>);
    const mongoClose = jest
      .spyOn(PlatformMongoClient.prototype, 'close')
      .mockResolvedValue(undefined);
    jest
      .spyOn(MongoEditorialProjections.prototype, 'ensureIndexes')
      .mockResolvedValue(undefined);
    const publish = jest
      .spyOn(MongoEditorialProjections.prototype, 'publish')
      .mockResolvedValue('published');
    jest
      .spyOn(MysqlEditorialSnapshotReader.prototype, 'read')
      .mockResolvedValue(appSnapshot());
    return {
      source,
      signals,
      queue,
      closed,
      deliver: (message: IQueuedMessage | null) => deliver(message),
      subscription,
      brokerClose,
      mongoClose,
      mongoConnect,
      publish,
    };
  }

  it('uses bounded serial consumption and releases every connection on graceful shutdown', async () => {
    const f = fixture();
    const running = runEditorialMaterializer(environment);
    await f.subscription;
    expect(f.queue.prefetch).toHaveBeenCalledWith(1);
    expect(f.queue.assertQueue).toHaveBeenCalledWith(
      EDITORIAL_PROJECTION_FAILED_QUEUE,
      {
        durable: true,
        arguments: { 'x-queue-type': 'quorum', 'x-delivery-limit': -1 },
      }
    );
    let acked: () => void = () => undefined;
    const acknowledgement = new Promise<void>((resolve) => {
      acked = resolve;
    });
    f.deliver({
      content: Buffer.from(JSON.stringify(editorialEvent())),
      ack: acked,
      nack: jest.fn(),
    });
    await acknowledgement;
    expect(f.publish).toHaveBeenCalledTimes(1);
    f.signals.get('SIGTERM')?.();
    f.deliver(null);
    await running;
    expect(process.exitCode).toBe(previousExitCode);
    expect(f.source.destroy).toHaveBeenCalledTimes(1);
    expect(f.brokerClose).toHaveBeenCalledTimes(1);
    expect(f.mongoClose).toHaveBeenCalledTimes(1);
  });

  it('refuses consumption when the write schema is unavailable and cleans up', async () => {
    const f = fixture();
    f.source.query.mockRejectedValue(new Error('schema missing'));
    await expect(runEditorialMaterializer(environment)).rejects.toThrow(
      'schema missing'
    );
    expect(f.queue.consume).not.toHaveBeenCalled();
    expect(f.mongoConnect).not.toHaveBeenCalled();
    expect(f.source.destroy).toHaveBeenCalledTimes(1);
  });

  it('exits unsuccessfully after an unexpected broker disconnect so the host can restart it', async () => {
    const f = fixture();
    const running = runEditorialMaterializer(environment);
    await f.subscription;
    f.closed();
    await running;
    expect(process.exitCode).toBe(1);
    expect(f.source.destroy).toHaveBeenCalledTimes(1);
  });
});
