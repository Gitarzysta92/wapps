import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RabbitMqQueueClient } from '@sdk/extras/queue-rabbitmq';
import {
  DISCUSSION_GENERATION_QUEUE_NAME,
  DiscussionGenerationRequestedEvent,
} from '@apps/shared';
import { IConfirmedQueueChannel } from '@sdk/platform/queue';
import { safeSqlInteger } from './mysql-discussion-writes';

interface OutboxRow {
  id: string;
  discussionId: string;
  revision: number | string;
  createdAt: number | string;
  attempts: number;
}

@Injectable()
export class DiscussionOutboxDispatcher
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DiscussionOutboxDispatcher.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private stopping = false;

  constructor(
    private readonly db: DataSource,
    @Inject('DISCUSSION_QUEUE') private queue: IConfirmedQueueChannel,
    private readonly client: RabbitMqQueueClient,
    private readonly config: ConfigService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.assertQueue(DISCUSSION_GENERATION_QUEUE_NAME, {
      durable: true,
      arguments: { 'x-queue-type': 'quorum', 'x-delivery-limit': -1 },
    });
    this.timer = setInterval(() => this.kick(), 1000);
    this.timer.unref();
    this.kick();
  }

  private kick(): void {
    if (this.running || this.stopping) return;
    this.running = this.drain()
      .catch(() =>
        this.logger.error(
          'Outbox dispatch failed; committed requests remain pending'
        )
      )
      .finally(() => {
        this.running = undefined;
      });
  }

  private async drain(): Promise<void> {
    if (!this.queue.isOpen()) {
      await this.client.close();
      this.queue = await this.client.connect({
        host: this.config.getOrThrow('QUEUE_HOST'),
        port: this.config.get('QUEUE_PORT') ?? '5672',
        username: this.config.getOrThrow('QUEUE_USERNAME'),
        password: this.config.getOrThrow('QUEUE_PASSWORD'),
      });
      await this.queue.assertQueue(DISCUSSION_GENERATION_QUEUE_NAME, {
        durable: true,
        arguments: { 'x-queue-type': 'quorum', 'x-delivery-limit': -1 },
      });
    }
    for (let i = 0; i < 20 && !this.stopping; i++) {
      const now = Date.now();
      const token = randomUUID();
      const row = await this.db.transaction('READ COMMITTED', async (tx) => {
        const rows = await tx.query<OutboxRow[]>(
          `SELECT id, discussionId, revision, createdAt, attempts FROM discussion_outbox
          WHERE deliveredAt IS NULL AND availableAt <= ? AND (leasedUntil IS NULL OR leasedUntil < ?)
          ORDER BY availableAt, id LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [now, now]
        );
        if (!rows[0]) return null;
        await tx.query(
          'UPDATE discussion_outbox SET leaseToken = ?, leasedUntil = ? WHERE id = ?',
          [token, now + 30_000, rows[0].id]
        );
        return rows[0];
      });
      if (!row) return;
      try {
        const event: DiscussionGenerationRequestedEvent = {
          meta: {
            id: row.id,
            type: 'discussion.materialization.requested',
            version: 2,
            occurredAt: new Date(safeSqlInteger(row.createdAt)).toISOString(),
            producer: { service: 'discussion-service' },
            correlation: { correlationId: row.discussionId },
            subject: { entityType: 'discussion', entityId: row.discussionId },
          },
          payload: {
            discussionId: row.discussionId,
            revision: safeSqlInteger(row.revision),
          },
        };
        await this.queue.publishConfirmed(
          DISCUSSION_GENERATION_QUEUE_NAME,
          Buffer.from(JSON.stringify(event))
        );
        await this.db.query(
          'UPDATE discussion_outbox SET deliveredAt = ?, leaseToken = NULL, leasedUntil = NULL, lastError = NULL WHERE id = ? AND leaseToken = ?',
          [Date.now(), row.id, token]
        );
      } catch {
        const attempts = Math.min(safeSqlInteger(row.attempts) + 1, 1_000_000);
        const backoff = Math.min(300_000, 1000 * 2 ** Math.min(attempts, 9));
        await this.db.query(
          `UPDATE discussion_outbox SET attempts = ?, availableAt = ?, leaseToken = NULL,
          leasedUntil = NULL, lastError = 'Publication or delivery marking failed' WHERE id = ? AND leaseToken = ?`,
          [attempts, Date.now() + backoff, row.id, token]
        );
        this.logger.warn(
          `Outbox ${row.id} retained for retry (attempt ${attempts})`
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
