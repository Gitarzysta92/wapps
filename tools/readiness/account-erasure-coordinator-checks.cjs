const { RequestAccountErasure } = require('../../libs/usecases/account/src');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  MysqlCanonicalIdentities,
  MysqlIdentityDeletions,
  MysqlAccountErasureJobs,
  MysqlAccountErasureParticipant,
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
  AccountErasureCoordination1791840002000,
  lockIdentityWrites,
  runIdentityMaintenance,
} = require('../../libs/adapters/account-mysql/src');
const {
  CompleteIdentityDeletion,
  CompleteAccountErasure,
} = require('../../sdk/features/identity/libs/management/src');
const {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
} = require('../../sdk/features/identity/core/src');

async function qualifyPendingIndex(runner, migration, tableName, columns) {
  const originalGetTable = runner.getTable;
  runner.getTable = async function (name) {
    const table = await originalGetTable.call(this, name);
    if (name === tableName)
      for (const index of table.indices) index.columnNames.reverse();
    return table;
  };
  try {
    await migration.up(runner);
  } finally {
    runner.getTable = originalGetTable;
  }
  const [index] = await runner.query(
    'SELECT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? GROUP BY INDEX_NAME HAVING GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX)=?',
    [tableName, columns.join(',')]
  );
  assert.ok(index, 'The pending-work index must exist in the current schema');
  const escape = (value) => runner.connection.driver.escape(value);
  const table = escape(tableName),
    name = escape(index.name),
    fields = columns.map(escape).join(',');
  await runner.query(`ALTER TABLE ${table} DROP INDEX ${name}`);
  await assert.rejects(migration.up(runner), /Incompatible account erasure/);
  await runner.query(
    `ALTER TABLE ${table} ADD INDEX ${name} (${[...columns]
      .reverse()
      .map(escape)
      .join(',')})`
  );
  try {
    await assert.rejects(migration.up(runner), /Incompatible account erasure/);
  } finally {
    await runner.query(`ALTER TABLE ${table} DROP INDEX ${name}`);
    await runner.query(`ALTER TABLE ${table} ADD INDEX ${name} (${fields})`);
  }
  if (columns.includes('identityId')) {
    await runner.query(`ALTER TABLE ${table} DROP INDEX ${name}`);
    await runner.query(
      `ALTER TABLE ${table} ADD INDEX ${name} (${columns
        .map(
          (column) => escape(column) + (column === 'identityId' ? '(16)' : '')
        )
        .join(',')})`
    );
    try {
      await assert.rejects(
        migration.up(runner),
        /Incompatible account erasure/
      );
    } finally {
      await runner.query(`ALTER TABLE ${table} DROP INDEX ${name}`);
      await runner.query(`ALTER TABLE ${table} ADD INDEX ${name} (${fields})`);
    }
  }
  await migration.up(runner);
}

