const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  MysqlAccountErasureParticipant,
} = require('../../sdk/features/identity/packages/infrastructure/mysql/src');
const {
  DurableDiscussionCommands,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/application/durable-discussion-commands');
const {
  RegisteredDiscussionPayloads,
  RetireDiscussionPayloads,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/application/registered-discussion-payloads');
const {
  MysqlDiscussionPayloads,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/mysql-discussion-payloads');
const {
  MysqlDiscussionWrites,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/mysql-discussion-writes');
const {
  MinioDiscussionPayloadObjects,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/immutable-discussion-payloads');
const {
  DiscussionPayloads1791840004000,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/discussion-payloads.migration');

module.exports = async function qualifyDiscussionPayloads({
  source,
  minio,
  uploaded,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const registry = new MysqlDiscussionPayloads(source);
  const objects = new MinioDiscussionPayloadObjects(minio);
  const writes = new MysqlDiscussionWrites(source);
  const participant = new MysqlAccountErasureParticipant('discussion', source);
  const cleanup = new RetireDiscussionPayloads(registry, objects);
  const owner = {
    identityId: 'PayloadOwner',
    tenantId: 'default',
    roles: ['discussion:writer'],
  };
  const sibling = { ...owner, identityId: 'payloadOwner' };
  const scope = (actor) => ({
    tenantId: actor.tenantId,
    ownerIdentityId: actor.identityId,
    actorIdentityId: actor.identityId,
  });
  const writer = new RegisteredDiscussionPayloads(registry, {
    put: async (reference, body) => {
      uploaded.push(reference.key);
      await objects.put(reference, body);
    },
    retire: (reference) => objects.retire(reference),
  });
  const commands = new DurableDiscussionCommands(
    writes,
    writer,
    { evaluate: async () => ({ ok: true, value: true }) },
    { generate: randomUUID }
  );
  const record = async (key) =>
    (
      await source.query(
        'SELECT * FROM discussion_payload_objects WHERE objectKey=?',
        [key]
      )
    )[0];
  const request = { identityId: owner.identityId, revision: 9 };
  await assert.rejects(cleanup.advance(request), /requires an erasure barrier/);

  const root = await commands.create(
    { content: 'First published content' },
    owner,
    randomUUID()
  );
  const [first] = await source.query(
    'SELECT payloadKey FROM discussion_write_nodes WHERE nodeId=?',
    [root.id]
  );
  assert.equal((await record(first.payloadKey)).state, 'committed');
  const foreign = await commands.create(
    { content: 'Foreign account body' },
    sibling,
    randomUUID()
  );
  await commands.update(
    root.id,
    { expectedRevision: 1, content: 'Current public contribution' },
    owner,
    randomUUID()
  );
  const [current] = await source.query(
    'SELECT payloadKey FROM discussion_write_nodes WHERE nodeId=?',
    [root.id]
  );
  assert.notEqual(current.payloadKey, first.payloadKey);
  await source.query(
    "CREATE TRIGGER payload_commit_failure BEFORE INSERT ON discussion_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected outbox rollback'"
  );
  try {
    await assert.rejects(
      commands.create(
        { content: 'Private uncommitted body' },
        owner,
        randomUUID()
      ),
      /injected outbox rollback/
    );
  } finally {
    await source.query('DROP TRIGGER payload_commit_failure');
  }
  const [orphan] = await source.query(
    "SELECT * FROM discussion_payload_objects WHERE ownerIdentityId=? AND state='uploaded'",
    [owner.identityId]
  );
  assert.ok(orphan);
  assert.equal(
    (
      await source.query(
        'SELECT 1 FROM discussion_write_nodes WHERE nodeId=?',
        [orphan.nodeId]
      )
    ).length,
    0
  );
  const forged = {
    type: 'create',
    nodeId: randomUUID(),
    referenceKey: randomUUID(),
    subjectId: null,
    state: 'published',
    visibility: 'public',
    at: Date.now(),
    command: { actor: sibling, key: randomUUID(), fingerprint: 'a'.repeat(64) },
    payload: {
      key: orphan.objectKey,
      sha256: orphan.sha256,
      bytes: Number(orphan.bytes),
    },
  };
  await assert.rejects(
    writes.commit(forged),
    /Invalid discussion payload reference/
  );
  await assert.rejects(
    writes.commit({ ...forged, nodeId: orphan.nodeId }),
    /reservation differs/
  );
  assert.equal((await record(orphan.objectKey)).state, 'uploaded');
  assert.equal(
    (
      await source.query(
        'SELECT 1 FROM discussion_commands WHERE commandKey=?',
        [forged.command.key]
      )
    ).length,
    0
  );

  let releasePut;
  let announcePut;
  const gate = new Promise((resolve) => {
    releasePut = resolve;
  });
  const putting = new Promise((resolve) => {
    announcePut = resolve;
  });
  const pausedNode = randomUUID();
  const paused = new RegisteredDiscussionPayloads(registry, {
    put: async (reference, body) => {
      uploaded.push(reference.key);
      announcePut(reference);
      await gate;
      await objects.put(reference, body);
    },
    retire: (reference) => objects.retire(reference),
  }).put(
    pausedNode,
    Buffer.from('{"content":"paused private bytes"}'),
    scope(owner)
  );
  const pausedResult = assert.rejects(
    paused,
    /Precondition|precondition|condition/i
  );
  const pausedReference = await putting;
  assert.equal((await record(pausedReference.key)).state, 'reserved');
  await assert.rejects(
    writes.commit({
      ...forged,
      nodeId: pausedNode,
      command: { ...forged.command, actor: owner, key: randomUUID() },
      payload: pausedReference,
    }),
    /reservation differs/,
    'A durable reservation alone must never publish an unconfirmed upload'
  );
  const deferred = [];
  for (let i = 0; i < 33; i++) {
    const nodeId = randomUUID();
    const reference = {
      key: `discussions/${nodeId}/versions/${randomUUID()}.json`,
      sha256: createHash('sha256').update('{}').digest('hex'),
      bytes: 2,
    };
    await registry.reserve(nodeId, reference, scope(owner));
    deferred.push(reference);
    uploaded.push(reference.key);
  }
  const before = await source.query(
    'SELECT * FROM discussion_outbox ORDER BY id'
  );
  await participant.request(request);
  await assert.rejects(
    registry.retiring({ ...request, revision: 10 }),
    /exact pending/
  );
  await assert.rejects(
    writer.put(randomUUID(), Buffer.from('{}'), scope(owner)),
    /Account erasure prevents/
  );
  const failed = new RetireDiscussionPayloads(registry, {
    put: (ref, body) => objects.put(ref, body),
    retire: async () => {
      throw new Error('offline storage');
    },
  });
  await assert.rejects(failed.advance(request), /offline storage/);
  assert.equal(
    Number(
      (
        await source.query(
          "SELECT COUNT(*) AS count FROM discussion_payload_objects WHERE ownerIdentityId=? AND state='retiring'",
          [owner.identityId]
        )
      )[0].count
    ),
    32
  );
  const reopened = await new DataSource({
    ...source.options,
    migrations: [],
  }).initialize();
  try {
    const resumed = new RetireDiscussionPayloads(
      new MysqlDiscussionPayloads(reopened),
      objects
    );
    assert.equal(await resumed.advance(request), 32);
    assert.equal(await resumed.advance(request), 4);
    assert.equal(await resumed.advance(request), 0);
  } finally {
    await reopened.destroy();
    releasePut();
  }
  await pausedResult;
  for (const key of [
    first.payloadKey,
    orphan.objectKey,
    pausedReference.key,
    ...deferred.map((ref) => ref.key),
  ]) {
    assert.equal(
      (await minio.getBytes('discussion-content', key, 1)).length,
      0
    );
    assert.equal((await record(key)).state, 'retired');
    await assert.rejects(
      minio.putImmutableBytes('discussion-content', key, Buffer.from('{}')),
      /Precondition|precondition|condition/i
    );
  }
  assert.equal((await record(current.payloadKey)).state, 'committed');
  assert.ok(
    (
      await minio.getBytes('discussion-content', current.payloadKey, 1024)
    ).includes('Current public contribution')
  );
  assert.equal((await participant.request(request)).state, 'pending');
  assert.deepEqual(
    await source.query('SELECT * FROM discussion_outbox ORDER BY id'),
    before
  );
  await commands.reply(
    root.id,
    'Other members retain the conversation',
    sibling,
    randomUUID()
  );
  assert.ok(await writes.resource(foreign.id));
  console.log(
    'PASS: durable upload ownership, atomic publication/outbox rollback, foreign-scope denial, bounded retirement, outage/reconnect, permanent markers and an upload paused after reservation; current public contributions and other members remain intact'
  );

  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    const migration = new DiscussionPayloads1791840004000();
    await migration.up(runner);
    const [storedMigration] = await source.query(
      'SELECT * FROM migrations WHERE name=?',
      [migration.constructor.name]
    );
    await source.query('DELETE FROM migrations WHERE name=?', [
      migration.constructor.name,
    ]);
    await source.query(
      'RENAME TABLE discussion_payload_objects TO qualified_payload_objects'
    );
    await migration.up(runner);
    const migrated = await record(current.payloadKey);
    assert.equal(migrated.ownerIdentityId, owner.identityId);
    assert.equal(migrated.actorIdentityId, null);
    assert.equal(migrated.state, 'committed');
    await source.query('DROP TABLE discussion_payload_objects');
    await source.query(
      'RENAME TABLE qualified_payload_objects TO discussion_payload_objects'
    );
    await source.query(
      'INSERT INTO migrations (id, timestamp, name) VALUES (?, ?, ?)',
      [storedMigration.id, storedMigration.timestamp, storedMigration.name]
    );
    await migration.up(runner);
    await source.query(
      'UPDATE discussion_payload_objects SET sha256=? WHERE objectKey=?',
      ['f'.repeat(64), current.payloadKey]
    );
    try {
      await assert.rejects(migration.up(runner), /disagrees with authority/);
    } finally {
      await source.query(
        'UPDATE discussion_payload_objects SET sha256=? WHERE objectKey=?',
        [migrated.sha256, current.payloadKey]
      );
    }
    await source.query(
      'RENAME TABLE discussion_payload_objects TO qualified_payload_objects'
    );
    try {
      await assert.rejects(
        migration.up(runner),
        /Applied discussion payload registry is missing/
      );
    } finally {
      await source.query(
        'RENAME TABLE qualified_payload_objects TO discussion_payload_objects'
      );
    }
    await assert.rejects(migration.down(), /data-preserving rollback/);
    await migration.up(runner);
    console.log(
      'PASS: current-reference upgrade preserves canonical owners without inventing upload actors; migration re-entry validates registry/authority and refuses lost applied history or destructive rollback'
    );
  } finally {
    await runner.release();
  }
};
