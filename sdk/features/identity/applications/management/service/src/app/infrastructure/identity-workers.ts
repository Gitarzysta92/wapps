import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  CompleteAccountErasure,
  CleanAccountErasureParticipant,
  CompleteIdentityDeletion,
} from '@sdk/features/identity/libs/management';
import { RequestAccountErasure } from '@wapps/account';
import { RemoteAccountErasureParticipant } from './remote-account-erasure-participant';
import type { IUserAdminPort } from '@sdk/features/identity/libs/management';
import { CREDENTIAL_ADMIN } from '../services/identity-state.tokens';
import {
  IdentityEventPump,
  IdentityDeletionPump,
  MysqlIdentityEvents,
  MysqlIdentityDeletions,
  MysqlAccountErasureJobs,
  MysqlAccountErasureParticipant,
  MysqlAccountErasureCleanup,
} from '@wapps/account-mysql';
import { RabbitMqQueueClient } from '@sdk/extras/queue-rabbitmq';
import { IDENTITY_EVENTS_QUEUE_NAME } from '@apps/shared';

@Injectable()
export class IdentityWorkers implements OnModuleInit, OnModuleDestroy {
  private readonly events: IdentityEventPump;
  private readonly deletions: IdentityDeletionPump;
  private readonly erasures: IdentityDeletionPump;

  constructor(
    config: ConfigService,
    source: DataSource,
    @Inject(CREDENTIAL_ADMIN) credentials: IUserAdminPort
  ) {
    const logger = new Logger('IdentityWorkers');
    this.events = new IdentityEventPump(
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
    this.deletions = new IdentityDeletionPump(
      new CompleteIdentityDeletion(
        new MysqlIdentityDeletions(source),
        {
          remove: async (uid) => {
            const result = await credentials.deleteUser(uid);
            if (!result.ok) throw result.error;
          },
        },
        randomUUID
      ),
      (message) => logger.error(message)
    );
    const secret = config.getOrThrow<string>('ACCOUNT_ERASURE_SECRET');
    this.erasures = new IdentityDeletionPump(
      new CompleteAccountErasure(
        new MysqlAccountErasureJobs(source),
        new RequestAccountErasure([
          new CleanAccountErasureParticipant(
            new MysqlAccountErasureParticipant('account', source),
            new MysqlAccountErasureCleanup(source)
          ),
          new RemoteAccountErasureParticipant(
            'editorial',
            config.getOrThrow<string>('EDITORIAL_URL'),
            secret
          ),
          new RemoteAccountErasureParticipant(
            'discussion',
            config.getOrThrow<string>('DISCUSSION_URL'),
            secret
          ),
        ]),
        randomUUID
      ),
      (message) => logger.error(`Cross-service erasure: ${message}`)
    );
  }

  onModuleInit(): void {
    this.events.start();
    this.deletions.start();
    this.erasures.start();
  }
  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.events.stop(),
      this.deletions.stop(),
      this.erasures.stop(),
    ]);
  }
}
