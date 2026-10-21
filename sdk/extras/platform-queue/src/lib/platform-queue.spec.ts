import { QueueClient } from './platform-queue';
import * as amqp from 'amqplib';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

describe('QueueClient', () => {
  it('should work', () => {
    const client = new QueueClient();
    expect(client).toBeInstanceOf(QueueClient);
  });

  async function connected() {
    const channel = { consume: jest.fn().mockResolvedValue({ consumerTag: 'test' }), ack: jest.fn(), nack: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
    const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue(undefined) };
    jest.mocked(amqp.connect).mockResolvedValue(connection as unknown as Awaited<ReturnType<typeof amqp.connect>>);
    const client = new QueueClient();
    const wrapper = await client.connect({ host: 'localhost', port: '5672', username: 'test', password: 'test' });
    return { client, wrapper, channel, connection };
  }

  const message = { content: Buffer.from('{"revision":3}') } as amqp.ConsumeMessage;
  const drain = () => new Promise((resolve) => setImmediate(resolve));

  it('acknowledges only after the application handler resolves', async () => {
    const { wrapper, channel } = await connected();
    let complete: () => void = () => { throw new Error('handler not started'); };
    const pending = new Promise<void>((resolve) => { complete = resolve; });
    const handler = jest.fn(() => pending);
    await wrapper.consumeJson('test', handler, { ack: 'onSuccess' });
    channel.consume.mock.calls[0][1](message);
    expect(handler).toHaveBeenCalledWith({ revision: 3 }, message);
    expect(channel.ack).not.toHaveBeenCalled();
    complete();
    await drain();
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it.each(['decode', 'handler'])('never acknowledges a %s failure', async (stage) => {
    const { wrapper, channel } = await connected();
    const failure = new Error(stage);
    const onError = jest.fn();
    await wrapper.consumeDecoded('test', () => {
      if (stage === 'decode') throw failure;
      return {};
    }, async () => { throw failure; }, { ack: 'onSuccess', nackOnError: true, requeueOnError: false, onError });
    channel.consume.mock.calls[0][1](message);
    await drain();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(onError).toHaveBeenCalledWith(failure, message);
  });

  it('leaves acknowledgements to callers in manual mode', async () => {
    const { wrapper, channel } = await connected();
    await wrapper.consumeJson('test', async () => undefined);
    channel.consume.mock.calls[0][1](message);
    await drain();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('closes the channel before the connection and closes each only once', async () => {
    const { client, channel, connection } = await connected();
    await client.close();
    await client.close();
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
    expect(channel.close.mock.invocationCallOrder[0]).toBeLessThan(connection.close.mock.invocationCallOrder[0]);
  });
});
