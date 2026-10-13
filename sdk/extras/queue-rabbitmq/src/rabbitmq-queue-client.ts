import * as amqp from 'amqplib';
import type {
  IQueueClient,
  IQueueConnectConfig,
  IConfirmedQueueChannel,
  IQueuedMessage,
} from '@sdk/platform/queue';
import { ConfirmedPublisher } from './confirmed-publisher';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createConfirmChannel']>>;

function wrapMessage(
  msg: amqp.ConsumeMessage,
  channel: AmqpChannel
): IQueuedMessage {
  return {
    content: msg.content,
    headers: msg.properties.headers,
    ack() {
      channel.ack(msg);
    },
    nack(requeue = false) {
      channel.nack(msg, false, requeue);
    },
  };
}

/**
 * RabbitMQ implementation of the platform queue client port.
 * Direct implementation in extras; consumed by apps at wiring time.
 */
export class RabbitMqQueueClient implements IQueueClient {
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;

  async connect(config: IQueueConnectConfig): Promise<IConfirmedQueueChannel> {
    const timeout = config.connectionTimeoutMs ?? 10_000;
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60_000)
      throw new Error(
        'Broker connection timeout must be between 1 and 60000ms'
      );
    const vhost = config.vhost ? `/${encodeURIComponent(config.vhost)}` : '/';
    const url = `amqp://${encodeURIComponent(
      config.username
    )}:${encodeURIComponent(config.password)}@${config.host}:${
      config.port
    }${vhost}`;
    const connection = await amqp.connect(url, { timeout });
    // Channel failures reject pending confirms; keep connection errors handled too.
    connection.on('error', () => undefined);
    let channel: AmqpChannel;
    try {
      channel = await connection.createConfirmChannel();
    } catch (error) {
      await connection.close();
      throw error;
    }
    const publisher = new ConfirmedPublisher(channel);
    const closed = new Promise<void>((resolve) => {
      channel.once('close', resolve);
      channel.once('error', () => resolve());
    });

    this.connection = connection;
    this.channel = channel;

    const ch = channel;
    return {
      closed,
      isOpen: () => publisher.isOpen(),
      assertQueue: async (queueName, options) => {
        const result = await ch.assertQueue(queueName, {
          ...options,
          durable: options?.durable ?? true,
        });
        return { queue: result.queue };
      },
      publishConfirmed: (queueName, content, options) =>
        publisher.publish(queueName, content, options),
      sendToQueue: (
        queueName: string,
        message: Buffer,
        options?: { persistent?: boolean }
      ) => {
        return ch.sendToQueue(queueName, message, {
          ...options,
          persistent: options?.persistent ?? true,
        });
      },
      consume: async (
        queueName: string,
        onMessage: (msg: IQueuedMessage | null) => void,
        options?: { noAck?: boolean }
      ) => {
        const result = await ch.consume(
          queueName,
          (msg) => {
            if (!msg) {
              onMessage(null);
              return;
            }
            onMessage(wrapMessage(msg, ch));
          },
          { noAck: options?.noAck ?? false }
        );
        return { consumerTag: result.consumerTag };
      },
      prefetch: async (count: number) => {
        await ch.prefetch(count);
      },
    };
  }

  async close(): Promise<void> {
    const channel = this.channel;
    const connection = this.connection;
    this.channel = null;
    this.connection = null;
    // The channel handshake needs its connection until ChannelCloseOk arrives.
    await Promise.resolve()
      .then(() => channel?.close())
      .catch(() => undefined);
    await Promise.resolve()
      .then(() => connection?.close())
      .catch(() => undefined);
  }
}
