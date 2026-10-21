const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { MongoClient } = require('mongodb');
const {
  MysqlCanonicalIdentities,
} = require('../../libs/adapters/account-mysql/src');
const base = '../../apps/services/editorial/src/app/';
const { EDITORIAL_ERASURE_IDENTITY_COLUMNS } = require(base +
  'account-erasure/mysql-editorial-erasure-completion');
const { MysqlEditorialSnapshotReader } = require(base +
  'infrastructure/mysql-editorial-snapshot');
const { projectEditorialSnapshot } = require(base +
  'application/editorial-materialization');
const { MongoEditorialProjections } = require(base +
  'infrastructure/mongo-editorial-projections');

module.exports = async function qualifyAccountErasureCompletion(options) {
  const {
    accountSource,
    editorialSource,
    discussionSource,
    input,
    job,
    restartEditorial,
    restartDiscussion,
    restartAccount,
    accountOrigin,
    headers,
    credentialApp,
    mongoPort,
    password,
    pass,
  } = options;
  const identities = new MysqlCanonicalIdentities(accountSource);
  const owned = await editorialSource.query(
    'SELECT * FROM editorial_resource_states WHERE ownerIdentityId=? ORDER BY resourceKind,resourceId',
    [input.identityId]
  );
  assert.ok(owned.length >= (options.minimumOwnedResources ?? 8));
  const foreign = await editorialSource.query(
    'SELECT * FROM editorial_resource_states WHERE ownerIdentityId<>? ORDER BY resourceKind,resourceId',
    [input.identityId]
  );
  await accountSource.query(
    "CREATE TRIGGER qualification_global_erasure_completion BEFORE UPDATE ON identity_erasure_jobs FOR EACH ROW BEGIN IF NEW.completedAt IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected coordinator completion failure'; END IF; END"
  );
  try {
    await options.fenceWorkers?.();
    await restartEditorial({
      EDITORIAL_ERASURE_WORKERS_FENCED: 'true',
      EDITORIAL_MEDIA_CLEANUP_ENABLED: 'true',
    });
    await restartDiscussion();
    await restartAccount();
    let reachedCompletionFailure = false;
    for (let attempt = 0; attempt < 2400; attempt++) {
      const row = await job();
      assert.equal(row.completedAt, null);
      assert.equal(row.failedAt, null, 'Erasure must not quarantine');
      const [editorial] = await editorialSource.query(
        'SELECT * FROM identity_erasure_requests WHERE identityId=?',
        [input.identityId]
      );
      if (
        editorial.completedAt !== null &&
        row.attempts > 0 &&
        row.leaseToken === null
      ) {
        reachedCompletionFailure = true;
        break;
      }
      // Advance only unleased disposable test scheduling; the compiled pump owns all cleanup and receipts.
      await accountSource.query(
        'UPDATE identity_erasure_jobs SET availableAt=? WHERE identityId=? AND leaseToken IS NULL AND completedAt IS NULL AND failedAt IS NULL AND availableAt>?',
        [Date.now(), input.identityId, Date.now()]
      );
      await delay(100);
    }
    assert.ok(
      reachedCompletionFailure,
      'Compiled coordinator did not reach final journal write'
    );
    assert.equal(
      (await identities.requestDeletion(input.identityId)).cleanup,
      'pending'
    );
    for (const source of [accountSource, editorialSource, discussionSource]) {
      const [receipt] = await source.query(
        'SELECT * FROM identity_erasure_requests WHERE identityId=?',
        [input.identityId]
      );
      assert.equal(Number(receipt.revision), input.revision);
      assert.ok(Number(receipt.completedAt) >= Number(receipt.requestedAt));
    }
    pass(
      'All compiled participants complete through the real Account pump; an injected final coordinator journal failure still prevents global completion'
    );
    await options.afterCompletionFailure?.();
  } finally {
    await accountSource.query(
      'DROP TRIGGER qualification_global_erasure_completion'
    );
  }
  await restartAccount();
  await options.until(
    job,
    (row) => row.completedAt !== null,
    'Coordinator did not retry final completion'
  );
  const completed = await identities.requestDeletion(input.identityId);
  assert.equal(completed.cleanup, 'completed');
  assert.equal(completed.revision, input.revision);
  if (options.assertCredentialRemoved) await options.assertCredentialRemoved();
  else
    await assert.rejects(
      credentialApp.auth().getUser(input.identityId),
      (error) => error.code === 'auth/user-not-found'
    );
  for (const [table, column] of EDITORIAL_ERASURE_IDENTITY_COLUMNS)
    assert.deepEqual(
      await editorialSource.query(
        `SELECT 1 FROM ${table} WHERE ${column}=? LIMIT 1`,
        [input.identityId]
      ),
      [],
      `${table}.${column}`
    );
  assert.deepEqual(
    await editorialSource.query(
      'SELECT * FROM editorial_resource_states WHERE ownerIdentityId IS NOT NULL ORDER BY resourceKind,resourceId'
    ),
    foreign
  );
  const mongo =
    options.mongo ??
    (await MongoClient.connect(
      `mongodb://wapps:${encodeURIComponent(
        password
      )}@127.0.0.1:${mongoPort}/suites?authSource=admin`
    ));
  try {
    const projections = new MongoEditorialProjections(
      mongo
        .db(options.editorialDatabase ?? 'suites')
        .collection('editorial_projections_v1')
    );
    const reader = new MysqlEditorialSnapshotReader(editorialSource, 'default');
    for (const previous of owned) {
      const snapshot = await reader.read(
        previous.resourceKind,
        previous.resourceId
      );
      assert.equal(snapshot.revision, Number(previous.revision) + 1);
      assert.deepEqual(
        await projections.find(previous.resourceKind, previous.resourceId),
        projectEditorialSnapshot(snapshot)
      );
    }
  } finally {
    if (!options.mongo) await mongo.close();
  }
  const journals = await Promise.all(
    [accountSource, editorialSource, discussionSource].map((source) =>
      source.query(
        'SELECT * FROM identity_erasure_requests WHERE identityId=?',
        [input.identityId]
      )
    )
  );
  const finalJob = await job();
  await restartEditorial({
    EDITORIAL_ERASURE_WORKERS_FENCED: 'false',
    EDITORIAL_MEDIA_CLEANUP_ENABLED: 'false',
  });
  await restartDiscussion();
  await restartAccount();
  assert.deepEqual(
    await identities.requestDeletion(input.identityId),
    completed
  );
  assert.deepEqual(await job(), finalJob);
  assert.deepEqual(
    await Promise.all(
      [accountSource, editorialSource, discussionSource].map((source) =>
        source.query(
          'SELECT * FROM identity_erasure_requests WHERE identityId=?',
          [input.identityId]
        )
      )
    ),
    journals
  );
  for (const method of ['GET', 'DELETE'])
    assert.equal(
      (
        await fetch(`${accountOrigin()}/api/me`, {
          method,
          headers: headers(input.identityId),
          signal: AbortSignal.timeout(10000),
        })
      ).status,
      401
    );
  pass(
    'Account tombstone and exact credential/global completion journals survive all three API restarts; all 36 Editorial attribution fields drain, public snapshots remain current and anonymous, foreign ownership is unchanged, and deleted sessions cannot read or repeat DELETE'
  );
};
