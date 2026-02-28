import * as amqp from 'amqplib';
import type {
  IQueueClient,
  IQueueConnectConfig,
  IQueueChannel,
  IQueuedMessage,
} from '@sdk/platform/queue';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

function wrapMessage(msg: amqp.ConsumeMessage, channel: AmqpChannel): IQueuedMessage {
  return {
    content: msg.content,
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

  async connect(config: IQueueConnectConfig): Promise<IQueueChannel> {
    const vhost = config.vhost ? `/${encodeURIComponent(config.vhost)}` : '/';
    const url = `amqp://${config.username}:${config.password}@${config.host}:${config.port}${vhost}`;
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();

    this.connection = connection;
    this.channel = channel;

    const ch = channel;
    return {
      assertQueue: async (queueName: string, options?: { durable?: boolean }) => {
        const result = await ch.assertQueue(queueName, { durable: options?.durable ?? true });
        return { queue: result.queue };
      },
      sendToQueue: (queueName: string, message: Buffer, options?: { persistent?: boolean }) => {
        return ch.sendToQueue(queueName, message, { persistent: options?.persistent ?? true });
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
      prefetch: (count: number) => {
        ch.prefetch(count);
      },
    };
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        const conn = this.connection as { close(): Promise<void> };
        await conn.close();
        this.connection = null;
      }
    } catch (err) {
      console.error('Error closing RabbitMQ connection:', err);
    }
  }
}
