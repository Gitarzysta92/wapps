/* SQL qualification uses a new disposable database on localhost only. */
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
const { DataSource } = require('typeorm');
const {
  EDITORIAL_MIGRATIONS,
} = require('../../apps/services/editorial/src/app/editorial-migrations');
const {
  ContentClassification1791886000000,
} = require('../../apps/services/editorial/src/app/content-classification/content-classification.migration');
const {
  CLASSIFICATION_TABLES,
} = require('../../apps/services/editorial/src/app/content-classification/content-classification-schema');
const { createConnection } = require('mysql2/promise');
const { v7: uuidv7 } = require('uuid');
const service = path.join(root, 'apps/services/editorial/src/app');
const { EditorialCommands } = require(path.join(
  service,
  'application/editorial-commands'
));
const { MysqlEditorialWrites } = require(path.join(
  service,
  'infrastructure/mysql-editorial-writes'
));
const { MysqlEditorialReads } = require(path.join(
  service,
  'infrastructure/mysql-editorial-reads'
));
const { MysqlEditorialOutbox } = require(path.join(
  service,
  'infrastructure/mysql-editorial-outbox'
));
const { EditorialOwnership1791676802000 } = require(path.join(
  service,
  'infrastructure/editorial-schema.migration'
));
const { EditorialBackfill1791676803000 } = require(path.join(
  service,
  'infrastructure/editorial-backfill.migration'
));
const { MysqlEditorialBackfill } = require(path.join(
  service,
  'infrastructure/mysql-editorial-backfill'
));
const { EditorialLegacyBackfill } = require(path.join(
  service,
  'application/editorial-backfill'
));
const { AppRecord } = require(path.join(
  service,
  'apps/entities/app-record.entity'
));
const { Category } = require(path.join(
  service,
  'categories/entities/category.entity'
));
const { Tag } = require(path.join(service, 'tags/entities/tag.entity'));
const referenceEntities = require(path.join(service, 'reference/entities'));