// Invoked only against the random, disposable database owned by qualify-identity-mysql.
module.exports = async function qualifyAccountErasureCoordinator(source) {
  const databases = [],
    participants = [],
    runner = source.createQueryRunner();
  const database = source.options.database;
  assert.match(database, /^identity_qualification_[0-9a-f]{32}$/);
  await runner.connect();
  try {
    for (const name of ['editorial', 'discussion']) {
      const db = `${name}_${randomUUID().replaceAll('-', '')}`;
      await source.query(
        `CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
      );
      databases.push(db);
      const participantSource = await new DataSource({
        ...source.options,
        database: db,
        entities: [],
        migrations: [
          IdentityWriteBarrier1791840000000,
          AccountErasureRequests1791840001000,
        ],
      }).initialize();
      participants.push(participantSource);
      await participantSource.runMigrations({ transaction: 'none' });
    }
    let at = Date.now();
    const identities = new MysqlCanonicalIdentities(source);
    await identities.ensure({
      uid: 'ErasureMember',
      provider: 'email',
      kind: 'user',
      activate: true,
    });
    const tombstone = await identities.requestDeletion('ErasureMember');
    const request = {
      identityId: 'ErasureMember',
      revision: tombstone.revision,
    };
    const credentialWorker = new CompleteIdentityDeletion(
      new MysqlIdentityDeletions(source),
      { remove: async () => undefined },
      randomUUID
    );
    assert.equal(await credentialWorker.once(), 'completed');
    assert.equal(
      (await identities.requestDeletion('ErasureMember')).cleanup,
      'pending'
    );

    // Simulate the older schema: preserve the credential receipt but remove the new journal.
    const migrationName = 'AccountErasureCoordination1791840002000';
    const [history] = await source.query(
      'SELECT * FROM migrations WHERE name = ?',
      [migrationName]
    );
    await source.query(
      'DELETE FROM identity_erasure_jobs WHERE identityId = ?',
      [request.identityId]
    );
    const migration = new AccountErasureCoordination1791840002000();
    await assert.rejects(migration.up(runner), /missing erasure coordination/);
    await source.query('DELETE FROM migrations WHERE name = ?', [
      migrationName,
    ]);
    await migration.up(runner);
    await migration.up(runner);
    await source.query(
      'INSERT INTO migrations (id, timestamp, name) VALUES (?, ?, ?)',
      [history.id, history.timestamp, history.name]
    );
    const [credentialReceipt] = await source.query(
      'SELECT * FROM identity_deletion_jobs WHERE identityId = ?',
      [request.identityId]
    );
    assert.ok(credentialReceipt.completedAt);
    const [backfill] = await source.query(
      'SELECT * FROM identity_erasure_jobs WHERE identityId = ?',
      [request.identityId]
    );
    assert.equal(backfill.completedAt, null);
    assert.equal(Number(backfill.revision), request.revision);
    console.log(
      'PASS: old credential-only completion receives separate pending erasure work without losing its receipt'
    );

    const local = new MysqlAccountErasureParticipant('account', source);
    await identities.ensure({
      uid: 'StillActive',
      provider: 'email',
      kind: 'user',
      activate: true,
    });
    await assert.rejects(
      local.request({ identityId: 'StillActive', revision: 1 }),
      CanonicalIdentityAccessDenied
    );
    assert.deepEqual(
      await source.query(
        'SELECT * FROM identity_erasure_barriers WHERE identityId = ?',
        ['StillActive']
      ),
      []
    );
    const editorial = new MysqlAccountErasureParticipant(
      'editorial',
      participants[0]
    );
    const discussion = new MysqlAccountErasureParticipant(
      'discussion',
      participants[1]
    );
    let unavailable = true;
    const coordinator = new RequestAccountErasure([
      local,
      editorial,
      {
        name: 'discussion',
        request: (input) =>
          unavailable
            ? Promise.reject(new Error('offline'))
            : discussion.request(input),
      },
    ]);
    const jobs = new MysqlAccountErasureJobs(source);
    at = Date.now();
    const worker = new CompleteAccountErasure(
      jobs,
      coordinator,
      randomUUID,
      () => at
    );
    assert.equal(await worker.once(), 'retry');
    for (const current of [source, participants[0]]) {
      const [pending] = await current.query(
        'SELECT * FROM identity_erasure_requests WHERE identityId = ?',
        [request.identityId]
      );
      assert.equal(pending.completedAt, null);
    }
    assert.deepEqual(
      await participants[1].query('SELECT * FROM identity_erasure_requests'),
      []
    );
    unavailable = false;
    at += 5000;
    assert.equal(await worker.once(), 'pending');
    const [deferred] = await source.query(
      'SELECT * FROM identity_erasure_jobs WHERE identityId = ?',
      [request.identityId]
    );
    assert.equal(deferred.attempts, 0);
    assert.equal(deferred.leaseToken, null);
    assert.equal(deferred.completedAt, null);
    assert.equal(Number(deferred.availableAt), at + 30000);
    for (const current of participants) {
      await assert.rejects(
        current.transaction('READ COMMITTED', (manager) =>
          lockIdentityWrites(manager, [request.identityId])
        ),
        CanonicalIdentityAccessDenied
      );
      await current.transaction('READ COMMITTED', (manager) =>
        lockIdentityWrites(manager, ['erasureMember'])
      );
    }
    await assert.rejects(
      editorial.request({ ...request, revision: request.revision + 1 }),
      CanonicalIdentityConflict
    );
    const [firstReceipt] = await participants[0].query(
      'SELECT * FROM identity_erasure_requests WHERE identityId = ?',
      [request.identityId]
    );
    await editorial.request(request);
    assert.deepEqual(
      (
        await participants[0].query(
          'SELECT * FROM identity_erasure_requests WHERE identityId = ?',
          [request.identityId]
        )
      )[0],
      firstReceipt
    );
    console.log(
      'PASS: independent service outage, retry, durable barriers, replay/conflict and normal pending deferral'
    );

    const failedSource = {
      transaction: (isolation, work) =>
        participants[0].transaction(isolation, async (manager) => {
          const query = manager.query.bind(manager);
          manager.query = (sql, parameters) => {
            if (sql.startsWith('INSERT INTO identity_erasure_requests'))
              throw new Error('request storage unavailable');
            return query(sql, parameters);
          };
          return work(manager);
        }),
    };
    await assert.rejects(
      new MysqlAccountErasureParticipant('editorial', failedSource).request({
        identityId: 'RollbackMember',
        revision: 2,
      }),
      /storage unavailable/
    );
    assert.deepEqual(
      await participants[0].query(
        'SELECT * FROM identity_erasure_barriers WHERE identityId = ?',
        ['RollbackMember']
      ),
      []
    );

    at += 31000;
    const token = randomUUID();
    assert.equal((await jobs.claim(at, token)).identityId, request.identityId);
    const replacement = randomUUID();
    assert.equal(
      (await jobs.claim(at + 31000, replacement)).identityId,
      request.identityId
    );
    assert.equal(
      await jobs.complete(request.identityId, token, at + 31001),
      false
    );
    assert.equal(
      await jobs.defer(request.identityId, token, at + 31001),
      false
    );
    await jobs.failed(request.identityId, token, 12, at + 31001, at + 31001);
    const [leased] = await source.query(
      'SELECT * FROM identity_erasure_jobs WHERE identityId = ?',
      [request.identityId]
    );
    assert.equal(leased.leaseToken, replacement);
    assert.equal(leased.failedAt, null);
    assert.equal(
      await jobs.defer(request.identityId, replacement, at + 31001),
      true
    );
    at += 32000;

    // Model future owning-service completion receipts; this does not qualify cleanup itself.
    for (const current of [source, participants[0]])
      await current.query(
        'UPDATE identity_erasure_requests SET completedAt = ? WHERE identityId = ?',
        [at, request.identityId]
      );
    assert.equal(await worker.once(), 'pending');
    assert.equal(
      (await identities.requestDeletion(request.identityId)).cleanup,
      'pending'
    );
    await participants[1].query(
      'UPDATE identity_erasure_requests SET completedAt = ? WHERE identityId = ?',
      [at, request.identityId]
    );
    at += 31000;
    const reopened = await new DataSource({
      ...source.options,
      migrations: [],
    }).initialize();
    try {
      assert.equal(
        await new CompleteAccountErasure(
          new MysqlAccountErasureJobs(reopened),
          coordinator,
          randomUUID,
          () => at
        ).once(),
        'completed'
      );
      assert.equal(
        (
          await new MysqlCanonicalIdentities(reopened).requestDeletion(
            request.identityId
          )
        ).cleanup,
        'completed'
      );
      assert.equal(await worker.once(), 'idle');
    } finally {
      await reopened.destroy();
    }
    console.log(
      'PASS: transaction rollback, expired lease fencing, reconnect and completion only after every durable receipt'
    );

    await identities.ensure({
      uid: 'QuarantineMember',
      provider: 'email',
      kind: 'user',
      activate: true,
    });
    await identities.requestDeletion('QuarantineMember');
    const failing = new CompleteAccountErasure(
      jobs,
      {
        request: async () => {
          throw new Error('offline');
        },
      },
      randomUUID,
      () => at
    );
    for (let attempt = 1; attempt <= 12; attempt++) {
      at += 400000;
      assert.equal(await failing.once(), attempt === 12 ? 'failed' : 'retry');
    }
    const maintenanceEnv = {
      MYSQL_HOST: source.options.host,
      MYSQL_PORT: String(source.options.port),
      MYSQL_USERNAME: source.options.username,
      MYSQL_PASSWORD: source.options.password,
      MYSQL_DATABASE: database,
    };
    let status;
    assert.equal(
      await runIdentityMaintenance(
        ['--erasure-status'],
        maintenanceEnv,
        (value) => {
          status = value;
        }
      ),
      0
    );
    assert.equal(status.kind, 'erasure');
    assert.equal(Number(status.counts.failed), 1);
    assert.equal(
      await runIdentityMaintenance(
        ['--erasure-requeue', 'QuarantineMember'],
        maintenanceEnv,
        (value) => {
          status = value;
        }
      ),
      0
    );
    assert.deepEqual(status, { requeued: true, kind: 'erasure' });
    assert.equal(
      await runIdentityMaintenance(
        ['--erasure-requeue', 'ErasureMember'],
        maintenanceEnv,
        () => undefined
      ),
      2
    );
    console.log(
      'PASS: twelve outages quarantine work; maintenance reports failures and requeues only a failed canonical tombstone'
    );

    await qualifyPendingIndex(runner, migration, 'identity_erasure_jobs', [
      'completedAt',
      'failedAt',
      'availableAt',
      'leasedUntil',
    ]);
    await source.query(
      'RENAME TABLE identity_erasure_jobs TO retained_erasure_jobs'
    );
    try {
      await assert.rejects(migration.up(runner), /table is missing/);
      assert.equal(await runner.hasTable('identity_erasure_jobs'), false);
    } finally {
      await source.query(
        'RENAME TABLE retained_erasure_jobs TO identity_erasure_jobs'
      );
    }
    const participantRunner = participants[0].createQueryRunner();
    await participantRunner.connect();
    try {
      const requests = new AccountErasureRequests1791840001000();
      await qualifyPendingIndex(
        participantRunner,
        requests,
        'identity_erasure_requests',
        ['completedAt', 'identityId']
      );
      await participantRunner.query(
        'RENAME TABLE identity_erasure_requests TO retained_erasure_requests'
      );
      try {
        await assert.rejects(
          requests.up(participantRunner),
          /table is missing/
        );
        assert.equal(
          await participantRunner.hasTable('identity_erasure_requests'),
          false
        );
      } finally {
        await participantRunner.query(
          'RENAME TABLE retained_erasure_requests TO identity_erasure_requests'
        );
      }
      await assert.rejects(requests.down(), /data-preserving rollback/);
    } finally {
      await participantRunner.release();
    }
    await assert.rejects(migration.down(), /data-preserving rollback/);
    console.log(
      'PASS: ordered SQL indexes survive reversed ORM metadata; missing/reordered/prefix indexes fail closed; migration re-entry, retained completion, missing-applied-table protection and destructive rollback refusal'
    );
  } finally {
    await runner.release();
    for (const participant of participants) await participant.destroy();
    for (const database of databases)
      await source.query(`DROP DATABASE \`${database}\``);
  }
};
