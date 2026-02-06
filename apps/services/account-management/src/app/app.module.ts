import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { AuthValidationMiddleware } from './middleware/auth-validation.middleware';
import { AccountManagementController } from './controllers/account-management.controller';
import { PlatformController } from './controllers/platform.controller';
import { AccountManagementAppService } from './services/account-management-app.service';
import { QueueClient, QueueChannel } from '@infrastructure/platform-queue';
import { ConfigService } from '@nestjs/config';
import { IDENTITY_EVENTS_QUEUE_NAME } from '@apps/shared';
import { PlatformMongoClient } from '@infrastructure/mongo';
import { RabbitMqIdentityEventsPublisher } from './infrastructure/identity/rabbitmq-identity-events.publisher';
import { IdentityProvisioner } from './infrastructure/identity/identity-provisioner';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [HealthController, AccountManagementController, PlatformController],
  providers: [
    AccountManagementAppService,
    {
      provide: QueueClient,
      useFactory: () => new QueueClient(),
    },
    {
      provide: 'IDENTITY_EVENTS_QUEUE',
      inject: [QueueClient, ConfigService],
      useFactory: async (client: QueueClient, config: ConfigService): Promise<QueueChannel> => {
        // If queue env not set, events are disabled (best effort).
        const host = config.get('QUEUE_HOST') as string | undefined;
        const port = config.get('QUEUE_PORT') as string | undefined;
        const username = config.get('QUEUE_USERNAME') as string | undefined;
        const password = config.get('QUEUE_PASSWORD') as string | undefined;

        if (!host || !port || !username || !password) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return null as any;
        }

        return await client.connect({
          host,
          port,
          username,
          password,
        });
      },
    },
    {
      provide: 'IDENTITY_EVENTS_PUBLISHER',
      inject: ['IDENTITY_EVENTS_QUEUE'],
      useFactory: async (queue: QueueChannel) => {
        if (!queue) {
          return {
            publishCreated: () => undefined,
            publishUpdated: () => undefined,
            publishDeleted: () => undefined,
          };
        }
        await queue.assertQueue(IDENTITY_EVENTS_QUEUE_NAME);
        return new RabbitMqIdentityEventsPublisher(queue);
      },
    },
    {
      provide: PlatformMongoClient,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const host = config.get('MONGO_HOST') as string | undefined;
        if (!host) return null as any;

        const client = new PlatformMongoClient();
        await client.connect({
          host,
          port: config.get('MONGO_PORT') as string,
          username: config.get('MONGO_USERNAME') as string,
          password: config.get('MONGO_PASSWORD') as string,
          database: config.get('MONGO_DATABASE') as string,
        });
        return client;
      },
    },
    {
      provide: IdentityProvisioner,
      inject: [PlatformMongoClient],
      useFactory: (mongo: PlatformMongoClient) => {
        if (!mongo) return null as any;
        return new IdentityProvisioner(mongo);
      },
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthValidationMiddleware).forRoutes('*');
  }
}

