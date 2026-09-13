import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqQueueClient } from '@sdk/extras/queue-rabbitmq';
import { IDENTITY_EVENTS_QUEUE_NAME } from '@apps/shared';
import { RabbitMqIdentityEventsPublisher } from '../infrastructure/rabbitmq-identity-events.publisher';

@Injectable()
export class IdentityEventsPublisherHolder implements OnModuleInit, OnModuleDestroy {
  private publisher: RabbitMqIdentityEventsPublisher | undefined;
  private readonly client = new RabbitMqQueueClient();
  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const channel = await this.client.connect({
      host: this.config.getOrThrow<string>('QUEUE_HOST'),
      port: this.config.get<string>('QUEUE_PORT') ?? '5672',
      username: this.config.getOrThrow<string>('QUEUE_USERNAME'),
      password: this.config.getOrThrow<string>('QUEUE_PASSWORD'),
      vhost: this.config.get<string>('QUEUE_VHOST'),
    });
    await channel.assertQueue(IDENTITY_EVENTS_QUEUE_NAME, { durable: true });
    this.publisher = new RabbitMqIdentityEventsPublisher(channel);
  }
  async onModuleDestroy(): Promise<void> { await this.client.close(); }
  get(): RabbitMqIdentityEventsPublisher | undefined { return this.publisher; }
}
