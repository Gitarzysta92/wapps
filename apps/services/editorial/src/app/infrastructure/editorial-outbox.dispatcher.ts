import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RabbitMqQueueClient } from '@sdk/extras/queue-rabbitmq';
import type { IConfirmedQueueChannel } from '@sdk/platform/queue';
import { EDITORIAL_PROJECTION_QUEUE } from '@apps/shared';
import { DispatchEditorialOutbox } from '../application/editorial-outbox';
import { MysqlEditorialOutbox } from './mysql-editorial-outbox';

@Injectable()
export class EditorialOutboxDispatcher
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EditorialOutboxDispatcher.name);
  private readonly client = new RabbitMqQueueClient();
  private queue?: IConfirmedQueueChannel;
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private stopping = false;

  constructor(
    private readonly source: DataSource,
    private readonly config: ConfigService
  ) {}

  onModuleInit(): void {
    for (const key of ['QUEUE_HOST', 'QUEUE_USERNAME', 'QUEUE_PASSWORD'])
      this.config.getOrThrow(key);
    this.timer = setInterval(() => this.kick(), 1000);
    this.timer.unref();
    this.kick();
  }

  private kick(): void {
    if (this.running || this.stopping) return;
    this.running = this.drain()
      .catch(() => {
        this.logger.error(
          'Editorial outbox dispatch unavailable; committed work remains in SQL'
        );
      })
      .finally(() => {
        this.running = undefined;
      });
  }

  private async drain(): Promise<void> {
    if (!this.queue?.isOpen()) {
      await this.client.close();
      const queue = await this.client.connect({
        host: this.config.getOrThrow('QUEUE_HOST'),
        port: this.config.get('QUEUE_PORT') ?? '5672',
        username: this.config.getOrThrow('QUEUE_USERNAME'),
        password: this.config.getOrThrow('QUEUE_PASSWORD'),
        vhost: this.config.get('QUEUE_VHOST'),
      });
      try {
        await queue.assertQueue(EDITORIAL_PROJECTION_QUEUE, {
          durable: true,
          arguments: { 'x-queue-type': 'quorum', 'x-delivery-limit': -1 },
        });
      } catch (error) {
        await this.client.close();
        throw error;
      }
      this.queue = queue;
    }
    const queue = this.queue;
    const dispatch = new DispatchEditorialOutbox(
      new MysqlEditorialOutbox(this.source),
      {
        publish: async (event) =>
          queue.publishConfirmed(
            EDITORIAL_PROJECTION_QUEUE,
            Buffer.from(JSON.stringify(event))
          ),
      },
      randomUUID
    );
    for (let count = 0; count < 20 && !this.stopping; count++) {
      const outcome = await dispatch.once();
      if (outcome === 'idle') break;
      if (outcome === 'failed')
        this.logger.error(
          'Editorial outbox request quarantined in SQL; operator recovery required'
        );
      if (outcome === 'retry')
        this.logger.warn(
          'Editorial outbox publication will retry with backoff'
        );
      if (!queue.isOpen()) break;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
    await this.client.close();
  }
}
