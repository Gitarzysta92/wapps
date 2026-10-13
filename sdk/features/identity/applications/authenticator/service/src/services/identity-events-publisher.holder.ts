import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RabbitMqQueueClient } from '@sdk/extras/queue-rabbitmq';
import { IDENTITY_EVENTS_QUEUE_NAME } from '@apps/shared';
import {
  IdentityEventPump,
  MysqlIdentityEvents,
} from '@sdk/extras/identity-mysql';

@Injectable()
export class IdentityEventsPublisherHolder
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pump: IdentityEventPump;
  constructor(config: ConfigService, source: DataSource) {
    const logger = new Logger('IdentityEventOutbox');
    this.pump = new IdentityEventPump(
      new MysqlIdentityEvents(source),
      new RabbitMqQueueClient(),
      {
        host: config.getOrThrow<string>('QUEUE_HOST'),
        port: config.get<string>('QUEUE_PORT') ?? '5672',
        username: config.getOrThrow<string>('QUEUE_USERNAME'),
        password: config.getOrThrow<string>('QUEUE_PASSWORD'),
        vhost: config.get<string>('QUEUE_VHOST'),
      },
      IDENTITY_EVENTS_QUEUE_NAME,
      (message) => logger.error(message)
    );
  }
  onModuleInit(): void {
    this.pump.start();
  }
  onModuleDestroy(): Promise<void> {
    return this.pump.stop();
  }
}
