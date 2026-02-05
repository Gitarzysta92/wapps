import { ApplicationShell } from '@foundation/standard';
import { PlatformMongoClient } from '@infrastructure/mongo';
import { QueueClient } from '@infrastructure/platform-queue';
import { MysqlClient } from '@infrastructure/mysql';
import {
  DISCUSSION_PROJECTION_QUEUE_NAME,
  DiscussionMaterializationRequestedEvent,
} from '@apps/shared';
import { isEventEnvelope } from '@cross-cutting/events';
import { MinioClient } from '@infrastructure/minio';
import { loadDiscussionPayload } from './minio-payload';
import {
  getNode,
  getRelationsFrom,
  pickDiscussedSubjectId,
  pickReplyParentId,
  resolveDiscussionRoot,
} from './mysql-reader';
import type { DiscussionAggregateProjection, DiscussionNodeProjection } from './projection-types';

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

  minioHost: { value: process.env.DISCUSSION_STORAGE_HOST as string },
  minioAccessKey: { value: process.env.DISCUSSION_STORAGE_ACCESSKEY as string },
  minioSecretKey: { value: process.env.DISCUSSION_STORAGE_SECRETKEY as string },
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
  const mysqlPool = await mysqlClient.connect({
    host: params.mysqlHost,
    port: Number(params.mysqlPort),
    user: params.mysqlUsername,
    password: params.mysqlPassword,
    database: params.mysqlDatabase,
  });

  const minioClient = new MinioClient({
    host: params.minioHost,
    accessKey: params.minioAccessKey,
    secretKey: params.minioSecretKey,
  });

  const nodes = mongoClient.collection<DiscussionNodeProjection>('discussion_nodes');
  const aggregates = mongoClient.collection<DiscussionAggregateProjection>('discussion_aggregates');
  const applied = mongoClient.collection<{ _id: string; appliedAt: string }>('materializer_applied_events');

  return { mongoClient, queueClient, queue, mysqlClient, mysqlPool, minioClient, nodes, aggregates, applied };
}).run(async ({ queue, mysqlPool, minioClient, nodes, aggregates, applied }) => {
  await queue.assertQueue(DISCUSSION_PROJECTION_QUEUE_NAME, { durable: true });
  await queue.assertExchange(DISCUSSION_PROJECTION_QUEUE_NAME, 'direct', { durable: true });
  await queue.bindQueue(DISCUSSION_PROJECTION_QUEUE_NAME, DISCUSSION_PROJECTION_QUEUE_NAME, { durable: true });

  await queue.consumeJson<DiscussionMaterializationRequestedEvent>(
    DISCUSSION_PROJECTION_QUEUE_NAME,
    async (evt) => {
      // Idempotency guard: if event already applied, do nothing.
      const already = await applied.findOne({ _id: evt.meta.id });
      if (already) return;

      const nodeId = evt.payload.discussionId;

      const node = await getNode(mysqlPool, nodeId);
      if (!node) {
        // Non-retryable: node does not exist (deleted or out-of-order).
        await applied.insertOne({ _id: evt.meta.id, appliedAt: new Date().toISOString() });
        return;
      }

      const rels = await getRelationsFrom(mysqlPool, nodeId);
      const parentId = pickReplyParentId(rels);
      const subjectId = pickDiscussedSubjectId(rels);

      const { discussionId, depth } =
        node.kind === 'discussion'
          ? { discussionId: node.id, depth: 0 }
          : await resolveDiscussionRoot(mysqlPool, nodeId);

      // For now we keep subjectReferenceKey null unless subjectId is known and resolvable.
      // If you later want subjectReferenceKey, resolve it via an extra getNode(mysqlPool, subjectId).
      const subjectReferenceKey = null;

      const payload = await loadDiscussionPayload(minioClient, nodeId);

      const projection: DiscussionNodeProjection = {
        _id: node.id,
        kind: node.kind,
        discussionId,
        parentId,
        depth,
        subjectId,
        subjectReferenceKey,
        referenceKey: node.referenceKey,
        state: node.state,
        visibility: node.visibility,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        deletedAt: node.deletedAt,
        payload,
        materializedAt: new Date().toISOString(),
        materializedFromEventId: evt.meta.id,
        materializedFromOccurredAt: evt.meta.occurredAt,
      };

      await nodes.updateOne({ _id: projection._id }, { $set: projection }, { upsert: true });

      // Maintain tiny aggregate for root discussions (fast sorting).
      // Keep it replay-safe by using the applied-events guard above.
      if (discussionId === node.id) {
        // root discussion itself
        await aggregates.updateOne(
          { _id: discussionId },
          {
            $setOnInsert: {
              _id: discussionId,
              subjectId,
              subjectReferenceKey,
              createdAt: node.createdAt,
              descendantsCount: 0,
            },
            $max: { lastActivityAt: node.createdAt },
          },
          { upsert: true }
        );
      } else {
        // comment: bump root lastActivityAt + descendantsCount
        await aggregates.updateOne(
          { _id: discussionId },
          {
            $setOnInsert: {
              _id: discussionId,
              subjectId,
              subjectReferenceKey,
              createdAt: node.createdAt,
              descendantsCount: 0,
            },
            $max: { lastActivityAt: node.createdAt },
            $inc: { descendantsCount: 1 },
          },
          { upsert: true }
        );
      }

      await applied.insertOne({ _id: evt.meta.id, appliedAt: new Date().toISOString() });
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