import * as amqp from 'amqplib';

export interface QueueChannel {
  assertQueue(queueName: string, options?: amqp.Options.AssertQueue): Promise<amqp.Message>;
  sendToQueue(queueName: string, message: Buffer): boolean;
}

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

export class QueueClient {
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;

  constructor(
    private readonly client: typeof amqp,
  ) { }

  async connect(cfg: {
    host: string;
    port: string;
    username: string;
    password: string;
  }): Promise<QueueChannel> {
    if (!cfg.username) {
      throw new Error('QUEUE_USERNAME is required');
    }
    if (!cfg.password) {
      throw new Error('QUEUE_PASSWORD is required');
    }
    if (!cfg.host) {
      throw new Error('QUEUE_HOST is required');
    }
    if (!cfg.port) {
      throw new Error('QUEUE_PORT is required');
    }

    const url = `amqp://${cfg.username}:${cfg.password}@${cfg.host}:${cfg.port}/`;
    console.log(`Connecting to RabbitMQ at ${cfg.host}:${cfg.port}...`);
    
    this.connection = await this.client.connect(url);
    this.channel = await this.connection.createChannel();

    console.log('✅ Connected to RabbitMQ');

    return {
      assertQueue: async (queueName: string, options?: amqp.Options.AssertQueue) => {
        if (!this.channel) {
          throw new Error('Channel is not initialized');
        }
        const queue = await this.channel.assertQueue(queueName, options || { durable: true });
        return queue as unknown as amqp.Message;
      },
      sendToQueue: (queueName: string, message: Buffer) => {
        if (!this.channel) {
          throw new Error('Channel is not initialized');
        }
        return this.channel.sendToQueue(queueName, message);
      }
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
      console.error('Error closing queue connection:', error);
    }
  }
}