import { EventEmitter } from 'node:events';
import * as amqp from 'amqplib';
import { RabbitMqQueueClient } from './rabbitmq-queue-client';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

const configuration = {
  host: 'localhost',
  port: '5672',
  username: 'user',
  password: 'test',
};

describe('RabbitMQ connection lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('bounds the initial connection and closes both transport resources', async () => {
    const channel = Object.assign(new EventEmitter(), {
      close: jest.fn().mockResolvedValue(undefined),
    });
    const connection = Object.assign(new EventEmitter(), {
      createConfirmChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
    });
    jest
      .mocked(amqp.connect)
      .mockResolvedValue(
        connection as unknown as Awaited<ReturnType<typeof amqp.connect>>
      );
    const client = new RabbitMqQueueClient();
    await client.connect(configuration);
    expect(amqp.connect).toHaveBeenCalledWith(
      'amqp://user:test@localhost:5672/',
      { timeout: 10_000 }
    );
    await client.close();
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 60_001, NaN])(
    'refuses an invalid connection timeout before opening sockets: %s',
    async (connectionTimeoutMs) => {
      await expect(
        new RabbitMqQueueClient().connect({
          ...configuration,
          connectionTimeoutMs,
        })
      ).rejects.toThrow('timeout');
      expect(amqp.connect).not.toHaveBeenCalled();
    }
  );

  it.each([false, true])(
    'keeps the connection open until channel shutdown settles (failure: %s)',
    async (failed) => {
      let finish: () => void = () => undefined;
      const channel = Object.assign(new EventEmitter(), {
        close: jest.fn().mockImplementation(
          () =>
            new Promise<void>((resolve, reject) => {
              finish = () =>
                failed ? reject(new Error('channel closed')) : resolve();
            })
        ),
      });
      const connection = Object.assign(new EventEmitter(), {
        createConfirmChannel: jest.fn().mockResolvedValue(channel),
        close: jest.fn().mockResolvedValue(undefined),
      });
      jest
        .mocked(amqp.connect)
        .mockResolvedValue(
          connection as unknown as Awaited<ReturnType<typeof amqp.connect>>
        );
      const client = new RabbitMqQueueClient();
      await client.connect(configuration);
      const closing = client.close();
      await Promise.resolve();
      expect(channel.close).toHaveBeenCalledTimes(1);
      expect(connection.close).not.toHaveBeenCalled();
      finish();
      await closing;
      expect(connection.close).toHaveBeenCalledTimes(1);
    }
  );

  it('cleans up a connection when creating its confirmed channel fails', async () => {
    const connection = Object.assign(new EventEmitter(), {
      createConfirmChannel: jest
        .fn()
        .mockRejectedValue(new Error('channel refused')),
      close: jest.fn().mockResolvedValue(undefined),
    });
    jest
      .mocked(amqp.connect)
      .mockResolvedValue(
        connection as unknown as Awaited<ReturnType<typeof amqp.connect>>
      );
    await expect(
      new RabbitMqQueueClient().connect(configuration)
    ).rejects.toThrow('channel refused');
    expect(connection.close).toHaveBeenCalledTimes(1);
  });
});
