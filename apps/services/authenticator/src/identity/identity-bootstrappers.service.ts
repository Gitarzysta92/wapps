import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { IIdentityGraphProvisioner, IdentityService } from '@domains/identity/authentication';
import { PlatformMongoClient } from '@infrastructure/mongo';
import { QueueChannel, QueueClient } from '@infrastructure/platform-queue';
import { MysqlClient, MysqlIdentitySubjectRepository } from '@infrastructure/mysql';
import { IDENTITY_EVENTS_QUEUE_NAME } from '@apps/shared';
import { MongoIdentityNodeRepository } from '../infrastructure/identity/identity-provisioner';
import { MongoIdentityGraphProvisionerAdapter } from '../infrastructure/identity/mongo-identity-graph-provisioner.adapter';
import { RabbitMqIdentityEventsPublisher } from '../infrastructure/identity/rabbitmq-identity-events.publisher';
import { IdentityEventsPublisherHolder } from './identity-events-publisher.holder';
import { IdentityGraphProvisionerHolder } from './identity-graph-provisioner.holder';

@Injectable()
export class IdentityBootstrappersService implements OnModuleInit {
  private readonly logger = new Logger(IdentityBootstrappersService.name);

  constructor(
    private readonly eventsPublisherHolder: IdentityEventsPublisherHolder,
    private readonly graphProvisionerHolder: IdentityGraphProvisionerHolder
  ) {}

  onModuleInit(): void {
    // Keep behavior similar to the previous Express bootstrap:
    // start the service even if external deps are unavailable.
    void this.initIdentityEventsPublisher();
    void this.initIdentityGraphProvisioner();
  }

  private async initIdentityEventsPublisher(): Promise<void> {
    const { QUEUE_HOST, QUEUE_PORT, QUEUE_USERNAME, QUEUE_PASSWORD } = process.env;
    if (!QUEUE_HOST || !QUEUE_PORT || !QUEUE_USERNAME || !QUEUE_PASSWORD) {
      return;
    }

    const queueClient = new QueueClient();
    try {
      const ch: QueueChannel = await queueClient.connect({
        host: QUEUE_HOST,
        port: QUEUE_PORT,
        username: QUEUE_USERNAME,
        password: QUEUE_PASSWORD,
      });
      await ch.assertQueue(IDENTITY_EVENTS_QUEUE_NAME);
      this.eventsPublisherHolder.set(new RabbitMqIdentityEventsPublisher(ch));
      this.logger.log('📣 Identity events enabled (RabbitMQ)');
    } catch (e) {
      this.logger.warn(`⚠️  Identity events disabled (RabbitMQ connect failed): ${(e as any)?.message ?? e}`);
    }
  }

  private async initIdentityGraphProvisioner(): Promise<void> {
    if (!process.env.MONGO_HOST) {
      return;
    }

    const hasMysql =
      process.env.MYSQL_HOST &&
      process.env.MYSQL_PORT &&
      process.env.MYSQL_USERNAME &&
      process.env.MYSQL_PASSWORD &&
      process.env.MYSQL_DATABASE;

    if (!hasMysql) {
      this.logger.warn(
        '⚠️  Identity graph provisioning disabled: MySQL subject store not configured (set MYSQL_HOST, MYSQL_PORT, MYSQL_USERNAME, MYSQL_PASSWORD, MYSQL_DATABASE)'
      );
      return;
    }

    const mongo = new PlatformMongoClient();
    const mysql = new MysqlClient();
    const pool = mysql.connect({
      host: process.env.MYSQL_HOST as string,
      port: parseInt(process.env.MYSQL_PORT as string, 10),
      user: process.env.MYSQL_USERNAME as string,
      password: process.env.MYSQL_PASSWORD as string,
      database: process.env.MYSQL_DATABASE as string,
    });
    const subjectsRepo = new MysqlIdentitySubjectRepository(pool);

    try {
      await Promise.all([
        mongo.connect({
          host: process.env.MONGO_HOST,
          port: process.env.MONGO_PORT,
          username: process.env.MONGO_USERNAME,
          password: process.env.MONGO_PASSWORD,
          database: process.env.MONGO_DATABASE,
        }),
        subjectsRepo.ensureSchema().then((r) => {
          if (!r.ok) throw r.error;
        }),
      ]);

      const nodesRepo = new MongoIdentityNodeRepository(mongo);
      const ids = { generate: () => uuidv7() };
      const identityService = new IdentityService(nodesRepo, subjectsRepo, ids);
      const base: IIdentityGraphProvisioner = new MongoIdentityGraphProvisionerAdapter(identityService);
      this.graphProvisionerHolder.set(base);
      this.logger.log('🧠 Identity provisioning enabled (Mongo graph + MySQL subjects)');
    } catch (e) {
      this.logger.warn(`⚠️  Identity graph provisioning disabled (bootstrap failed): ${(e as any)?.message ?? e}`);
    }
  }
}

