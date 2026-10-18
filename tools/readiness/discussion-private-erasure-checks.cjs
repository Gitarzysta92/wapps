const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = '../../apps/services/community/src/app/discussions/';
const materializer =
  '../../sdk/features/discussion/applications/materializer/service/src/';
const {
  MysqlDiscussionPrivateErasure,
} = require(`${root}infrastructure/mysql-discussion-private-erasure`);
const {
  DiscussionPrivateErasure1791840007000,
} = require(`${root}infrastructure/discussion-private-erasure.migration`);
const {
  DiscussionPayloads1791840004000,
} = require(`${root}infrastructure/discussion-payloads.migration`);
const {
  MysqlDiscussionPayloads,
} = require(`${root}infrastructure/mysql-discussion-payloads`);
const {
  RegisteredDiscussionPayloads,
  RetireDiscussionPayloads,
} = require(`${root}application/registered-discussion-payloads`);
const {
  MinioDiscussionPayloadObjects,
} = require(`${root}infrastructure/immutable-discussion-payloads`);
const {
  MysqlDiscussionWrites,
} = require(`${root}infrastructure/mysql-discussion-writes`);
const {
  DurableDiscussionCommands,
} = require(`${root}application/durable-discussion-commands`);
const {
  MysqlDiscussionVotes,
} = require(`${root}infrastructure/mysql-discussion-votes`);
const {
  MysqlAccountErasureParticipant,
} = require('../../libs/adapters/account-mysql/src');
const {
  MysqlDiscussionSnapshotReader,
} = require(`${materializer}mysql-snapshot-reader`);
const {
  MinioImmutablePayloadReader,
} = require(`${materializer}immutable-payload-reader`);
const {
  MongoGenerationStore,
} = require(`${materializer}mongo-generation-store`);
const { materializeDiscussion } = require(`${materializer}materialization`);

