/* Real-store qualification; requires dedicated temporary stores from qualify-materialization.cjs. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const config = path.join(root, 'tsconfig.base.json');
require('ts-node').register({
  project: config,
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
require('tsconfig-paths').register({
  baseUrl: root,
  paths: ts.readConfigFile(config, ts.sys.readFile).config.compilerOptions
    .paths,
});
const {
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
} = require('../../libs/adapters/account-mysql/src');
const { DataSource } = require('typeorm');
const { createPool } = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const { ConfigService } = require('@nestjs/config');
const amqp = require('amqplib');
const { MinioClient } = require('@sdk/extras/minio');
const {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
} = require('@aws-sdk/client-s3');
const { claimFreshObjectStore } = require('./fresh-object-store.cjs');
const { RabbitMqQueueClient } = require('@sdk/extras/queue-rabbitmq');
const management = path.join(
  root,
  'apps/services/community/src/app/discussions'
);
const materializer = path.join(
  root,
  'sdk/features/discussion/applications/materializer/service/src'
);
const { DiscussionWriteModel1791676800000 } = require(path.join(
  management,
  'infrastructure/discussion-write-model.migration.ts'
));
const { DiscussionBackfill1791676801000 } = require(path.join(
  management,
  'infrastructure/discussion-backfill.migration.ts'
));
const { DiscussionArticleTargets1791676822000 } = require(path.join(
  management,
  'infrastructure/discussion-article-targets.migration.ts'
));
const { DiscussionApplicationTargets1791676823000 } = require(path.join(
  management,
  'infrastructure/discussion-application-targets.migration.ts'
));
const { DiscussionParticipation1791676824000 } = require(path.join(
  management,
  'infrastructure/discussion-participation.migration.ts'
));
const { DiscussionVotes1791676825000 } = require(path.join(
  management,
  'infrastructure/discussion-votes.migration.ts'
));
const { DiscussionBindingIndex1792150000000 } = require(path.join(
  root,
  'apps/services/community/src/app/discussions/infrastructure/discussion-binding-index.migration.ts'
));
const { CommunityDiscussionBindingKeys1792080000000 } = require(path.join(
  management,
  'infrastructure/discussion-binding-keys.migration.ts'
));
const { DiscussionPins1791676826000 } = require(path.join(
  management,
  'infrastructure/discussion-pins.migration.ts'
));
const { MemberReviews1791676827000 } = require(path.join(
  management,
  '../reviews/infrastructure/member-reviews.migration.ts'
));
const { MysqlDiscussionBackfill } = require(path.join(
  management,
  'infrastructure/mysql-discussion-backfill.ts'
));
const { MinioLegacyDiscussionPayloads } = require(path.join(
  management,
  'infrastructure/legacy-discussion-payloads.ts'
));
const { LegacyDiscussionBackfill } = require(path.join(
  management,
  'application/legacy-discussion-backfill.ts'
));
const { MysqlDiscussionWrites } = require(path.join(
  management,
  'infrastructure/mysql-discussion-writes.ts'
));
const { MinioDiscussionPayloadObjects } = require(path.join(
  management,
  'infrastructure/immutable-discussion-payloads.ts'
));
const { DiscussionPayloads1791840004000 } = require(path.join(
  management,
  'infrastructure/discussion-payloads.migration.ts'
));
const { DiscussionPayloadInventory1791840005000 } = require(path.join(
  management,
  'infrastructure/discussion-payload-inventory.migration.ts'
));
const { DiscussionAuthorErasure1791840006000 } = require(path.join(
  management,
  'infrastructure/discussion-author-erasure.migration.ts'
));
const { DiscussionPrivateErasure1791840007000 } = require(path.join(
  management,
  'infrastructure/discussion-private-erasure.migration.ts'
));
const { ReviewErasure1791840008000 } = require(path.join(
  management,
  '../reviews/infrastructure/review-erasure.migration.ts'
));
const {
  DiscussionContentUpdates1791840018000,
} = require('../../apps/services/community/src/app/discussions/infrastructure/content-update-cursors.migration');
const { ReplyNotifications1791840015000 } = require(path.join(
  management,
  'infrastructure/reply-notifications.migration.ts'
));
const { MentionNotifications1791864016000 } = require(path.join(
  management,
  'infrastructure/mention-notifications.migration.ts'
));
const { MysqlDiscussionPayloads } = require(path.join(
  management,
  'infrastructure/mysql-discussion-payloads.ts'
));
const { RegisteredDiscussionPayloads } = require(path.join(
  management,
  'application/registered-discussion-payloads.ts'
));
const { DurableDiscussionCommands } = require(path.join(
  management,
  'application/durable-discussion-commands.ts'
));
const { CryptoDiscussionIdentificatorGenerator } = require(path.join(
  management,
  'infrastructure/discussion-identificator.generator.ts'
));
const { DiscussionOutboxDispatcher } = require(path.join(
  management,
  'infrastructure/discussion-outbox.dispatcher.ts'
));
const { MysqlDiscussionSnapshotReader } = require(path.join(
  materializer,
  'mysql-snapshot-reader.ts'
));
const { MinioImmutablePayloadReader } = require(path.join(
  materializer,
  'immutable-payload-reader.ts'
));
const { MongoGenerationStore } = require(path.join(
  materializer,
  'mongo-generation-store.ts'
));
const { materializeDiscussion } = require(path.join(
  materializer,
  'materialization.ts'
));
const { enqueueDiscussionRebuildPage } = require(path.join(
  materializer,
  'rebuild.ts'
));
const { reconcileDiscussions } = require(path.join(
  materializer,
  'reconciliation.ts'
));
const { MysqlDiscussionReconciliationSource } = require(path.join(
  materializer,
  'mysql-reconciliation-source.ts'
));
const { MongoGenerationInspector } = require(path.join(
  materializer,
  'mongo-generation-inspector.ts'
));

test(
  'discussion SQL/outbox/object/projection recovery against local real stores',
  { timeout: 120_000 },
  async () => {
    assert.equal(
      process.env.WAPPS_DISCUSSION_INTEGRATION,
      '1',
      'Set WAPPS_DISCUSSION_INTEGRATION=1 with the local Compose dependencies running; unavailable checks must not be reported as passed.'
    );
    const suffix = randomUUID().replaceAll('-', '');
    const database = `wapps_readiness_${suffix}`;
    const queueName = `wapps.readiness.${suffix}`;
    const password = process.env.LOCAL_PASSWORD ?? 'wapps-local-password';
    const storageHost = `http://${
      process.env.DISCUSSION_TEST_MINIO_HOST ?? '127.0.0.1'
    }:${Number(process.env.DISCUSSION_TEST_MINIO_PORT ?? 9000)}`;
    const storageGuard = new S3Client({
      endpoint: storageHost,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.DISCUSSION_TEST_MINIO_USERNAME ?? 'wapps',
        secretAccessKey: password,
      },
    });
    let releaseStore;
    try {
      releaseStore = await claimFreshObjectStore({
        listBuckets: async () => {
          const result = await storageGuard.send(new ListBucketsCommand({}));
          if (!Array.isArray(result.Buckets))
            throw new Error('Cannot establish object-store isolation');
          return result.Buckets.map((bucket) => bucket.Name);
        },
        createBucket: (Bucket) =>
          storageGuard.send(new CreateBucketCommand({ Bucket })),
        deleteBucket: (Bucket) =>
          storageGuard.send(new DeleteBucketCommand({ Bucket })),
      });
    } catch (error) {
      storageGuard.destroy();
      throw error;
    }
    const mysqlOptions = {
      host: process.env.DISCUSSION_TEST_MYSQL_HOST ?? '127.0.0.1',
      port: Number(process.env.DISCUSSION_TEST_MYSQL_PORT ?? 3306),
      user: process.env.DISCUSSION_TEST_MYSQL_USERNAME ?? 'root',
      password,
      connectTimeout: 5000,
    };
    const admin = createPool(mysqlOptions);
    const pool = createPool({ ...mysqlOptions, database });
    const mongo =
      process.env.WAPPS_ACCOUNT_EXPORT_DISCUSSION === '1' ||
      process.env.WAPPS_REPLY_NOTIFICATIONS === '1' ||
      process.env.WAPPS_MENTION_NOTIFICATIONS === '1' ||
      process.env.WAPPS_FAVORITE_UPDATES === '1' ||
      process.env.WAPPS_DISCUSSION_PAYLOADS === '1'
        ? null
        : new MongoClient(
            `mongodb://wapps:${encodeURIComponent(password)}@${
              process.env.DISCUSSION_TEST_MONGO_HOST ?? '127.0.0.1'
            }:${Number(
              process.env.DISCUSSION_TEST_MONGO_PORT ?? 27017
            )}/?authSource=admin`,
            { serverSelectionTimeoutMS: 5000 }
          );
    const minio = new MinioClient({
      host: storageHost,
      accessKey: process.env.DISCUSSION_TEST_MINIO_USERNAME ?? 'wapps',
      secretKey: password,
    });
    const db = new DataSource({
      type: 'mysql',
      ...mysqlOptions,
      username: mysqlOptions.user,
      database,
      migrations: [
        DiscussionWriteModel1791676800000,
        DiscussionBackfill1791676801000,
        DiscussionArticleTargets1791676822000,
        DiscussionApplicationTargets1791676823000,
        DiscussionParticipation1791676824000,
        DiscussionVotes1791676825000,
        DiscussionPins1791676826000,
        MemberReviews1791676827000,
        IdentityWriteBarrier1791840000000,
        AccountErasureRequests1791840001000,
        DiscussionPayloads1791840004000,
        DiscussionPayloadInventory1791840005000,
        DiscussionAuthorErasure1791840006000,
        DiscussionPrivateErasure1791840007000,
        ReviewErasure1791840008000,
        ReplyNotifications1791840015000,
        MentionNotifications1791864016000,
        DiscussionContentUpdates1791840018000,
        CommunityDiscussionBindingKeys1792080000000,
        DiscussionBindingIndex1792150000000,
      ],
      synchronize: false,
    });
    const broker = new RabbitMqQueueClient();
    const uploaded = [];
    let createdDatabase = false;
    let connectedMongo = false;
    let dispatcher;
    let brokerAdmin;
    let queueCreated = false;
    try {
      await admin.query(
        `CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
      );
      createdDatabase = true;
      await db.initialize();
      await db.runMigrations({ transaction: 'each' });
      assert.equal(
        (await db.runMigrations({ transaction: 'each' })).length,
        0,
        'Migrations must be restart-safe'
      );
      if (process.env.WAPPS_FAVORITE_UPDATES === '1') {
        await minio.ensureBucket('discussion-content');
        await require('./favorite-update-checks.cjs')({
          source: db,
          minio,
          uploaded,
        });
        return;
      }
      if (process.env.WAPPS_MENTION_NOTIFICATIONS === '1') {
        await minio.ensureBucket('discussion-content');
        await require('./mention-notification-checks.cjs')({
          source: db,
          minio,
          uploaded,
        });
        return;
      }
      if (process.env.WAPPS_REPLY_NOTIFICATIONS === '1') {
        await minio.ensureBucket('discussion-content');
        await require('./reply-notification-checks.cjs')({
          source: db,
          minio,
          uploaded,
        });
        return;
      }
      if (process.env.WAPPS_DISCUSSION_PAYLOADS === '1') {
        await minio.ensureBucket('discussion-content');
        await require('./discussion-payload-checks.cjs')({
          source: db,
          minio,
          uploaded,
        });
        await require('./discussion-payload-inventory-checks.cjs')({
          source: db,
          minio,
          uploaded,
        });
        return;
      }
      if (process.env.WAPPS_ACCOUNT_EXPORT_DISCUSSION === '1') {
        const {
          qualifyDiscussionAccountExport,
        } = require('./account-export-discussion-checks.cjs');
        await minio.ensureBucket('discussion-content');
        await qualifyDiscussionAccountExport({ source: db, minio, uploaded });
        return;
      }
      await mongo.connect();
      connectedMongo = true;
      await minio.ensureBucket('discussion-content');
      if (process.env.WAPPS_DISCUSSION_AUTHOR_ERASURE === '1') {
        await require('./discussion-author-erasure-checks.cjs')({
          source: db,
          minio,
          uploaded,
          mongo,
          pool,
        });
        await require('./discussion-projection-erasure-checks.cjs')({
          source: db,
          minio,
          mongo,
          pool,
        });
        await require('./discussion-private-erasure-checks.cjs')({
          source: db,
          minio,
          mongo,
          pool,
          uploaded,
        });
        await require('./review-erasure-checks.cjs')({ source: db });
        return;
      }
      const immutable = new RegisteredDiscussionPayloads(
        new MysqlDiscussionPayloads(db),
        new MinioDiscussionPayloadObjects(minio)
      );
      const payloads = {
        put: async (...args) => {
          const ref = await immutable.put(...args);
          uploaded.push(ref.key);
          return ref;
        },
      };
      const writes = new MysqlDiscussionWrites(db);
      if (process.env.WAPPS_DISCUSSION_BFF === '1') {
        await require('./bff-generic-discussions-runtime-checks.cjs')({
          source: db,
          pool,
          mongo,
          minio,
          payloads,
          password,
        });
        return;
      }
      const policy = { evaluate: async () => ({ ok: true, value: true }) };
      const commands = new DurableDiscussionCommands(
        writes,
        payloads,
        policy,
        new CryptoDiscussionIdentificatorGenerator()
      );
      const actor = {
        identityId: `owner-${suffix}`,
        tenantId: 'test',
        roles: ['discussion:writer'],
      };
      const rootCommit = await commands.create(
        { content: 'root' },
        actor,
        'create'
      );
      assert.deepEqual(
        await commands.create({ content: 'root' }, actor, 'create'),
        rootCommit
      );
      assert.equal(
        uploaded.length,
        1,
        'Idempotency replay must not allocate another object'
      );
      assert.equal(
        (await db.query('SELECT * FROM discussion_outbox')).length,
        1
      );

      await db.query(
        `CREATE TRIGGER reject_test_outbox BEFORE INSERT ON discussion_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Injected outbox failure'`
      );
      await assert.rejects(
        commands.reply(rootCommit.id, 'uncommitted', actor, 'rollback'),
        /Injected outbox failure/
      );
      await db.query('DROP TRIGGER reject_test_outbox');
      assert.equal(
        (await db.query('SELECT * FROM content_nodes')).length,
        1,
        'Outbox failure must roll back the node'
      );
      assert.equal((await writes.resource(rootCommit.id)).revision, 1);
      assert.equal(
        (await db.query('SELECT * FROM discussion_commands')).length,
        1
      );

      const [reply, duplicate] = await Promise.all([
        commands.reply(rootCommit.id, 'reply', actor, 'reply'),
        commands.reply(rootCommit.id, 'reply', actor, 'reply'),
      ]);
      assert.deepEqual(
        reply,
        duplicate,
        'Concurrent command replay must converge'
      );
      assert.equal((await db.query('SELECT * FROM content_nodes')).length, 2);

      const nodes = mongo.db(database).collection('nodes');
      const heads = mongo.db(database).collection('heads');
      const store = new MongoGenerationStore(nodes, heads);
      await store.ensureIndexes();
      const reader = new MysqlDiscussionSnapshotReader(pool);
      const loader = new MinioImmutablePayloadReader(minio);
      const project = () =>
        materializeDiscussion(rootCommit.id, reader, loader, store);
      await Promise.all([project(), project()]);
      assert.equal(
        (await heads.findOne({ _id: rootCommit.id })).descendantsCount,
        1,
        'Duplicate deliveries cannot inflate counts'
      );
      const oldSnapshot = await reader.read(rootCommit.id);
      const oldPayload = oldSnapshot.nodes.find(
        (node) => node.id === reply.id
      ).payload;
      const edit = await commands.update(
        reply.id,
        { content: 'edited', expectedRevision: reply.revision },
        actor,
        'edit'
      );
      assert.equal(
        JSON.parse((await loader.read(oldPayload)).toString()).content,
        'reply',
        'An edit must not overwrite the old immutable object'
      );
      await project();
      assert.equal(
        await materializeDiscussion(
          rootCommit.id,
          { read: async () => oldSnapshot },
          loader,
          store
        ),
        'superseded'
      );
      assert.equal(
        (await heads.findOne({ _id: rootCommit.id })).revision,
        edit.revision
      );
      assert.equal(
        await nodes.countDocuments({ schemaVersion: 4 }),
        2,
        'Reordered snapshots must not retain historical node payload copies'
      );
      const currentHead = await heads.findOne({ _id: rootCommit.id });
      const currentNodes = await nodes
        .find({ generation: currentHead.generation })
        .toArray();
      const upgradeHead = {
        ...currentHead,
        schemaVersion: 2,
        fingerprint: 'b'.repeat(64),
        generation: `${rootCommit.id}:${currentHead.revision}:${'b'.repeat(
          64
        )}`,
      };
      await nodes.insertMany(
        currentNodes.map((node) => ({
          ...node,
          _id: `${upgradeHead.generation}:${node.id}`,
          generation: upgradeHead.generation,
          schemaVersion: 2,
        }))
      );
      await heads.replaceOne({ _id: rootCommit.id }, upgradeHead);
      assert.equal(
        await new MongoGenerationInspector(nodes, heads).inspect({
          id: rootCommit.id,
          tenantId: actor.tenantId,
          revision: edit.revision,
          nodeCount: 2,
        }),
        'stale'
      );
      assert.equal(
        await project(),
        'published',
        'A schema upgrade can replace an older-schema head at the same canonical revision'
      );
      assert.deepEqual(
        await heads.findOne({ _id: rootCommit.id }),
        currentHead
      );
      const conflicted = await reader.read(rootCommit.id);
      conflicted.nodes[1].visibility = 'private';
      await assert.rejects(
        materializeDiscussion(
          rootCommit.id,
          { read: async () => conflicted },
          loader,
          store
        ),
        /Conflicting discussion projection node/
      );
      assert.deepEqual(
        await nodes.find({ generation: currentHead.generation }).toArray(),
        currentNodes
      );

      let releaseOld;
      let oldEntered;
      const oldGate = new Promise((resolve) => {
        releaseOld = resolve;
      });
      const oldPaused = new Promise((resolve) => {
        oldEntered = resolve;
      });
      const pausedOld = materializeDiscussion(
        rootCommit.id,
        { read: async () => oldSnapshot },
        loader,
        {
          writeNodes: async (batch) => {
            oldEntered();
            await oldGate;
            await store.writeNodes(batch);
          },
          publish: (head) => store.publish(head),
        }
      );
      await oldPaused;
      const liked = await commands.like(reply.id, true, actor, 'like');
      const likedAgain = await commands.like(
        reply.id,
        true,
        actor,
        'like-again'
      );
      assert.equal(
        likedAgain.revision,
        liked.revision,
        'An already-applied like must not advance the aggregate'
      );
      const deleted = await commands.remove(
        reply.id,
        liked.revision,
        actor,
        'delete'
      );
      await project();
      const expectedHead = await heads.findOne({ _id: rootCommit.id });
      const expectedNodes = await nodes
        .find({ generation: expectedHead.generation })
        .sort({ _id: 1 })
        .toArray();
      assert.equal(expectedHead.descendantsCount, 0);
      assert.equal(
        expectedNodes.find((node) => node.id === reply.id).payload,
        null
      );
      releaseOld();
      assert.equal(await pausedOld, 'superseded');
      assert.equal(
        (await nodes.findOne({ _id: reply.id })).payload,
        null,
        'A worker paused before its first write cannot restore removed bytes'
      );
      assert.equal(await nodes.countDocuments({ schemaVersion: 4 }), 2);
      await nodes.drop();
      await heads.drop();
      await store.ensureIndexes();
      await project();
      assert.deepEqual(
        await heads.findOne({ _id: rootCommit.id }),
        expectedHead,
        'A fresh read model must rebuild from write authority'
      );
      assert.deepEqual(
        await nodes
          .find({ generation: expectedHead.generation })
          .sort({ _id: 1 })
          .toArray(),
        expectedNodes
      );
      await materializeDiscussion(
        rootCommit.id,
        { read: async () => oldSnapshot },
        loader,
        store
      );
      assert.equal(
        (await heads.findOne({ _id: rootCommit.id })).revision,
        deleted.revision
      );

      const queue = await broker.connect({
        host: process.env.DISCUSSION_TEST_QUEUE_HOST ?? '127.0.0.1',
        port: process.env.DISCUSSION_TEST_QUEUE_PORT ?? '5672',
        username: 'wapps',
        password,
      });
      const isolatedQueue = {
        ...queue,
        assertQueue: async (_name, options) => {
          const result = await queue.assertQueue(queueName, options);
          queueCreated = true;
          return result;
        },
        publishConfirmed: (_name, content, options) =>
          queue.publishConfirmed(queueName, content, options),
      };
      dispatcher = new DiscussionOutboxDispatcher(
        db,
        isolatedQueue,
        broker,
        new ConfigService()
      );
      await dispatcher.onModuleInit();
      const deadline = Date.now() + 15_000;
      while (
        (
          await db.query(
            'SELECT id FROM discussion_outbox WHERE deliveredAt IS NULL'
          )
        ).length
      ) {
        assert.ok(
          Date.now() < deadline,
          'Confirmed outbox delivery did not complete'
        );
        await delay(50);
      }
      await dispatcher.onModuleDestroy();
      dispatcher = undefined;
      const rebuilt = await enqueueDiscussionRebuildPage(pool, '');
      assert.equal(rebuilt.queued, 1);
      assert.equal(
        (
          await db.query(
            'SELECT id FROM discussion_outbox WHERE deliveredAt IS NULL'
          )
        ).length,
        1,
        'Rebuild must requeue the latest committed revision'
      );

      const legacyIds = [randomUUID(), randomUUID(), randomUUID()];
      const legacyRoot = legacyIds[0];
      for (const [index, nodeId] of legacyIds.entries()) {
        await db.query(
          'INSERT INTO content_nodes (id, referenceKey, kind, state, visibility, createdAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            nodeId,
            randomUUID(),
            index ? 'comment' : 'discussion',
            'published',
            'private',
            10,
            index === 2 ? 15 : null,
          ]
        );
        if (index)
          await db.query(
            'INSERT INTO content_node_relations (id, fromContentId, toContentId, relationType, createdAt) VALUES (?, ?, ?, ?, ?)',
            [randomUUID(), nodeId, legacyRoot, 'replies', 10]
          );
        if (index < 2) {
          const key = `discussions/${nodeId}/content`;
          uploaded.push(key);
          await minio.uploadJson('discussion-content', key, {
            content: `legacy-${index}`,
          });
        }
      }
      const manifest = {
        version: 1,
        discussionId: legacyRoot,
        tenantId: 'legacy-test',
        owners: legacyIds.map((nodeId) => ({
          nodeId,
          identityId: actor.identityId,
        })),
      };
      const backfillRepository = new MysqlDiscussionBackfill(db);
      const legacyPayloads = new MinioLegacyDiscussionPayloads(minio);
      const backfill = new LegacyDiscussionBackfill(
        backfillRepository,
        legacyPayloads,
        payloads
      );
      const plan = await backfill.plan(manifest);
      assert.equal(
        await backfillRepository.receipt(legacyRoot),
        null,
        'Planning must not create a receipt'
      );
      const driftingBackfill = new LegacyDiscussionBackfill(
        backfillRepository,
        legacyPayloads,
        {
          put: async (...args) => {
            const ref = await payloads.put(...args);
            await db.query(
              'UPDATE content_nodes SET visibility = ? WHERE id = ?',
              ['public', legacyRoot]
            );
            return ref;
          },
        }
      );
      await assert.rejects(
        driftingBackfill.apply(manifest, plan.fingerprint, true),
        /graph changed/
      );
      await db.query('UPDATE content_nodes SET visibility = ? WHERE id = ?', [
        'private',
        legacyRoot,
      ]);
      await db.query(
        `CREATE TRIGGER reject_test_outbox BEFORE INSERT ON discussion_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Injected backfill outbox failure'`
      );
      await assert.rejects(
        backfill.apply(manifest, plan.fingerprint, true),
        /Injected backfill outbox failure/
      );
      await db.query('DROP TRIGGER reject_test_outbox');
      assert.equal(
        await backfillRepository.receipt(legacyRoot),
        null,
        'Failed SQL transaction must not commit a backfill receipt'
      );
      assert.equal(
        (
          await db.query(
            'SELECT nodeId FROM discussion_write_nodes WHERE discussionId = ?',
            [legacyRoot]
          )
        ).length,
        0,
        'Failed SQL transaction must not assign ownership'
      );
      const [imported, replayed] = await Promise.all([
        backfill.apply(manifest, plan.fingerprint, true),
        backfill.apply(manifest, plan.fingerprint, true),
      ]);
      assert.deepEqual(
        imported,
        replayed,
        'Concurrent importers must converge on one receipt'
      );
      assert.equal(
        (
          await db.query(
            'SELECT id FROM discussion_outbox WHERE discussionId = ?',
            [legacyRoot]
          )
        ).length,
        1
      );
      const legacySnapshot = await reader.read(legacyRoot);
      assert.equal(legacySnapshot.nodes.length, 3);
      assert.ok(
        legacySnapshot.nodes.every(
          (node) =>
            node.ownerIdentityId === actor.identityId &&
            node.visibility === 'private'
        )
      );
      assert.equal(
        legacySnapshot.nodes.find((node) => node.id === legacyIds[2]).payload,
        null
      );
      await minio.uploadJson(
        'discussion-content',
        `discussions/${legacyRoot}/content`,
        { content: 'legacy mutation after cutover' }
      );
      await materializeDiscussion(legacyRoot, reader, loader, store);
      const legacyHead = await heads.findOne({ _id: legacyRoot });
      assert.equal(
        (
          await nodes.findOne({
            generation: legacyHead.generation,
            id: legacyRoot,
          })
        ).payload.content,
        'legacy-0',
        'Projection must use committed immutable copies'
      );
      assert.deepEqual(
        await backfill.apply(manifest, plan.fingerprint, true),
        imported,
        'Committed replay must ignore old mutable objects'
      );
      const reconciliationSource = new MysqlDiscussionReconciliationSource(
        pool
      );
      const inspector = new MongoGenerationInspector(nodes, heads);
      assert.equal(
        (await reconcileDiscussions(reconciliationSource, inspector)).current,
        2
      );
      await nodes.deleteOne({
        generation: legacyHead.generation,
        id: legacyIds[1],
      });
      await db.query(
        'UPDATE discussion_outbox SET deliveredAt = ? WHERE discussionId = ?',
        [Date.now(), legacyRoot]
      );
      const reconciliation = await reconcileDiscussions(
        reconciliationSource,
        inspector,
        { apply: true, batchSize: 1 }
      );
      assert.equal(
        reconciliation.queued,
        1,
        'Partial generation loss must enqueue authoritative recovery'
      );
      assert.equal(reconciliation.conflicts, 0);
      assert.equal(reconciliation.failed, 0);
      await materializeDiscussion(legacyRoot, reader, loader, store);
      assert.equal(
        (await reconcileDiscussions(reconciliationSource, inspector)).current,
        2
      );
      await assert.rejects(
        queue.publishConfirmed(`${queueName}.missing`, Buffer.from('{}')),
        /unroutable/
      );
      brokerAdmin = await amqp.connect(
        `amqp://wapps:${encodeURIComponent(password)}@${
          process.env.DISCUSSION_TEST_QUEUE_HOST ?? '127.0.0.1'
        }:${Number(process.env.DISCUSSION_TEST_QUEUE_PORT ?? 5672)}`
      );
      const channel = await brokerAdmin.createChannel();
      const received = await channel.get(queueName, { noAck: false });
      assert.ok(
        received,
        'A confirmed outbox request must be recoverable from the broker'
      );
      channel.nack(received, false, true);
      const redelivered = await channel.get(queueName, { noAck: false });
      assert.ok(redelivered);
      channel.ack(redelivered);
      await channel.deleteQueue(queueName);
      queueCreated = false;
      await dispatcher?.onModuleDestroy();
      dispatcher = undefined;
      await require('./discussion-binding-checks.cjs')({
        source: db,
        writes,
        payloads,
        policy,
        ids: new CryptoDiscussionIdentificatorGenerator(),
        actor,
        reader,
        loader,
        store,
        nodes,
        heads,
      });
      console.log('Discussion assertions passed; closing test clients.');
    } finally {
      await dispatcher?.onModuleDestroy();
      if (queueCreated) {
        brokerAdmin ??= await amqp.connect(
          `amqp://wapps:${encodeURIComponent(password)}@${
            process.env.DISCUSSION_TEST_QUEUE_HOST ?? '127.0.0.1'
          }:${Number(process.env.DISCUSSION_TEST_QUEUE_PORT ?? 5672)}`
        );
        const cleanup = await brokerAdmin.createChannel();
        await cleanup.deleteQueue(queueName);
      }
      await Promise.allSettled([broker.close(), brokerAdmin?.close()]);
      console.log('Discussion broker clients closed.');
      await Promise.allSettled(
        uploaded.map((key) => minio.deleteObject('discussion-content', key))
      );
      if (connectedMongo) await mongo.db(database).dropDatabase();
      await mongo?.close();
      if (db.isInitialized) await db.destroy();
      await pool.end();
      if (createdDatabase) await admin.query(`DROP DATABASE ${database}`);
      await admin.end();
      try {
        await releaseStore();
      } finally {
        storageGuard.destroy();
      }
    }
  }
);
