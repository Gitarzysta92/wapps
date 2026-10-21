const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const {
  IdentityWriteBarrier1791840000000,
  beginIdentityErasure,
  lockIdentityWrites,
} = require('../../libs/adapters/account-mysql/src');
const {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
} = require('../../sdk/features/identity/core/src');

// Called only with the owning runner's disposable, randomly named qualification database.
module.exports = async function qualifyIdentityWriteBarriers(source) {
  const migration = new IdentityWriteBarrier1791840000000();
  const schema = source.createQueryRunner();
  await schema.connect();
  try {
    await migration.up(schema);
    await migration.up(schema);
    await schema.query(
      'CREATE TABLE erasure_probe (owner varchar(128) COLLATE utf8mb4_bin PRIMARY KEY, value int NOT NULL) ENGINE=InnoDB'
    );
    const runners = [];
    async function transaction() {
      const runner = source.createQueryRunner();
      await runner.connect();
      await runner.startTransaction('READ COMMITTED');
      runners.push(runner);
      return runner;
    }
    async function waitForLock(id) {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const waits = await source.query(
          `SELECT w.REQUESTING_ENGINE_TRANSACTION_ID
          FROM performance_schema.data_lock_waits w JOIN performance_schema.threads t
          ON t.THREAD_ID=w.REQUESTING_THREAD_ID WHERE t.PROCESSLIST_ID=?`,
          [id]
        );
        if (waits.length) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.fail('Expected a real InnoDB lock wait');
    }
    // Obtain the connection ID before starting a query that will block the same connection.
    async function connection(runner) {
      const [{ id }] = await runner.query('SELECT CONNECTION_ID() AS id');
      return id;
    }
    try {
      const first = await transaction(),
        deletion = await transaction();
      const deletionConnection = await connection(deletion);
      await lockIdentityWrites(first.manager, ['writer-first']);
      await first.query("INSERT INTO erasure_probe VALUES ('writer-first', 1)");
      const removing = beginIdentityErasure(
        deletion.manager,
        'writer-first',
        7,
        100
      ).then(async () => {
        await deletion.query(
          "DELETE FROM erasure_probe WHERE owner='writer-first'"
        );
      });
      await waitForLock(deletionConnection);
      await first.commitTransaction();
      await removing;
      await deletion.commitTransaction();
      assert.deepEqual(
        await source.query(
          "SELECT * FROM erasure_probe WHERE owner='writer-first'"
        ),
        []
      );
      await assert.rejects(
        source.transaction('READ COMMITTED', (manager) =>
          lockIdentityWrites(manager, ['writer-first'])
        ),
        CanonicalIdentityAccessDenied
      );

      const erasing = await transaction(),
        late = await transaction();
      const lateConnection = await connection(late);
      await beginIdentityErasure(erasing.manager, 'erasure-first', 3, 101);
      const writing = assert.rejects(
        lockIdentityWrites(late.manager, ['erasure-first']),
        CanonicalIdentityAccessDenied
      );
      await waitForLock(lateConnection);
      await erasing.commitTransaction();
      await writing;
      await late.rollbackTransaction();

      const failed = await transaction(),
        retry = await transaction();
      const retryConnection = await connection(retry);
      await beginIdentityErasure(failed.manager, 'rollback', 2, 102);
      const retrying = lockIdentityWrites(retry.manager, ['rollback']);
      await waitForLock(retryConnection);
      await failed.rollbackTransaction();
      await retrying;
      await retry.commitTransaction();

      await Promise.all([
        source.transaction('READ COMMITTED', (manager) =>
          lockIdentityWrites(manager, ['owner-z', 'owner-a'])
        ),
        source.transaction('READ COMMITTED', (manager) =>
          lockIdentityWrites(manager, ['owner-a', 'owner-z'])
        ),
      ]);
      const replay = await source.transaction('READ COMMITTED', (manager) =>
        beginIdentityErasure(manager, 'writer-first', 7, 900)
      );
      assert.equal(replay.requestedAt, 100);
      await assert.rejects(
        source.transaction('READ COMMITTED', (manager) =>
          beginIdentityErasure(manager, 'writer-first', 8, 900)
        ),
        CanonicalIdentityConflict
      );
      await source.transaction('READ COMMITTED', (manager) =>
        lockIdentityWrites(manager, ['Writer-first'])
      );
      await assert.rejects(
        lockIdentityWrites(source.manager, ['autocommit']),
        /active transaction/
      );

      await qualifyOwningServiceWrites(source);

      const reconnected = await new DataSource({
        ...source.options,
        migrations: [],
        entities: [],
      }).initialize();
      try {
        await assert.rejects(
          reconnected.transaction('READ COMMITTED', (manager) =>
            lockIdentityWrites(manager, ['writer-first'])
          ),
          CanonicalIdentityAccessDenied
        );
      } finally {
        await reconnected.destroy();
      }
      await migration.up(schema);
      await schema.query(
        "INSERT INTO identity_erasure_barriers VALUES ('malformed', NULL, 2)"
      );
      await assert.rejects(migration.up(schema), /Incomplete canonical/);
      await schema.query(
        "DELETE FROM identity_erasure_barriers WHERE identityId='malformed'"
      );
      await schema.query(
        'ALTER TABLE identity_erasure_barriers ADD UNIQUE KEY incompatible (erasureRevision)'
      );
      await assert.rejects(
        migration.up(schema),
        /Incompatible identity write barrier schema/
      );
      await schema.query(
        'ALTER TABLE identity_erasure_barriers DROP INDEX incompatible'
      );
      await schema.query(
        'CREATE TRIGGER erasure_probe_trigger BEFORE INSERT ON identity_erasure_barriers FOR EACH ROW SET NEW.requestedAt = NEW.requestedAt'
      );
      await assert.rejects(
        migration.up(schema),
        /Incompatible identity write barrier schema/
      );
      await schema.query('DROP TRIGGER erasure_probe_trigger');
      await migration.up(schema);
      const history = source.options.migrationsTableName ?? 'migrations';
      const escapedHistory = source.driver.escape(history);
      await schema.query(
        `INSERT INTO ${escapedHistory} (timestamp, name) VALUES (?, ?)`,
        [1791840000000, 'IdentityWriteBarrier1791840000000']
      );
      await schema.query(
        'RENAME TABLE identity_erasure_barriers TO retained_erasure_barriers'
      );
      await assert.rejects(
        migration.up(schema),
        /Applied identity write barrier table is missing/
      );
      assert.equal(await schema.hasTable('identity_erasure_barriers'), false);
      await schema.query(
        'RENAME TABLE retained_erasure_barriers TO identity_erasure_barriers'
      );
      await schema.query(`DELETE FROM ${escapedHistory} WHERE name = ?`, [
        'IdentityWriteBarrier1791840000000',
      ]);
      await migration.up(schema);
      await assert.rejects(migration.down(), /data-preserving rollback/);
      console.log(
        'Identity write barriers: real lock ordering, both race directions, rollback, replay, case isolation, reconnect and migration re-entry passed.'
      );
    } finally {
      for (const runner of runners) {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
    }
  } finally {
    await schema.release();
  }
};

async function qualifyOwningServiceWrites(source) {
  const { randomUUID } = require('node:crypto');
  const editorial = '../../apps/services/editorial/src/app/';
  const discussion = '../../apps/services/community/src/app/';
  const actor = {
    identityId: 'erased-service-actor',
    tenantId: 'default',
    roles: [],
  };
  await source.transaction('READ COMMITTED', (manager) =>
    beginIdentityErasure(manager, actor.identityId, 2, Date.now())
  );
  const command = {
    actor,
    type: 'create',
    action: 'submit',
    id: randomUUID(),
    key: randomUUID(),
    fingerprint: 'a'.repeat(64),
    fields: {},
    input: {},
    at: Date.now(),
  };
  // These are prepared adapter commands. No domain tables exist in this database:
  // a write or receipt lookup reaching one before the barrier fails this check.
  const { MysqlEditorialWrites } = require(editorial +
    'infrastructure/mysql-editorial-writes');
  const generic = new MysqlEditorialWrites(source, 'default');
  const checks = [
    ['editorial-receipt', () => generic.receipt(command)],
    [
      'editorial-commit',
      () => generic.commit({ ...command, kind: 'app', command }),
    ],
  ];
  for (const [path, name, methods] of [
    [
      'application-drafts/mysql-application-drafts',
      'MysqlApplicationDrafts',
      ['commit'],
    ],
    ['suites/mysql-suite-workspace', 'MysqlSuiteWorkspace', ['commit']],
    [
      'articles/mysql-article-workspace',
      'MysqlArticleWorkspace',
      ['changeDraft'],
    ],
    [
      'releases/mysql-release-workspace',
      'MysqlReleaseWorkspace',
      ['changeDraft'],
    ],
    [
      'application-ownership/mysql-application-ownership',
      'MysqlApplicationOwnership',
      ['create'],
    ],
    [
      'application-media/mysql-application-images',
      'MysqlApplicationImages',
      ['create', 'reserve', 'complete', 'fail', 'cancel'],
    ],
    [
      'article-covers/mysql-article-covers',
      'MysqlArticleCovers',
      ['create', 'reserve', 'complete', 'fail', 'cancel'],
    ],
  ]) {
    const store = new (require(editorial + path)[name])(source);
    for (const method of methods)
      checks.push([name + '.' + method, () => store[method](command)]);
  }
  const { MysqlDiscussionWrites } = require(discussion +
    'discussions/infrastructure/mysql-discussion-writes');
  const discussions = new MysqlDiscussionWrites(source);
  checks.push(['discussion-receipt', () => discussions.receipt(command)]);
  checks.push([
    'discussion-commit',
    () => discussions.commit({ type: 'create', command }),
  ]);
  const { MysqlReviews } = require(discussion +
    'reviews/infrastructure/mysql-reviews');
  checks.push([
    'review-transaction',
    () =>
      new MysqlReviews(source).transaction(
        { tenantId: 'default', applicationId: command.id },
        actor.identityId,
        () => assert.fail('Erased actor entered a review transaction')
      ),
  ]);
  for (const [name, write] of checks)
    await assert.rejects(write, CanonicalIdentityAccessDenied, name);
  console.log(
    `Owning-service write barriers: ${checks.length} prepared mutations/receipt paths reject erased actors before resource I/O.`
  );
}
