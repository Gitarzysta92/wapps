/**
 * Platform port: channel for sending and consuming messages.
 * Consumed by features; implemented by extras.
 */
export interface IQueuedMessage {
  content: Buffer;
  ack(): void;
  nack(requeue?: boolean): void;
}

export interface IQueueChannel {
  assertQueue(queueName: string, options?: { durable?: boolean }): Promise<{ queue: string }>;
  sendToQueue(queueName: string, message: Buffer, options?: { persistent?: boolean }): boolean;
  consume(
    queueName: string,
    onMessage: (msg: IQueuedMessage | null) => void,
    options?: { noAck?: boolean }
  ): Promise<{ consumerTag: string }>;
  prefetch(count: number): void;
}
