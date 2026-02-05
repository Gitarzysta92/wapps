import * as amqp from 'amqplib';

export interface QueueConnectConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  vhost?: string;
}

export type MessageDecoder<T> = (content: Buffer, msg: amqp.ConsumeMessage) => T;

export type DecodedMessageHandler<T> = (payload: T, msg: amqp.ConsumeMessage) => void | Promise<void>;

export type ConsumeDecodedOptions = amqp.Options.Consume & {
  /**
   * When set to 'onSuccess' (and `noAck` is not true), the helper will `ack`
   * after the handler resolves successfully.
   *
   * Default: 'manual'
   */
  ack?: 'manual' | 'onSuccess';

  /**
   * If true (and `noAck` is not true), the helper will `nack` when decode or
   * handler throws/rejects.
   *
   * Default: false
   */
  nackOnError?: boolean;

  /**
   * Used when `nackOnError` is true.
   *
   * Default: false
   */
  requeueOnError?: boolean;

  /**
   * Optional hook for logging/metrics on decode/handler failure.
   */
  onError?: (err: unknown, msg: amqp.ConsumeMessage) => void;
};

export type ConsumeJsonOptions<T> = ConsumeDecodedOptions & {
  encoding?: BufferEncoding;
  /**
   * Optional runtime transform/validation. If provided, it receives the value
   * returned from `JSON.parse`.
   */
  parse?: (value: unknown) => T;
};

export interface QueueChannel {
  assertQueue(queueName: string, options?: amqp.Options.AssertQueue): Promise<amqp.Replies.AssertQueue>;
  checkQueue(queueName: string): Promise<amqp.Replies.AssertQueue>;
  assertExchange(
    exchange: string,
    type: string,
    options?: amqp.Options.AssertExchange
  ): Promise<amqp.Replies.AssertExchange>;
  bindQueue(
    queue: string,
    source: string,
    pattern: string,
    args?: unknown
  ): Promise<amqp.Replies.Empty>;
  bindQueue(queue: string, source: string, args?: unknown): Promise<amqp.Replies.Empty>;
  sendToQueue(queueName: string, message: Buffer, options?: amqp.Options.Publish): boolean;
  consume(
    queueName: string,
    onMessage: (msg: amqp.ConsumeMessage | null) => void,
    options?: amqp.Options.Consume
  ): Promise<amqp.Replies.Consume>;
  consumeDecoded<T>(
    queueName: string,
    decode: MessageDecoder<T>,
    onMessage: DecodedMessageHandler<T>,
    options?: ConsumeDecodedOptions
  ): Promise<amqp.Replies.Consume>;
  consumeJson<T>(
    queueName: string,
    onMessage: DecodedMessageHandler<T>,
    options?: ConsumeJsonOptions<T>
  ): Promise<amqp.Replies.Consume>;
  ack(message: amqp.Message, allUpTo?: boolean): void;
  nack(message: amqp.Message, allUpTo?: boolean, requeue?: boolean): void;
  prefetch(count: number, global?: boolean): void;
}

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

/**
 * Thin wrapper around `amqplib` that standardizes connection lifecycle and
 * exposes a small, reusable channel surface.
 */
export class QueueClient {
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;

  constructor(private readonly client: typeof amqp = amqp) {}

