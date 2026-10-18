import { randomUUID } from 'node:crypto';
import {
  DispatchIdentityEvents,
  IdentityEventOutbox,
} from '@sdk/features/identity/libs/authentication';
import type {
  IQueueClient,
  IQueueConnectConfig,
  IConfirmedQueueChannel,
} from '@sdk/platform/queue';

/** Applications own start/stop. SQL retains work while transport is unavailable. */
export class IdentityEventPump {
  private stopped = true;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active: Promise<void> | undefined;
  private channel: IConfirmedQueueChannel | undefined;

  constructor(
    private readonly outbox: IdentityEventOutbox,
    private readonly broker: Pick<IQueueClient, 'close'> & {
      connect(config: IQueueConnectConfig): Promise<IConfirmedQueueChannel>;
    },
    private readonly config: IQueueConnectConfig,
    private readonly queueName: string,
    private readonly onError: (message: string) => void
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.active;
    await this.broker.close();
    this.channel = undefined;
  }

  private schedule(ms: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.active = this.drain().finally(() => {
        this.active = undefined;
        this.schedule(1000);
      });
    }, ms);
    this.timer.unref();
  }

  private async drain(): Promise<void> {
    try {
      if (!this.channel?.isOpen()) {
        await this.broker.close();
        const channel = await this.broker.connect(this.config);
        await channel.assertQueue(this.queueName, { durable: true });
        this.channel = channel;
      }
      const channel = this.channel;
      const dispatcher = new DispatchIdentityEvents(
        this.outbox,
        {
          publish: (body) =>
            channel.publishConfirmed(this.queueName, Buffer.from(body)),
        },
        randomUUID
      );
      for (
        let count = 0;
        count < 100 && !this.stopped && channel.isOpen();
        count++
      ) {
        const result = await dispatcher.once();
        if (result === 'idle') break;
        if (result === 'failed')
          this.onError(
            'Identity event retained in SQL quarantine; inspect and requeue'
          );
      }
    } catch {
      this.onError(
        'Identity event delivery unavailable; committed work remains in SQL'
      );
      this.channel = undefined;
      await this.broker.close().catch(() => undefined);
    }
  }
}