module.exports = async function qualifyDiscussionPrivateErasure({
  source,
  minio,
  mongo,
  pool,
  uploaded,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const cleanup = new MysqlDiscussionPrivateErasure(source);
  const participant = new MysqlAccountErasureParticipant('discussion', source);
  const registry = new MysqlDiscussionPayloads(source);
  const objects = new MinioDiscussionPayloadObjects(minio);
  const registered = new RegisteredDiscussionPayloads(registry, {
    put: async (reference, bytes) => {
      uploaded.push(reference.key);
      await objects.put(reference, bytes);
    },
    retire: (reference) => objects.retire(reference),
  });
  const writes = new MysqlDiscussionWrites(source);
  const commands = new DurableDiscussionCommands(
    writes,
    registered,
    { evaluate: async () => ({ ok: true, value: true }) },
    { generate: randomUUID },
    { visible: async () => true }
  );
  const actor = {
    identityId: 'PrivateErasureActor',
    tenantId: 'default',
    roles: [],
  };
  const other = { ...actor, identityId: 'privateErasureActor' };
  const owner = { ...actor, identityId: 'PrivateErasureAuthor' };
  const request = { identityId: actor.identityId, revision: 12 };
  const article = await commands.create(
    { content: 'Other author thread' },
    owner,
    randomUUID()
  );
  const reply = await commands.reply(
    article.id,
    'Other author reply',
    owner,
    randomUUID()
  );
  const likeKey = randomUUID();
  await commands.like(reply.id, true, actor, likeKey);
  await commands.like(reply.id, true, other, randomUUID());
  const target = { kind: 'application', id: randomUUID() };
  const topic = await commands.create(
    {
      content: { title: 'Topic', text: 'Remains', displayName: 'Author' },
      subjectId: target.id,
      target,
    },
    owner,
    randomUUID()
  );
  const vote = async (voter, value) =>
    commands.vote(
      topic.id,
      { expectedRevision: (await writes.resource(topic.id)).revision, value },
      voter,
      randomUUID(),
      target
    );
  await vote(actor, 1);
  await vote(other, -1);
  const reader = new MysqlDiscussionSnapshotReader(pool);
  const loader = new MinioImmutablePayloadReader(minio);
  const nodes = mongo
    .db(source.options.database)
    .collection('private_erasure_nodes');
  const heads = mongo
    .db(source.options.database)
    .collection('private_erasure_heads');
  const store = new MongoGenerationStore(nodes, heads);
  await store.ensureIndexes();
  const project = (id) => materializeDiscussion(id, reader, loader, store);
  await project(article.id);
  const before = await reader.read(article.id);
  assert.equal(before.nodes.find((node) => node.id === reply.id).likeCount, 2);
  const originalReply = await writes.resource(reply.id);

  // An abandoned owner upload and a staff-attributed upload owned by someone else.
  const orphanId = randomUUID(),
    orphanBody = Buffer.from('{"content":"private orphan"}');
  const orphan = await registered.put(orphanId, orphanBody, {
    ownerIdentityId: actor.identityId,
    actorIdentityId: actor.identityId,
    tenantId: 'default',
  });
  const staffId = randomUUID(),
    staffBody = Buffer.from('{"content":"Other author history"}');
  const staff = await registered.put(staffId, staffBody, {
    ownerIdentityId: owner.identityId,
    actorIdentityId: actor.identityId,
    tenantId: 'default',
  });
  const peerRows = await source.query(
    'SELECT * FROM discussion_commands WHERE actorIdentityId=? ORDER BY tenantId,commandKey',
    [other.identityId]
  );

  await assert.rejects(
    cleanup.advance(request),
    /Missing Discussion erasure request/
  );
  await participant.request(request);
  await source.query(
    'UPDATE discussion_payload_inventory SET completedAt=NULL'
  );
  try {
    await assert.rejects(cleanup.advance(request), /inventory must complete/);
  } finally {
    await source.query(
      'UPDATE discussion_payload_inventory SET completedAt=GREATEST(legacyWritersStoppedAt,?)',
      [Date.now()]
    );
  }
  await assert.rejects(
    cleanup.advance({ ...request, revision: 13 }),
    /exact pending erasure/
  );
  const rollback = new MysqlDiscussionPrivateErasure({
    transaction: (isolation, work) =>
      source.transaction(isolation, (tx) =>
        work({
          queryRunner: tx.queryRunner,
          query: (sql, values) => {
            if (sql.startsWith('INSERT INTO discussion_outbox'))
              throw new Error('Outbox unavailable');
            return tx.query(sql, values);
          },
        })
      ),
  });
  await assert.rejects(rollback.advance(request), /Outbox unavailable/);
  assert.equal(
    (await writes.resource(reply.id)).revision,
    originalReply.revision
  );
  assert.equal(
    (await reader.read(article.id)).nodes.find((node) => node.id === reply.id)
      .likeCount,
    2
  );

  // Hold an ordinary writer after it owns the aggregate lock, then let cleanup wait for it.
  const connection = source.createQueryRunner();
  await connection.connect();
  await connection.startTransaction();
  let concurrentCleanup;
  try {
    const [current] = await connection.query(
      'SELECT revision FROM discussion_write_aggregates WHERE id=? FOR UPDATE',
      [article.id]
    );
    await connection.query(
      'INSERT INTO comment_likes (id,commentId,actorIdentityId,createdAt) VALUES (?,?,?,?)',
      [randomUUID(), article.id, 'ConcurrentOther', Date.now()]
    );
    const revision = Number(current.revision) + 1;
    await connection.query(
      'UPDATE discussion_write_aggregates SET revision=? WHERE id=?',
      [revision, article.id]
    );
    await connection.query(
      'INSERT INTO discussion_outbox (id,discussionId,revision,createdAt,availableAt) VALUES (?,?,?,?,?)',
      [randomUUID(), article.id, revision, Date.now(), Date.now()]
    );
    let attempted;
    const locked = new Promise((resolve) => {
      attempted = resolve;
    });
    const waitingCleanup = new MysqlDiscussionPrivateErasure({
      transaction: (isolation, work) =>
        source.transaction(isolation, (tx) =>
          work({
            queryRunner: tx.queryRunner,
            query: (sql, values) => {
              if (
                sql ===
                'SELECT revision FROM discussion_write_aggregates WHERE id=? FOR UPDATE'
              )
                attempted();
              return tx.query(sql, values);
            },
          })
        ),
    });
    concurrentCleanup = waitingCleanup.advance(request);
    await locked;
    await connection.commitTransaction();
    assert.equal(await concurrentCleanup, 'pending');
    assert.equal((await writes.resource(reply.id)).revision, revision + 1);
  } finally {
    if (connection.isTransactionActive) await connection.rollbackTransaction();
    await connection.release();
    if (concurrentCleanup) await concurrentCleanup;
  }
  await project(article.id);
  assert.equal((await nodes.findOne({ _id: reply.id })).likeCount, 1);
  assert.equal((await nodes.findOne({ _id: article.id })).likeCount, 1);
  assert.equal(
    await materializeDiscussion(
      article.id,
      { read: async () => before },
      loader,
      store
    ),
    'superseded'
  );
  assert.equal((await nodes.findOne({ _id: reply.id })).likeCount, 1);
  const after = await reader.read(article.id);
  assert.deepEqual(
    after.nodes.map((node) => ({ ...node, likeCount: 0 })),
    before.nodes.map((node) => ({ ...node, likeCount: 0 })),
    'Reaction cleanup preserves authored nodes and their timestamps'
  );

  const votes = new MysqlDiscussionVotes(source);
  const oldRevision = (await writes.resource(topic.id)).revision;
  assert.equal(await cleanup.advance(request), 'pending');
  await assert.rejects(
    votes.read(topic.id, oldRevision, null),
    /changed while loading/
  );
  const nextRevision = (await writes.resource(topic.id)).revision;
  assert.equal(nextRevision, oldRevision + 1);
  assert.deepEqual(
    (await votes.read(topic.id, nextRevision, other.identityId)).get(topic.id),
    { upvotes: 0, downvotes: 1, mine: -1 }
  );
  assert.equal(
    (
      await source.query(
        'SELECT id FROM discussion_outbox WHERE discussionId=? AND revision=?',
        [topic.id, nextRevision]
      )
    ).length,
    1
  );
  await assert.rejects(
    commands.like(reply.id, true, actor, likeKey),
    /erasure prevents/
  );
  console.log(
    'PASS: SQL rollback keeps interactions/counts intact; aggregate-lock concurrency preserves peer reactions; atomic revision/outbox updates fence stale counts and delayed materializers'
  );

  // Enough private receipts and registry entries to prove bounded restartable cleanup.
  for (let index = 0; index < 130; index++) {
    await source.query(
      'INSERT INTO discussion_commands (tenantId,actorIdentityId,commandKey,fingerprint,nodeId,discussionId,revision,createdAt) VALUES (?,?,?,?,?,?,?,?)',
      [
        index % 2 ? 'default' : 'another-tenant',
        actor.identityId,
        `private-${index}`,
        'a'.repeat(64),
        reply.id,
        article.id,
        nextRevision,
        Date.now(),
      ]
    );
  }
  const count = async (table, column = 'actorIdentityId') =>
    Number(
      (
        await source.query(
          `SELECT COUNT(*) count FROM ${table} WHERE ${column}=?`,
          [actor.identityId]
        )
      )[0].count
    );
  const receiptCount = await count('discussion_commands');
  assert.equal(await cleanup.advance(request), 'pending');
  assert.equal(await count('discussion_commands'), receiptCount - 128);
  await new MysqlDiscussionPrivateErasure(source).advance(request);
  assert.equal(await count('discussion_commands'), 0);
  assert.equal(
    await cleanup.advance(request),
    'pending',
    'Attribution cannot be cleared before original bytes retire'
  );
  assert.equal(await count('discussion_payload_objects', 'ownerIdentityId'), 1);
  const retire = new RetireDiscussionPayloads(registry, objects);
  assert.equal(await retire.advance(request), 1);
  assert.equal(
    (await minio.getObjectSnapshot('discussion-content', orphan.key, 1000)).body
      .length,
    0
  );

  // Reuse a genuinely retired guard to model a large historical registry without fake object deletion.
  const template = (
    await source.query(
      'SELECT * FROM discussion_payload_objects WHERE objectKey=?',
      [orphan.key]
    )
  )[0];
  for (let index = 0; index < 130; index++) {
    const nodeId = randomUUID();
    const reference = {
      ...orphan,
      key: `discussions/${nodeId}/versions/${randomUUID()}.json`,
    };
    uploaded.push(reference.key);
    await objects.retire(reference);
    await source.query(
      'INSERT INTO discussion_payload_objects (objectKey,nodeId,ownerIdentityId,actorIdentityId,tenantId,sha256,bytes,state,registeredAt,retiredAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [
        reference.key,
        nodeId,
        actor.identityId,
        actor.identityId,
        'default',
        template.sha256,
        template.bytes,
        'retired',
        template.registeredAt,
        template.retiredAt,
      ]
    );
  }
  assert.equal(await cleanup.advance(request), 'pending');
  assert.equal(await count('discussion_payload_objects', 'ownerIdentityId'), 3);
  await cleanup.advance(request);
  assert.equal(await count('discussion_payload_objects', 'ownerIdentityId'), 0);
  await registry.retired(request, orphan.key);
  await assert.rejects(objects.put(orphan, orphanBody), {
    name: 'PreconditionFailed',
  });
  assert.equal(
    (await minio.getObjectSnapshot('discussion-content', orphan.key, 1000)).body
      .length,
    0
  );
  assert.equal(await cleanup.advance(request), 'pending');
  const staffAfter = (
    await source.query(
      'SELECT * FROM discussion_payload_objects WHERE objectKey=?',
      [staff.key]
    )
  )[0];
  assert.equal(staffAfter.actorIdentityId, null);
  assert.equal(staffAfter.ownerIdentityId, owner.identityId);
  assert.equal(staffAfter.state, 'uploaded');
  assert.deepEqual(
    (await minio.getObjectSnapshot('discussion-content', staff.key, 1000)).body,
    staffBody
  );
  const revisionBeforeDrain = (await writes.resource(reply.id)).revision;
  assert.equal(await cleanup.advance(request), 'drained');
  assert.equal(
    await new MysqlDiscussionPrivateErasure(source).advance(request),
    'drained'
  );
  assert.equal((await writes.resource(reply.id)).revision, revisionBeforeDrain);
  assert.equal((await participant.request(request)).state, 'pending');
  assert.equal(await count('comment_likes'), 0);
  assert.equal(await count('discussion_votes'), 0);
  assert.equal(await count('discussion_payload_objects'), 0);
  assert.deepEqual(
    await source.query(
      'SELECT * FROM discussion_commands WHERE actorIdentityId=? ORDER BY tenantId,commandKey',
      [other.identityId]
    ),
    peerRows
  );
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT erasureRevision FROM identity_erasure_barriers WHERE identityId=?',
          [actor.identityId]
        )
      )[0].erasureRevision
    ),
    request.revision
  );
  await assert.rejects(
    commands.like(reply.id, true, actor, likeKey),
    /erasure prevents/
  );
  const duplicateActor = { ...actor, identityId: 'DuplicateCleanup' };
  await commands.like(reply.id, true, duplicateActor, randomUUID());
  const duplicateRequest = {
    identityId: duplicateActor.identityId,
    revision: 1,
  };
  await participant.request(duplicateRequest);
  const beforeDuplicates = (await writes.resource(reply.id)).revision;
  await Promise.all([
    cleanup.advance(duplicateRequest),
    new MysqlDiscussionPrivateErasure(source).advance(duplicateRequest),
  ]);
  assert.equal(
    (await writes.resource(reply.id)).revision,
    beforeDuplicates + 1
  );
  assert.equal(await cleanup.advance(duplicateRequest), 'drained');
  await participant.request({ identityId: owner.identityId, revision: 1 });
  assert.equal(
    await cleanup.advance({ identityId: owner.identityId, revision: 1 }),
    'pending',
    'Canonical authorship must finish before private cleanup'
  );
  console.log(
    "PASS: 128-row private batches resume across instances and tenants; anonymous retirement guards reject late PUTs; delayed acknowledgements replay; staff attribution clears without deleting another owner's bytes; no service completion is issued"
  );

  const runner = source.createQueryRunner();
  await runner.connect();
  const migration = new DiscussionPrivateErasure1791840007000();
  try {
    await migration.up(runner);
    await new DiscussionPayloads1791840004000().up(runner);
    await source.query(
      'ALTER TABLE discussion_votes ALTER INDEX idx_vote_actor INVISIBLE'
    );
    try {
      await assert.rejects(migration.up(runner), /Incompatible.*index/);
    } finally {
      await source.query(
        'ALTER TABLE discussion_votes ALTER INDEX idx_vote_actor VISIBLE'
      );
    }
    await source.query('DROP INDEX idx_like_actor ON comment_likes');
    try {
      await assert.rejects(migration.up(runner), /Applied.*index is missing/);
    } finally {
      await source.query(
        'CREATE INDEX idx_like_actor ON comment_likes (actorIdentityId,commentId)'
      );
    }
    await source.query(
      'DROP INDEX idx_discussion_command_actor ON discussion_commands'
    );
    await source.query(
      'CREATE INDEX idx_discussion_command_actor ON discussion_commands (actorIdentityId,tenantId DESC,commandKey)'
    );
    try {
      await assert.rejects(migration.up(runner), /Incompatible.*index/);
    } finally {
      await source.query(
        'DROP INDEX idx_discussion_command_actor ON discussion_commands'
      );
      await source.query(
        'CREATE INDEX idx_discussion_command_actor ON discussion_commands (actorIdentityId,tenantId,commandKey)'
      );
    }
    await assert.rejects(migration.down(), /data-preserving rollback/);
  } finally {
    await runner.release();
  }
  const repairActor = { ...actor, identityId: 'UnmappedInteraction' };
  const repairRequest = { identityId: repairActor.identityId, revision: 1 };
  const missingId = randomUUID();
  await source.query(
    'INSERT INTO comment_likes (id,commentId,actorIdentityId,createdAt) VALUES (?,?,?,?)',
    [randomUUID(), missingId, repairActor.identityId, Date.now()]
  );
  await participant.request(repairRequest);
  await assert.rejects(
    cleanup.advance(repairRequest),
    /Unmapped.*requires repair/
  );
  assert.equal(
    (
      await source.query(
        'SELECT id FROM comment_likes WHERE actorIdentityId=?',
        [repairActor.identityId]
      )
    ).length,
    1
  );
  console.log(
    'PASS: strict migration re-entry validates anonymous registry records and actor indexes; missing/invisible indexes and unmapped legacy interactions fail closed'
  );
};