  async connect(cfg: QueueConnectConfig): Promise<QueueChannel> {
    if (!cfg.username) throw new Error('QUEUE_USERNAME is required');
    if (!cfg.password) throw new Error('QUEUE_PASSWORD is required');
    if (!cfg.host) throw new Error('QUEUE_HOST is required');
    if (!cfg.port) throw new Error('QUEUE_PORT is required');

    const vhost = cfg.vhost ? `/${encodeURIComponent(cfg.vhost)}` : '/';
    const url = `amqp://${cfg.username}:${cfg.password}@${cfg.host}:${cfg.port}${vhost}`;

    this.connection = await this.client.connect(url);
    this.channel = await this.connection.createChannel();

    return {
      assertQueue: async (queueName: string, options?: amqp.Options.AssertQueue) => {
        const ch = this.getChannel();
        return await ch.assertQueue(queueName, options ?? { durable: true });
      },
      checkQueue: async (queueName: string) => {
        const ch = this.getChannel();
        return await ch.checkQueue(queueName);
      },
      assertExchange: async (exchange: string, type: string, options?: amqp.Options.AssertExchange) => {
        const ch = this.getChannel();
        return await ch.assertExchange(exchange, type, options ?? { durable: true });
      },
      bindQueue: async (queue: string, source: string, patternOrArgs?: string | unknown, args?: unknown) => {
        const ch = this.getChannel();
        if (typeof patternOrArgs === 'string') {
          return await ch.bindQueue(queue, source, patternOrArgs, args);
        }
        return await ch.bindQueue(queue, source, '', patternOrArgs);
      },
      sendToQueue: (queueName: string, message: Buffer, options?: amqp.Options.Publish) => {
        const ch = this.getChannel();
        return ch.sendToQueue(queueName, message, options);
      },
      consume: async (
        queueName: string,
        onMessage: (msg: amqp.ConsumeMessage | null) => void,
        options?: amqp.Options.Consume
      ) => {
        const ch = this.getChannel();
        return await ch.consume(queueName, onMessage, options);
      },
      consumeDecoded: async <T>(
        queueName: string,
        decode: MessageDecoder<T>,
        onMessage: DecodedMessageHandler<T>,
        options?: ConsumeDecodedOptions
      ) => {
        const ch = this.getChannel();
        const {
          ack: ackMode = 'manual',
          nackOnError = false,
          requeueOnError = false,
          onError,
          ...amqpOptions
        } = options ?? {};

        return await ch.consume(
          queueName,
          (msg) => {
            if (!msg) return;

            // We deliberately do not return/await anything to RabbitMQ.
            // All error handling is contained here.
            void (async () => {
              try {
                const payload = decode(msg.content, msg);
                await onMessage(payload, msg);

                if (!amqpOptions.noAck && ackMode === 'onSuccess') {
                  ch.ack(msg);
                }
              } catch (err) {
                onError?.(err, msg);

                if (!amqpOptions.noAck && nackOnError) {
                  ch.nack(msg, false, requeueOnError);
                }
              }
            })();
          },
          amqpOptions as amqp.Options.Consume
        );
      },
      consumeJson: async <T>(
        queueName: string,
        onMessage: DecodedMessageHandler<T>,
        options?: ConsumeJsonOptions<T>
      ) => {
        const ch = this.getChannel();
        const {
          ack: ackMode = 'manual',
          nackOnError = false,
          requeueOnError = false,
          onError,
          encoding = 'utf8',
          parse,
          ...amqpOptions
        } = options ?? {};

        const decode: MessageDecoder<T> = (content: Buffer) => {
          const text = content.toString(encoding);
          const value: unknown = JSON.parse(text);
          return parse ? parse(value) : (value as T);
        };

        return await ch.consume(
          queueName,
          (msg) => {
            if (!msg) return;
            void (async () => {
              try {
                const payload = decode(msg.content, msg);
                await onMessage(payload, msg);
                if (!amqpOptions.noAck && ackMode === 'onSuccess') {
                  ch.ack(msg);
                }
              } catch (err) {
                onError?.(err, msg);
                if (!amqpOptions.noAck && nackOnError) {
                  ch.nack(msg, false, requeueOnError);
                }
              }
            })();
          },
          amqpOptions as amqp.Options.Consume
        );
      },
      ack: (message: amqp.Message, allUpTo?: boolean) => {
        const ch = this.getChannel();
        ch.ack(message, allUpTo);
      },
      nack: (message: amqp.Message, allUpTo?: boolean, requeue?: boolean) => {
        const ch = this.getChannel();
        ch.nack(message, allUpTo, requeue);
      },
      prefetch: (count: number, global?: boolean) => {
        const ch = this.getChannel();
        ch.prefetch(count, global);
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
        await this.connection.close();
        this.connection = null;
      }
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }

  private getChannel(): AmqpChannel {
    if (!this.channel) {
      throw new Error('Channel is not initialized. Did you call connect()?');
    }
    return this.channel;
  }
}
