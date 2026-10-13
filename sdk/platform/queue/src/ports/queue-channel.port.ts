/**
 * Platform port: channel for sending and consuming messages.
 * Consumed by features; implemented by extras.
 */
export interface IQueuedMessage {
  content: Buffer;
  headers?: Readonly<Record<string, unknown>>;
  ack(): void;
  nack(requeue?: boolean): void;
}

export interface QueuePublishOptions {
  headers?: Record<string, unknown>;
  expirationMs?: number;
  timeoutMs?: number;
}

/** Use for durable delivery. A buffered send is not a broker confirmation. */
export interface IConfirmedQueueChannel extends IQueueChannel {
  readonly closed: Promise<void>;
  isOpen(): boolean;
  publishConfirmed(
    queueName: string,
    message: Buffer,
    options?: QueuePublishOptions
  ): Promise<void>;
}

export interface IQueueChannel {
  assertQueue(
    queueName: string,
    options?: { durable?: boolean; arguments?: Record<string, unknown> }
  ): Promise<{ queue: string }>;
  sendToQueue(
    queueName: string,
    message: Buffer,
    options?: { persistent?: boolean }
  ): boolean;
  consume(
    queueName: string,
    onMessage: (msg: IQueuedMessage | null) => void,
    options?: { noAck?: boolean }
  ): Promise<{ consumerTag: string }>;
  prefetch(count: number): void | Promise<void>;
}
