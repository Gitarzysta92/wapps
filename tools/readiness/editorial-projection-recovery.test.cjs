/* Explicit qualification against disposable localhost SQL/Mongo databases and queues. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
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
require('reflect-metadata');
const {
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
} = require('../../libs/adapters/account-mysql/src');
const { DataSource } = require('typeorm');
const { createConnection } = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const amqp = require('amqplib');
const { v7: uuidv7 } = require('uuid');
const { RabbitMqQueueClient } = require('@sdk/extras/queue-rabbitmq');
const {
  EDITORIAL_PROJECTION_QUEUE,
  EDITORIAL_PROJECTION_FAILED_QUEUE,
} = require('@apps/shared');
const service = path.join(root, 'apps/services/editorial/src/app');
const load = (name) => require(path.join(service, name));
const { EditorialCommands } = load('application/editorial-commands');
const { DispatchEditorialOutbox } = load('application/editorial-outbox');
const { consumeEditorialProjection, ensureEditorialProjectionQueues } = load(
  'application/editorial-projection-consumer'
);
const { projectEditorialSnapshot } = load(
  'application/editorial-materialization'
);
const { rebuildEditorialProjections, reconcileEditorialProjections } = load(
  'application/editorial-projection-recovery'
);
const { EditorialOwnership1791676802000 } = load(
  'infrastructure/editorial-schema.migration'
);
const { EditorialBackfill1791676803000 } = load(
  'infrastructure/editorial-backfill.migration'
);
const { EditorialLegacyBackfill } = load('application/editorial-backfill');
const { MysqlEditorialBackfill } = load(
  'infrastructure/mysql-editorial-backfill'
);
const { MysqlEditorialWrites } = load('infrastructure/mysql-editorial-writes');
const { MysqlEditorialOutbox } = load('infrastructure/mysql-editorial-outbox');
const { MysqlEditorialSnapshotReader } = load(
  'infrastructure/mysql-editorial-snapshot'
);
const { MysqlEditorialProjectionRecovery } = load(
  'infrastructure/mysql-editorial-projection-recovery'
);
const { MongoEditorialProjections } = load(
  'infrastructure/mongo-editorial-projections'
);

test(
  'Editorial real-store replay, tombstones, dead-letter transfer and projection rebuild',
  { timeout: 90_000 },
  async () => {
    assert.equal(
      process.env.WAPPS_EDITORIAL_PROJECTION_INTEGRATION,
      '1',
      'Set WAPPS_EDITORIAL_PROJECTION_INTEGRATION=1 with local MySQL, MongoDB and RabbitMQ running; unavailable dependencies are not passes.'
    );
    const run = randomUUID().replaceAll('-', '');
    const database = `editorial_projection_${run}`;
    const queueNames = {
      [EDITORIAL_PROJECTION_QUEUE]: `${EDITORIAL_PROJECTION_QUEUE}.${run}`,
      [EDITORIAL_PROJECTION_FAILED_QUEUE]: `${EDITORIAL_PROJECTION_FAILED_QUEUE}.${run}`,
    };
    const localPassword = process.env.LOCAL_PASSWORD ?? 'wapps-local-password';
    const sql = {
      host: '127.0.0.1',
      port: Number(process.env.EDITORIAL_TEST_MYSQL_PORT ?? 3306),
      user: process.env.EDITORIAL_TEST_MYSQL_USERNAME ?? 'wapps',
      password: process.env.EDITORIAL_TEST_MYSQL_PASSWORD ?? localPassword,
      connectTimeout: 3000,
    };
    const admin = await createConnection(sql);
    let source;
    let mongo;
    let brokerControl;
    let channel;
    const broker = new RabbitMqQueueClient();
    let sqlCreated = false;
    let mongoCreated = false;
    let qualificationFailure;
    let qualificationFailed = false;
    let cleanupFailures = [];
    const queuesCreated = new Set();
    try {
      await admin.query(
        `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
      );
      sqlCreated = true;
      const configuration = {
        type: 'mysql',
        host: sql.host,
        port: sql.port,
        username: sql.user,
        password: sql.password,
        database,
        synchronize: false,
        migrations: [
          EditorialOwnership1791676802000,
          EditorialBackfill1791676803000,
          IdentityWriteBarrier1791840000000,
          AccountErasureRequests1791840001000,
        ],
        migrationsRun: true,
        migrationsTransactionMode: 'none',
      };
      source = await new DataSource(configuration).initialize();
      const mongoUser = process.env.EDITORIAL_TEST_MONGO_USERNAME ?? 'wapps';
      const mongoPassword =
        process.env.EDITORIAL_TEST_MONGO_PASSWORD ?? localPassword;
      mongo = new MongoClient(
        `mongodb://${encodeURIComponent(mongoUser)}:${encodeURIComponent(
          mongoPassword
        )}@127.0.0.1:${Number(
          process.env.EDITORIAL_TEST_MONGO_PORT ?? 27017
        )}/?authSource=admin`,
        { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000 }
      );
      await mongo.connect();
      const collection = mongo
        .db(database)
        .collection('editorial_projections_v1');
      assert.equal(await collection.countDocuments(), 0);
      const projections = new MongoEditorialProjections(collection);
      mongoCreated = true;
      await projections.ensureIndexes();
      const brokerConfig = {
        host: '127.0.0.1',
        port: process.env.EDITORIAL_TEST_QUEUE_PORT ?? '5672',
        username: process.env.EDITORIAL_TEST_QUEUE_USERNAME ?? 'wapps',
        password: process.env.EDITORIAL_TEST_QUEUE_PASSWORD ?? localPassword,
        connectionTimeoutMs: 3000,
      };
      const transport = await broker.connect(brokerConfig);
      const queue = {
        ...transport,
        assertQueue: async (name, options) => {
          queuesCreated.add(queueNames[name]);
          return transport.assertQueue(queueNames[name], options);
        },
        publishConfirmed: (name, body, options) =>
          transport.publishConfirmed(queueNames[name], body, options),
      };
      brokerControl = await amqp.connect(
        `amqp://${encodeURIComponent(
          brokerConfig.username
        )}:${encodeURIComponent(brokerConfig.password)}@127.0.0.1:${
          brokerConfig.port
        }/`,
        { timeout: 3000 }
      );
      brokerControl.on('error', () => undefined);
      await ensureEditorialProjectionQueues(queue);
      channel = await brokerControl.createChannel();
      const reader = new MysqlEditorialSnapshotReader(source, 'default');
      const recovery = new MysqlEditorialProjectionRecovery(source);
      const outbox = new MysqlEditorialOutbox(source);
      const commands = new EditorialCommands(
        new MysqlEditorialWrites(source, 'default'),
        { evaluate: async () => ({ ok: true, value: true }) },
        { generate: uuidv7 }
      );
      const actor = {
        identityId: 'owner',
        tenantId: 'default',
        roles: ['editorial:publisher', 'editorial:taxonomy'],
      };
      const category = await commands.create(
        'category',
        { name: 'Category', slug: 'category' },
        actor,
        'category'
      );
      const tag = await commands.create(
        'tag',
        { name: 'Tag', slug: 'tag' },
        actor,
        'tag'
      );
      const app = await commands.create(
        'app',
        {
          name: 'Application',
          slug: 'application',
          categoryId: category.id,
          tagIds: [tag.id],
        },
        actor,
        'app'
      );
      let clock = Date.now() + 1_000_000;
      const events = [];
      const publisher = {
        publish: async (event) => {
          events.push(event);
          await queue.publishConfirmed(
            EDITORIAL_PROJECTION_QUEUE,
            Buffer.from(JSON.stringify(event))
          );
        },
      };
      const dispatcher = new DispatchEditorialOutbox(
        outbox,
        publisher,
        randomUUID,
        () => clock
      );
      async function dispatchAll() {
        for (let i = 0; i < 100; i++) {
          const result = await dispatcher.once();
          if (result === 'idle') return;
          assert.equal(result, 'delivered');
        }
        assert.fail('Unexpected outbox drain size');
      }
      async function receive(name = EDITORIAL_PROJECTION_QUEUE) {
        const receivingChannel = channel;
        const received = await receivingChannel.get(queueNames[name], {
          noAck: false,
        });
        if (!received) return null;
        return {
          content: received.content,
          headers: received.properties.headers,
          ack: () => receivingChannel.ack(received),
          nack: (requeue = false) =>
            receivingChannel.nack(received, false, requeue),
        };
      }
      async function materializeAll() {
        for (let i = 0; i < 100; i++) {
          const received = await receive();
          if (!received) return;
          assert.equal(
            await consumeEditorialProjection(
              received,
              queue,
              reader,
              projections,
              { wait: async () => undefined }
            ),
            'materialized'
          );
        }
        assert.fail('Unexpected queue drain size');
      }
      await dispatchAll();
      await materializeAll();
      assert.equal(await collection.countDocuments(), 3);
      assert.equal(
        (await projections.find('app', app.id)).content.categoryId,
        category.id
      );
      assert.equal(
        (await reconcileEditorialProjections(recovery, reader, projections))
          .current,
        3
      );

      await commands.update(
        'app',
        app.id,
        { name: 'Updated', expectedRevision: 1 },
        actor,
        'update'
      );
      const markingFailure = new DispatchEditorialOutbox(
        {
          claim: outbox.claim.bind(outbox),
          failed: outbox.failed.bind(outbox),
          delivered: async () => {
            throw new Error('Injected crash window after confirmation');
          },
        },
        publisher,
        randomUUID,
        () => clock
      );
      assert.equal(await markingFailure.once(), 'retry');
      await materializeAll();
      clock += 5000;
      await dispatchAll();
      await materializeAll();
      assert.equal((await projections.find('app', app.id)).revision, 2);
      assert.equal(await collection.countDocuments({ kind: 'app' }), 1);
      const oldProjection = projectEditorialSnapshot(
        await reader.read('app', app.id)
      );
      await commands.remove(
        'app',
        app.id,
        { expectedRevision: 2 },
        actor,
        'delete'
      );
      await dispatchAll();
      await queue.publishConfirmed(
        EDITORIAL_PROJECTION_QUEUE,
        Buffer.from(
          JSON.stringify(
            events.find((event) => event.payload.resourceId === app.id)
          )
        )
      );
      await materializeAll();
      assert.equal(await projections.publish(oldProjection), 'superseded');
      assert.equal((await projections.find('app', app.id)).content, null);

      const legacyId = uuidv7();
      await source.query('INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)', [
        legacyId,
        'Verified legacy tag',
        'verified-legacy',
      ]);
      const backfill = new EditorialLegacyBackfill(
        new MysqlEditorialBackfill(source, 'default')
      );
      const mapping = {
        version: 1,
        kind: 'tag',
        resourceId: legacyId,
        tenantId: 'default',
        ownerIdentityId: actor.identityId,
      };
      const plan = await backfill.plan(mapping);
      await backfill.apply(mapping, plan.fingerprint, true);
      await dispatchAll();
      await materializeAll();
      assert.equal(
        (await projections.find('tag', legacyId)).content.name,
        'Verified legacy tag'
      );

      const before = await collection.find({}).sort({ _id: 1 }).toArray();
      await collection.drop();
      await projections.ensureIndexes();
      await source.query('DELETE FROM editorial_outbox');
      assert.equal((await rebuildEditorialProjections(recovery)).queued, 4);
      await dispatchAll();
      await materializeAll();
      assert.deepEqual(
        await collection.find({}).sort({ _id: 1 }).toArray(),
        before
      );
      await collection.updateOne(
        { _id: `tag:${tag.id}` },
        { $set: { 'content.name': 'Corrupted' } }
      );
      assert.equal(
        (
          await reconcileEditorialProjections(recovery, reader, projections, {
            apply: true,
          })
        ).conflicts,
        1
      );
      await collection.deleteOne({ _id: `tag:${tag.id}` });
      assert.equal(
        (
          await reconcileEditorialProjections(recovery, reader, projections, {
            apply: true,
          })
        ).queued,
        1
      );
      await dispatchAll();
      await materializeAll();

      await queue.publishConfirmed(
        EDITORIAL_PROJECTION_QUEUE,
        Buffer.from('{malformed')
      );
      const poison = await receive();
      assert.ok(poison);
      await assert.rejects(
        consumeEditorialProjection(
          poison,
          {
            ...queue,
            publishConfirmed: async () => {
              throw new Error('Injected unknown transfer result');
            },
          },
          reader,
          projections
        ),
        /unknown transfer/
      );
      await channel.close();
      channel = await brokerControl.createChannel();
      const redelivered = await receive();
      assert.ok(redelivered);
      assert.equal(
        await consumeEditorialProjection(
          redelivered,
          queue,
          reader,
          projections
        ),
        'dead-lettered'
      );
      const retained = await receive(EDITORIAL_PROJECTION_FAILED_QUEUE);
      assert.ok(retained);
      assert.equal(retained.content.toString(), '{malformed');
      retained.ack();
      await source.destroy();
      source = await new DataSource(configuration).initialize();
      assert.equal(
        (
          await new MysqlEditorialSnapshotReader(source, 'default').read(
            'app',
            app.id
          )
        ).deletedAt !== null,
        true
      );
      assert.deepEqual(
        await collection.find({}).sort({ _id: 1 }).toArray(),
        before
      );
    } catch (error) {
      qualificationFailure = error;
      qualificationFailed = true;
    } finally {
      // Failure cleaning one store must not leave the other isolated resources behind.
      const cleanup = await Promise.allSettled([
        broker.close(),
        (async () => {
          if (!brokerControl) return;
          try {
            const removing = await brokerControl.createChannel();
            for (const name of queuesCreated) await removing.deleteQueue(name);
            await removing.close();
          } finally {
            await brokerControl.close();
          }
        })(),
        (async () => {
          try {
            if (mongoCreated) await mongo.db(database).dropDatabase();
          } finally {
            await mongo?.close();
          }
        })(),
        (async () => {
          try {
            try {
              if (source?.isInitialized) await source.destroy();
            } finally {
              if (sqlCreated)
                await admin.query(`DROP DATABASE \`${database}\``);
            }
          } finally {
            await admin.end();
          }
        })(),
      ]);
      cleanupFailures = cleanup.flatMap((result) =>
        result.status === 'rejected' ? [result.reason] : []
      );
    }
    if (cleanupFailures.length)
      throw new AggregateError(
        [
          ...(qualificationFailed ? [qualificationFailure] : []),
          ...cleanupFailures,
        ],
        'Editorial qualification resource cleanup failed'
      );
    if (qualificationFailed) throw qualificationFailure;
  }
);
