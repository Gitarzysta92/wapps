import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Discussion } from './entities/discussion.entity';
import { DiscussionsController } from './discussions.controller';
import { DiscussionsService } from './discussions.service';
import { MinioClient } from '../infrastructure/minio-client';
import { QueueClient, QueueChannel } from '../infrastructure/queue-client';
import { DISCUSSION_CONTENT_BUCKET_NAME } from './infrastructure/minio-discussion-payload.repository';
import amqp from 'amqplib';
import { DISCUSSION_PROJECTION_QUEUE_NAME } from './infrastructure/rabbitmq-discussion-projection.service';
import { ContentNodeEntity } from './infrastructure/content-node.entity';
import { ContentNodeRelationEntity } from './infrastructure/content-node-relation.entity';
import { MysqlContentNodeRepository } from './infrastructure/mysql-content-node.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Discussion, ContentNodeEntity, ContentNodeRelationEntity])],
  controllers: [DiscussionsController],
  providers: [
    DiscussionsService,
    MysqlContentNodeRepository,
    {
      provide: MinioClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new MinioClient({
          host: config.get('DISCUSSION_STORAGE_HOST') as string,
          accessKey: config.get('DISCUSSION_STORAGE_ACCESSKEY') as string,
          secretKey: config.get('DISCUSSION_STORAGE_SECRETKEY') as string,
        }),
    },
    {
      provide: QueueClient,
      useFactory: () => new QueueClient(amqp),
    },
    {
      provide: 'DISCUSSION_QUEUE',
      inject: [QueueClient, ConfigService],
      useFactory: async (client: QueueClient, config: ConfigService): Promise<QueueChannel> =>
        client.connect({
          host: config.get('QUEUE_HOST') as string,
          port: config.get('QUEUE_PORT') as string,
          username: config.get('QUEUE_USERNAME') as string,
          password: config.get('QUEUE_PASSWORD') as string,
        }),
    },
  ],
  exports: [DiscussionsService],
})
export class DiscussionsModule implements OnModuleInit {
  constructor(
    private readonly minioClient: MinioClient,
    @Inject('DISCUSSION_QUEUE') private readonly queue: QueueChannel
  ) {}

  async onModuleInit() {
    await this.minioClient.ensureBucket(DISCUSSION_CONTENT_BUCKET_NAME);
    await this.queue.assertQueue(DISCUSSION_PROJECTION_QUEUE_NAME);
  }
}