test(
  'Editorial SQL migration, authority, concurrency, tombstones and restart qualification',
  { timeout: 60_000 },
  async () => {
    assert.equal(
      process.env.WAPPS_EDITORIAL_INTEGRATION,
      '1',
      'Set WAPPS_EDITORIAL_INTEGRATION=1 with local MySQL running; unavailable checks are not passes.'
    );
    const database = `editorial_qualification_${randomUUID().replaceAll(
      '-',
      ''
    )}`;
    const options = {
      host: '127.0.0.1',
      port: Number(process.env.EDITORIAL_TEST_MYSQL_PORT ?? 3306),
      user: process.env.EDITORIAL_TEST_MYSQL_USERNAME ?? 'wapps',
      password:
        process.env.EDITORIAL_TEST_MYSQL_PASSWORD ??
        process.env.LOCAL_PASSWORD ??
        'wapps-local-password',
      connectTimeout: 3000,
    };
    const connection = await createConnection(options);
    let source;
    let created = false;
    try {
      await connection.query(`CREATE DATABASE \`${database}\``);
      created = true;
      const configuration = {
        type: 'mysql',
        host: options.host,
        port: options.port,
        username: options.user,
        password: options.password,
        database,
        entities: [
          AppRecord,
          Category,
          Tag,
          ...Object.values(referenceEntities),
        ],
        synchronize: false,
        migrations: EDITORIAL_MIGRATIONS,
        migrationsTableName: 'editorial_migrations',
        migrationsRun: true,
        migrationsTransactionMode: 'none',
      };
      source = await new DataSource({
        ...configuration,
        migrations: EDITORIAL_MIGRATIONS.slice(0, -1),
      }).initialize();
      const legacyApp = uuidv7();
      await source.query(
        'INSERT INTO app_records (id, name, slug) VALUES (?, ?, ?)',
        [legacyApp, 'Pre-classification legacy app', 'pre-classification']
      );
      // Simulate interrupted additive DDL and reject an incompatible later column
      // before adding any of the remaining columns.
      await source.query(
        'ALTER TABLE app_records ADD classification varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
      );
      await source.query(
        'ALTER TABLE suite_publications ADD classification varchar(8) NULL'
      );
      let runner = source.createQueryRunner();
      try {
        await assert.rejects(
          new ContentClassification1791886000000().up(runner),
          /Incompatible classification/
        );
        assert.equal(
          (await runner.getTable('application_drafts')).findColumnByName(
            'classification'
          ),
          undefined
        );
      } finally {
        await runner.release();
      }
      await source.query(
        'ALTER TABLE suite_publications DROP COLUMN classification'
      );
      await source.destroy();
      source = await new DataSource(configuration).initialize();
      assert.deepEqual(
        await source.runMigrations(),
        [],
        'Re-entry must not replay recorded migrations'
      );
      assert.equal(
        (
          await source.query(
            'SELECT classification FROM app_records WHERE id=?',
            [legacyApp]
          )
        )[0].classification,
        null
      );
      assert.equal(
        (await source.query('SELECT name FROM editorial_migrations')).length,
        EDITORIAL_MIGRATIONS.length
      );
      runner = source.createQueryRunner();
      try {
        await new ContentClassification1791886000000().up(runner);
        await assert.rejects(
          new ContentClassification1791886000000().down(),
          /retain the additive schema/
        );
        await source.query(
          'ALTER TABLE suite_publications DROP COLUMN classification'
        );
        await assert.rejects(
          new ContentClassification1791886000000().up(runner),
          /Applied classification column is missing/
        );
        await source.query(
          'ALTER TABLE suite_publications ADD classification varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
        );
        await source.query(
          "UPDATE app_records SET classification='invalid' WHERE id=?",
          [legacyApp]
        );
        await assert.rejects(
          new ContentClassification1791886000000().up(runner),
          /Invalid stored content classification/
        );
        await source.query(
          'UPDATE app_records SET classification=NULL WHERE id=?',
          [legacyApp]
        );
        await new ContentClassification1791886000000().up(runner);
        for (const table of CLASSIFICATION_TABLES)
          assert.equal(
            (await runner.getTable(table)).findColumnByName('classification')
              .length,
            '7'
          );
      } finally {
        await runner.release();
      }
      console.log(
        'PASS current Editorial migration roster: pre-classification upgrade, partial DDL, exact re-entry, incompatible/missing/invalid classification rejection and non-destructive rollback'
      );
      const preflight = source.createQueryRunner();
      try {
        await new EditorialOwnership1791676802000().up(preflight);
        await new EditorialBackfill1791676803000().up(preflight);
      } finally {
        await preflight.release();
      }
      const writes = new MysqlEditorialWrites(source, 'default');
      const reads = new MysqlEditorialReads(source, 'default');
      const actor = {
        identityId: 'owner',
        tenantId: 'default',
        roles: ['editorial:publisher', 'editorial:taxonomy'],
      };
      const commands = new EditorialCommands(
        writes,
        { evaluate: async () => ({ ok: true, value: true }) },
        { generate: uuidv7 }
      );
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
      const input = {
        name: 'App',
        slug: 'app',
        categoryId: category.id,
        tagIds: [tag.id],
      };
      const [first, repeated] = await Promise.all([
        commands.create('app', input, actor, 'create-app'),
        commands.create('app', input, actor, 'create-app'),
      ]);
      assert.deepEqual(repeated, first);
      assert.equal(first.revision, 1);
      let view = await reads.find('app', first.id, 'default');
      assert.equal(view.revision, 1);
      assert.equal(view.category.id, category.id);
      assert.deepEqual(
        view.tags.map((item) => item.id),
        [tag.id]
      );
      assert.equal(await reads.find('app', first.id, 'another-tenant'), null);
      await assert.rejects(
        commands.update(
          'app',
          first.id,
          { name: 'Spoofed', expectedRevision: 1 },
          { ...actor, identityId: 'other' },
          'other-owner'
        )
      );
      await assert.rejects(
        commands.update(
          'app',
          first.id,
          { name: 'Spoofed', expectedRevision: 1 },
          { ...actor, tenantId: 'other', roles: ['admin'] },
          'other-tenant'
        )
      );

      const sameEdit = await Promise.all([
        commands.update(
          'app',
          first.id,
          { name: 'Edited', expectedRevision: 1 },
          actor,
          'same-edit'
        ),
        commands.update(
          'app',
          first.id,
          { name: 'Edited', expectedRevision: 1 },
          actor,
          'same-edit'
        ),
      ]);
      assert.deepEqual(sameEdit[0], sameEdit[1]);
      assert.equal(sameEdit[0].revision, 2);
      const contenders = await Promise.allSettled([
        commands.update(
          'app',
          first.id,
          { name: 'Contender A', expectedRevision: 2 },
          actor,
          'contender-a'
        ),
        commands.update(
          'app',
          first.id,
          { name: 'Contender B', expectedRevision: 2 },
          actor,
          'contender-b'
        ),
      ]);
      assert.equal(
        contenders.filter((result) => result.status === 'fulfilled').length,
        1
      );
      assert.equal(
        contenders.filter((result) => result.status === 'rejected').length,
        1
      );
      view = await reads.find('app', first.id, 'default');
      assert.equal(view.revision, 3);
      await assert.rejects(
        commands.remove(
          'category',
          category.id,
          { expectedRevision: 1 },
          actor,
          'referenced-category'
        )
      );
      await assert.rejects(
        commands.remove(
          'tag',
          tag.id,
          { expectedRevision: 1 },
          actor,
          'referenced-tag'
        )
      );

      await source.query(
        `CREATE TRIGGER fail_editorial_outbox BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification rollback'`
      );
      try {
        await assert.rejects(
          commands.create(
            'app',
            { name: 'Rollback', slug: 'rollback' },
            actor,
            'rollback'
          )
        );
        assert.equal(
          (
            await source.query(
              `SELECT id FROM app_records WHERE slug = 'rollback'`
            )
          ).length,
          0
        );
        assert.equal(
          (
            await source.query(
              `SELECT commandKey FROM editorial_commands WHERE commandKey = 'rollback'`
            )
          ).length,
          0
        );
      } finally {
        await source.query('DROP TRIGGER fail_editorial_outbox');
      }
      const tombstone = await commands.remove(
        'app',
        first.id,
        { expectedRevision: 3 },
        actor,
        'delete-app'
      );
      assert.equal(tombstone.revision, 4);
      assert.equal(await reads.find('app', first.id, 'default'), null);
      assert.deepEqual(
        await commands.remove(
          'app',
          first.id,
          { expectedRevision: 3 },
          actor,
          'delete-app'
        ),
        tombstone
      );
      assert.equal(
        (
          await source.query('SELECT id FROM app_records WHERE id = ?', [
            first.id,
          ])
        ).length,
        1
      );
      const events = await source.query(
        'SELECT revision, operation FROM editorial_outbox WHERE resourceId = ? ORDER BY revision',
        [first.id]
      );
      assert.deepEqual(
        events.map((event) => [Number(event.revision), event.operation]),
        [
          [1, 'create'],
          [2, 'update'],
          [3, 'update'],
          [4, 'delete'],
        ]
      );

      const child = await commands.create(
        'category',
        { name: 'Child', slug: 'child', parentId: category.id },
        actor,
        'child'
      );
      await assert.rejects(
        commands.update(
          'category',
          category.id,
          { parentId: child.id, expectedRevision: 1 },
          actor,
          'cycle'
        )
      );
      await commands.remove(
        'category',
        child.id,
        { expectedRevision: 1 },
        actor,
        'delete-child'
      );
      assert.deepEqual(
        (await reads.find('category', category.id, 'default')).children,
        []
      );
      const legacy = uuidv7();
      await source.query('INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)', [
        legacy,
        'Legacy',
        'legacy',
      ]);
      assert.equal((await reads.find('tag', legacy, 'default')).revision, null);
      await assert.rejects(
        commands.update(
          'tag',
          legacy,
          { name: 'Taken', expectedRevision: 1 },
          { ...actor, roles: ['admin'] },
          'take-legacy'
        )
      );
      assert.equal(await reads.find('tag', legacy, 'private'), null);

      const backfillSource = new MysqlEditorialBackfill(source, 'default');
      const backfill = new EditorialLegacyBackfill(backfillSource);
      const mapping = {
        version: 1,
        kind: 'tag',
        resourceId: legacy,
        tenantId: 'default',
        ownerIdentityId: actor.identityId,
      };
      const originalPlan = await backfill.plan(mapping);
      await source.query('UPDATE tags SET name = ? WHERE id = ?', [
        'Reviewed legacy',
        legacy,
      ]);
      await assert.rejects(
        backfill.apply(mapping, originalPlan.fingerprint, true),
        /source changed/
      );
      const plan = await backfill.plan(mapping);
      const originalValues = await source.query(
        'SELECT * FROM tags WHERE id = ?',
        [legacy]
      );
      await source.query(
        `CREATE TRIGGER fail_editorial_backfill BEFORE INSERT ON editorial_backfills FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification backfill rollback'`
      );
      try {
        await assert.rejects(
          backfill.apply(mapping, plan.fingerprint, true),
          /qualification backfill rollback/
        );
        assert.equal(
          (
            await source.query(
              'SELECT * FROM editorial_resource_states WHERE resourceId = ?',
              [legacy]
            )
          ).length,
          0
        );
        assert.equal(
          (
            await source.query(
              'SELECT * FROM editorial_outbox WHERE resourceId = ?',
              [legacy]
            )
          ).length,
          0
        );
      } finally {
        await source.query('DROP TRIGGER fail_editorial_backfill');
      }
      const [adopted, duplicate] = await Promise.all([
        backfillSource.commit(plan),
        backfillSource.commit(plan),
      ]);
      assert.deepEqual(adopted, duplicate);
      assert.deepEqual(
        await source.query('SELECT * FROM tags WHERE id = ?', [legacy]),
        originalValues
      );
      assert.equal(
        (
          await source.query(
            'SELECT * FROM editorial_outbox WHERE resourceId = ?',
            [legacy]
          )
        ).length,
        1
      );
      assert.equal((await reads.find('tag', legacy, 'default')).revision, 1);
      await assert.rejects(
        backfill.apply(
          { ...mapping, ownerIdentityId: 'other-owner' },
          plan.fingerprint,
          true
        )
      );
      await commands.update(
        'tag',
        legacy,
        { name: 'Owned legacy', expectedRevision: 1 },
        actor,
        'update-legacy'
      );
      assert.deepEqual(
        await backfill.apply(mapping, plan.fingerprint, true),
        adopted
      );
      assert.equal((await writes.resource('tag', legacy)).revision, 2);

      const outbox = new MysqlEditorialOutbox(source);
      const now = Date.now();
      const leaseA = randomUUID();
      const leaseB = randomUUID();
      const pending = () =>
        source.query(
          'SELECT id, leaseToken, leasedUntil FROM editorial_outbox WHERE deliveredAt IS NULL AND failedAt IS NULL ORDER BY id'
        );
      const beforeContention = await pending();
      assert.ok(beforeContention.length >= 2);
      const blocker = source.createQueryRunner();
      try {
        await blocker.connect();
        await blocker.startTransaction('READ COMMITTED');
        await blocker.query(
          'SELECT id FROM editorial_outbox WHERE deliveredAt IS NULL AND failedAt IS NULL FOR UPDATE'
        );
        assert.deepEqual(
          await Promise.all([
            outbox.claim(now, leaseA),
            outbox.claim(now, leaseB),
          ]),
          [null, null],
          'Locked requests stay durable while concurrent pollers report idle'
        );
        assert.deepEqual(
          await pending(),
          beforeContention,
          'Idle claims cannot mutate or consume pending requests'
        );
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await blocker.release();
      }
      let [claimedA, claimedB] = await Promise.all([
        outbox.claim(now, leaseA),
        outbox.claim(now, leaseB),
      ]);
      assert.ok(
        claimedA || claimedB,
        'At least one poller progresses after lock release'
      );
      // SKIP LOCKED may skip rows scanned/locked by the other claim before its commit.
      // Retry an idle poll once after both transactions finish, preserving the live lease.
      if (!claimedA) claimedA = await outbox.claim(now, leaseA);
      if (!claimedB) claimedB = await outbox.claim(now, leaseB);
      assert.ok(claimedA && claimedB);
      assert.notEqual(claimedA.id, claimedB.id);
      assert.equal(await outbox.delivered(claimedA.id, leaseB, now), false);
      await outbox.failed(claimedA.id, leaseA, 12, now, now);
      const status = await outbox.status();
      assert.equal(Number(status.failed), 1);
      assert.equal(status.failedRequests[0].id, claimedA.id);
      assert.equal(await outbox.requeueFailed(claimedA.id, now), true);
      assert.equal(await outbox.requeueFailed(claimedA.id, now), false);
      assert.equal(await outbox.delivered(claimedB.id, leaseB, now), true);

      const beforeRestart = (
        await source.query('SELECT COUNT(*) AS count FROM editorial_commands')
      )[0].count;
      await source.destroy();
      source = await new DataSource(configuration).initialize();
      const restartedWrites = new MysqlEditorialWrites(source, 'default');
      assert.equal((await restartedWrites.resource('tag', legacy)).revision, 2);
      assert.deepEqual(
        await new EditorialLegacyBackfill(
          new MysqlEditorialBackfill(source, 'default')
        ).apply(mapping, plan.fingerprint, true),
        adopted
      );
      assert.equal(
        (await restartedWrites.resource('app', first.id)).revision,
        4
      );
      assert.equal(
        (
          await source.query('SELECT COUNT(*) AS count FROM editorial_commands')
        )[0].count,
        beforeRestart
      );
      assert.equal(
        (
          await source.query(
            'SELECT * FROM editorial_outbox WHERE deliveredAt IS NULL'
          )
        ).length > 0,
        true
      );
    } finally {
      if (source?.isInitialized) await source.destroy();
      if (created) await connection.query(`DROP DATABASE \`${database}\``);
      await connection.end();
    }
  }
);
