import { ApplicationShell } from '@foundation/standard';
import { PlatformMongoClient } from '@infrastructure/mongo';
import { QueueClient } from '@infrastructure/platform-queue';
import { MysqlClient } from '@infrastructure/mysql';
import {
  DISCUSSION_PROJECTION_QUEUE_NAME,
  DiscussionMaterializationRequestedEvent,
} from '@apps/shared';
import { isEventEnvelope } from '@cross-cutting/events';

const application = new ApplicationShell({
  mongoHost: { value: process.env.MONGO_HOST as string },
  mongoPort: { value: process.env.MONGO_PORT as string },
  mongoUsername: { value: process.env.MONGO_USERNAME as string },
  mongoPassword: { value: process.env.MONGO_PASSWORD as string },
  mongoDatabase: { value: process.env.MONGO_DATABASE as string },

  queueHost: { value: process.env.QUEUE_HOST as string },
  queuePort: { value: process.env.QUEUE_PORT as string },
  queueUsername: { value: process.env.QUEUE_USERNAME as string },
  queuePassword: { value: process.env.QUEUE_PASSWORD as string },

  mysqlHost: { value: process.env.MYSQL_HOST as string },
  mysqlPort: { value: process.env.MYSQL_PORT as string },
  mysqlUsername: { value: process.env.MYSQL_USERNAME as string },
  mysqlPassword: { value: process.env.MYSQL_PASSWORD as string },
  mysqlDatabase: { value: process.env.MYSQL_DATABASE as string },
});

application.initialize(async (params) => {
  const mongoClient = new PlatformMongoClient();
  await mongoClient.connect({
    host: params.mongoHost,
    port: params.mongoPort,
    username: params.mongoUsername,
    password: params.mongoPassword,
    database: params.mongoDatabase,
  });

  const queueClient = new QueueClient();
  const queue = await queueClient.connect({
    host: params.queueHost,
    port: params.queuePort,
    username: params.queueUsername,
    password: params.queuePassword,
  });

  const mysqlClient = new MysqlClient();
  await mysqlClient.connect({
    host: params.mysqlHost,
    port: Number(params.mysqlPort),
    user: params.mysqlUsername,
    password: params.mysqlPassword,
    database: params.mysqlDatabase,
  });

  return { mongoClient, queueClient, queue };
}).run(async ({ mongoClient, queueClient, queue }) => {
  await queue.assertQueue(DISCUSSION_PROJECTION_QUEUE_NAME, { durable: true });
  await queue.assertExchange(DISCUSSION_PROJECTION_QUEUE_NAME, 'direct', { durable: true });
  await queue.bindQueue(DISCUSSION_PROJECTION_QUEUE_NAME, DISCUSSION_PROJECTION_QUEUE_NAME, { durable: true });

  await queue.consumeJson<DiscussionMaterializationRequestedEvent>(
    DISCUSSION_PROJECTION_QUEUE_NAME,
    async (evt) => {
      console.log('🚀 Discussion Materializer received event:', evt.meta.type, evt.payload);
      // TODO: persist materialized projection into MongoDB (by evt.payload.discussionId)
      void mongoClient; // placeholder until materialization logic is implemented
      void queueClient;
    },
    {
      ack: 'onSuccess',
      nackOnError: true,
      requeueOnError: true,
      parse: (value: unknown) => {
        if (!isEventEnvelope(value)) {
          throw new Error('Invalid event envelope');
        }
        if (value.meta.type !== 'discussion.materialization.requested') {
          throw new Error(`Unexpected event type: ${value.meta.type}`);
        }
        return value as DiscussionMaterializationRequestedEvent;
      },
    }
  );

}).finally(async () => {
  // TODO: close clients on shutdown (mongo, queue, mysql)
});