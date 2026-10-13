import { randomUUID } from 'node:crypto';
import type { EventEmitter } from 'node:events';
import type { ConfirmChannel, Message } from 'amqplib';
import type { QueuePublishOptions } from '@sdk/platform/queue';

type Pending = { finish(error?: Error): void };

/** Correlates mandatory returns and confirms independently for concurrent sends. */
export class ConfirmedPublisher {
  private readonly pending = new Map<string, Pending>();
  private closed = false;

  constructor(
    private readonly channel: Pick<ConfirmChannel, 'sendToQueue' | 'close'> &
      Pick<EventEmitter, 'on'>
  ) {
    channel.on('return', (message: Message) => {
      this.pending
        .get(message.properties.messageId)
        ?.finish(new Error('Broker returned an unroutable message'));
    });
    channel.on('error', () => this.failAll(new Error('Broker channel failed')));
    channel.on('close', () => this.failAll(new Error('Broker channel closed')));
  }

  publish(
    queue: string,
    content: Buffer,
    options: QueuePublishOptions = {}
  ): Promise<void> {
    if (this.closed)
      return Promise.reject(new Error('Broker channel is closed'));
    const timeoutMs = options.timeoutMs ?? 10_000;
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs <= 0 ||
      timeoutMs > 60_000
    ) {
      return Promise.reject(
        new Error('Confirmation timeout must be between 1 and 60000ms')
      );
    }
    if (
      options.expirationMs !== undefined &&
      (!Number.isSafeInteger(options.expirationMs) || options.expirationMs <= 0)
    ) {
      return Promise.reject(
        new Error('Message expiry must be a positive integer')
      );
    }
    if (this.pending.size >= 256)
      return Promise.reject(new Error('Too many unconfirmed messages'));
    const id = randomUUID();
    return new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        if (!this.pending.delete(id)) return;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => {
        const error = new Error('Broker confirmation timed out');
        finish(error);
        this.failAll(error);
        // An uncertain channel must not accumulate more unconfirmed callbacks.
        void Promise.resolve()
          .then(() => this.channel.close())
          .catch(() => undefined);
      }, timeoutMs);
      this.pending.set(id, { finish });
      try {
        this.channel.sendToQueue(
          queue,
          content,
          {
            persistent: true,
            mandatory: true,
            messageId: id,
            contentType: 'application/json',
            headers: options.headers,
            expiration: options.expirationMs?.toString(),
          },
          (error: Error | null) => finish(error ?? undefined)
        );
      } catch (error) {
        finish(
          error instanceof Error
            ? error
            : new Error('Broker publication failed')
        );
      }
    });
  }

  isOpen(): boolean {
    return !this.closed;
  }

  private failAll(error: Error): void {
    this.closed = true;
    for (const pending of this.pending.values()) pending.finish(error);
  }
}
