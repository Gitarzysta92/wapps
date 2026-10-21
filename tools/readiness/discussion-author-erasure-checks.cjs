const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = '../../apps/services/community/src/app/discussions/';
const materializer =
  '../../sdk/features/discussion/applications/materializer/service/src/';
const {
  AnonymizeDiscussionContributions,
} = require(`${root}application/anonymize-discussion-contributions`);
const {
  MysqlDiscussionContributionErasure,
} = require(`${root}infrastructure/mysql-discussion-contribution-erasure`);
const {
  MinioDiscussionErasurePayloads,
} = require(`${root}infrastructure/minio-discussion-erasure-payloads`);
const {
  DiscussionAuthorErasure1791840006000,
} = require(`${root}infrastructure/discussion-author-erasure.migration`);
const {
  DiscussionParticipation1791676824000,
} = require(`${root}infrastructure/discussion-participation.migration`);
const {
  DiscussionPayloads1791840004000,
} = require(`${root}infrastructure/discussion-payloads.migration`);
const {
  InventoryDiscussionPayloads,
} = require(`${root}application/discussion-payload-inventory`);
const {
  MysqlDiscussionPayloadInventory,
} = require(`${root}infrastructure/mysql-discussion-payload-inventory`);
const {
  MinioDiscussionPayloadInventory,
} = require(`${root}infrastructure/minio-discussion-payload-inventory`);
const {
  RegisteredDiscussionPayloads,
  RetireDiscussionPayloads,
} = require(`${root}application/registered-discussion-payloads`);
const {
  MysqlDiscussionPayloads,
} = require(`${root}infrastructure/mysql-discussion-payloads`);
const {
  MinioDiscussionPayloadObjects,
} = require(`${root}infrastructure/immutable-discussion-payloads`);
const {
  MysqlDiscussionWrites,
} = require(`${root}infrastructure/mysql-discussion-writes`);
const {
  DurableDiscussionCommands,
} = require(`${root}application/durable-discussion-commands`);
const { DiscussionQueries } = require(`${root}application/discussion-queries`);
const { ArticleComments } = require(`${root}application/article-comments`);
const {
  MysqlAccountErasureParticipant,
} = require('../../libs/adapters/account-mysql/src');
const {
  MongoGenerationStore,
} = require(`${materializer}mongo-generation-store`);
const {
  MysqlDiscussionSnapshotReader,
} = require(`${materializer}mysql-snapshot-reader`);
const {
  MinioImmutablePayloadReader,
} = require(`${materializer}immutable-payload-reader`);
const { materializeDiscussion } = require(`${materializer}materialization`);

module.exports = async function qualifyDiscussionAuthorErasure({
  source,
  minio,
  uploaded,
  mongo,
  pool,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const repository = new MysqlDiscussionContributionErasure(source);
  const erasedObjects = new MinioDiscussionErasurePayloads(minio);
  const payloads = {
    read: (...args) => erasedObjects.read(...args),
    put: async (reference, body) => {
      uploaded.push(reference.key);
      await erasedObjects.put(reference, body);
    },
  };
  const worker = new AnonymizeDiscussionContributions(repository, payloads);
  const participant = new MysqlAccountErasureParticipant('discussion', source);
  const registry = new MysqlDiscussionPayloads(source);
  const objects = new MinioDiscussionPayloadObjects(minio);
  const registered = new RegisteredDiscussionPayloads(registry, {
    put: async (reference, body) => {
      uploaded.push(reference.key);
      await objects.put(reference, body);
    },
    retire: (reference) => objects.retire(reference),
  });
  const writes = new MysqlDiscussionWrites(source);
  const targets = { visible: async () => true };
  const commands = new DurableDiscussionCommands(
    writes,
    registered,
    { evaluate: async () => ({ ok: true, value: true }) },
    { generate: randomUUID },
    targets
  );
  const owner = { identityId: 'ErasureOwner', tenantId: 'default', roles: [] };
  const other = { ...owner, identityId: 'OtherMember' };
  const request = { identityId: owner.identityId, revision: 4 };
  const target = { kind: 'article', id: randomUUID() };
  const text = {
    displayName: 'Identifying name',
    text: 'Public contribution remains',
  };
  const create = (actor = owner, extra = {}) =>
    commands.create(
      { content: text, subjectId: target.id, target, ...extra },
      actor,
      randomUUID()
    );
  const row = async (id) =>
    (
      await source.query(
        'SELECT * FROM discussion_write_nodes WHERE nodeId=?',
        [id]
      )
    )[0];
  const nodes = mongo.db(source.options.database).collection('erasure_nodes');
  const heads = mongo.db(source.options.database).collection('erasure_heads');
  const store = new MongoGenerationStore(nodes, heads);
  await store.ensureIndexes();
  const reader = new MysqlDiscussionSnapshotReader(pool);
  const loader = new MinioImmutablePayloadReader(minio);
  const project = (id) => materializeDiscussion(id, reader, loader, store);
  const projections = {
    heads: () => heads.find({}).toArray(),
    head: (id) => heads.findOne({ _id: id }),
    nodes: (generation, id) =>
      nodes
        .find({ generation, ...(id ? { id } : {}) })
        .sort({ depth: 1, createdAt: 1, id: 1 })
        .toArray(),
  };
  const queries = new DiscussionQueries(
    writes,
    projections,
    'default',
    targets
  );
  const comments = new ArticleComments(
    commands,
    queries,
    writes,
    { list: async () => [] },
    targets,
    'default'
  );

  const runner = source.createQueryRunner();
  await runner.connect();
  const migration = new DiscussionAuthorErasure1791840006000();
  try {
    await migration.up(runner);
    await new DiscussionParticipation1791676824000().up(runner);
    await new DiscussionPayloads1791840004000().up(runner);
    await source.query(
      'RENAME TABLE discussion_erasure_nodes TO saved_erasure_nodes'
    );
    try {
      await assert.rejects(
        migration.up(runner),
        /Applied.*targets are missing/
      );
    } finally {
      await source.query(
        'RENAME TABLE saved_erasure_nodes TO discussion_erasure_nodes'
      );
    }
    await source.query(
      'CREATE INDEX unexpected_erasure_index ON discussion_erasure_nodes (projectionRevision)'
    );
    try {
      await assert.rejects(migration.up(runner), /Incompatible.*schema/);
    } finally {
      await source.query(
        'DROP INDEX unexpected_erasure_index ON discussion_erasure_nodes'
      );
    }
    await source.query(
      'ALTER TABLE discussion_write_nodes MODIFY ownerIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL'
    );
    try {
      await assert.rejects(
        migration.up(runner),
        /Applied.*ownership is missing/
      );
    } finally {
      await source.query(
        'ALTER TABLE discussion_write_nodes MODIFY ownerIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
      );
    }
    await assert.rejects(migration.down(), /data-preserving rollback/);
    console.log(
      'PASS: additive anonymous-owner migration, strict re-entry, applied-missing/index refusal and nondestructive rollback'
    );

    const thread = await create();
    const reply = await commands.reply(
      thread.id,
      { displayName: 'Other member', text: 'Other reply stays' },
      other,
      randomUUID(),
      target
    );
    const privateThread = await commands.create(
      {
        content: { displayName: 'Private name', text: 'Private body removed' },
        visibility: 'private',
      },
      owner,
      randomUUID()
    );
    const unlisted = await commands.create(
      {
        content: {
          displayName: 'Old unlisted name',
          text: 'Unlisted retained',
        },
        visibility: 'unlisted',
      },
      owner,
      randomUUID()
    );
    await assert.rejects(worker.advance(request), /Missing.*request/);
    assert.equal((await participant.request(request)).state, 'pending');
    await assert.rejects(worker.advance(request), /inventory must complete/);
    await assert.rejects(
      worker.advance({ ...request, revision: 5 }),
      /exact pending erasure/
    );
    const inventory = new InventoryDiscussionPayloads(
      new MysqlDiscussionPayloadInventory(source),
      new MinioDiscussionPayloadInventory(minio)
    );
    for (let page = 0; page < 10; page++) {
      const plan = await inventory.plan();
      const progress = await inventory.apply(plan.fingerprint, true);
      if (progress.completedAt !== null) break;
      assert.ok(page < 9, 'Inventory did not finish');
    }
    await project(thread.id);
    const beforeSnapshot = await reader.read(thread.id);
    assert.equal(
      (await comments.read(target.id, thread.id, null)).comments[0].content
        .displayName,
      text.displayName
    );
    const beforeReply = await row(reply.id);
    const oldReferences = await source.query(
      'SELECT objectKey FROM discussion_payload_objects WHERE ownerIdentityId=?',
      [owner.identityId]
    );
    for (let count = 0; count < 10; count++) {
      if (!(await worker.advance(request))) break;
      assert.ok(count < 9, 'Canonical cleanup did not finish');
    }
    assert.equal(await worker.advance(request), false);
    const anonymous = await row(thread.id),
      privateNode = await row(privateThread.id),
      unlistedNode = await row(unlisted.id);
    assert.equal(anonymous.ownerIdentityId, null);
    assert.notEqual(
      anonymous.payloadKey,
      beforeSnapshot.nodes.find((node) => node.id === thread.id).payload.key
    );
    assert.deepEqual(
      await row(reply.id),
      beforeReply,
      'Another member retains canonical ownership and body'
    );
    assert.equal(privateNode.ownerIdentityId, null);
    assert.equal(privateNode.payloadKey, null);
    assert.ok(
      (
        await source.query('SELECT deletedAt FROM content_nodes WHERE id=?', [
          privateNode.nodeId,
        ])
      )[0].deletedAt
    );
    assert.equal(unlistedNode.ownerIdentityId, null);
    const readCopy = (entry) =>
      erasedObjects.read(
        entry.nodeId,
        {
          key: entry.payloadKey,
          sha256: entry.payloadHash,
          bytes: entry.payloadBytes,
        },
        AbortSignal.timeout(5000)
      );
    assert.deepEqual(await readCopy(anonymous), {
      text: text.text,
    });
    assert.deepEqual(await readCopy(unlistedNode), {
      text: 'Unlisted retained',
    });
    await assert.rejects(comments.read(target.id, thread.id, null), /pending/);
    await project(thread.id);
    const visible = await comments.read(target.id, thread.id, null);
    assert.equal(
      visible.comments.find((entry) => entry.id === thread.id).content
        .displayName,
      'Deleted account'
    );
    assert.equal(
      visible.comments.find((entry) => entry.id === reply.id).content.text,
      'Other reply stays'
    );
    assert.equal(visible.replyCount, 1);
    await assert.rejects(
      commands.update(
        thread.id,
        { content: text, expectedRevision: visible.revision },
        { ...other, roles: ['admin'] },
        randomUUID(),
        target
      ),
      /denied|permission/i
    );
    await commands.reply(
      thread.id,
      { displayName: 'Other member', text: 'New reply after erasure' },
      other,
      randomUUID(),
      target
    );
    await project(thread.id);
    assert.equal(
      (await comments.read(target.id, thread.id, null)).replyCount,
      2
    );
    assert.equal(
      await materializeDiscussion(
        thread.id,
        { read: async () => beforeSnapshot },
        loader,
        store
      ),
      'superseded'
    );
    assert.equal(
      (await nodes.findOne({ _id: thread.id })).ownerIdentityId,
      null
    );
    assert.equal(
      (await nodes.findOne({ _id: thread.id })).payload.content.displayName,
      undefined
    );
    await migration.up(runner);
    await new DiscussionPayloads1791840004000().up(runner);
    assert.equal(
      (await participant.request(request)).state,
      'pending',
      'Canonical author removal cannot finish all-service erasure'
    );
    const retire = new RetireDiscussionPayloads(registry, objects);
    assert.ok((await retire.advance(request)) >= oldReferences.length);
    for (const { objectKey } of oldReferences)
      assert.equal(
        (await minio.getObjectSnapshot('discussion-content', objectKey, 100))
          .body.length,
        0
      );
    assert.equal((await readCopy(anonymous)).text, text.text);
    console.log(
      'PASS: exact pending/inventory authority, public and unlisted retention, private tombstones, retained replies/links, new replies, stale projection refusal, old-worker fencing and obsolete object retirement'
    );

    const crashOwner = { ...owner, identityId: 'CrashOwner' },
      crashRequest = { identityId: 'CrashOwner', revision: 7 };
    const crashNode = await create(crashOwner);
    await participant.request(crashRequest);
    let crash = true;
    const crashWorker = new AnonymizeDiscussionContributions(
      {
        next: (...args) => repository.next(...args),
        reserve: (...args) => repository.reserve(...args),
        commit: (...args) => {
          if (crash) {
            crash = false;
            throw new Error('crash after PUT');
          }
          return repository.commit(...args);
        },
      },
      payloads
    );
    await assert.rejects(crashWorker.advance(crashRequest), /crash after PUT/);
    const reserved = await source.query(
      "SELECT objectKey FROM discussion_payload_objects WHERE ownerIdentityId=? AND state='anonymizing'",
      [crashOwner.identityId]
    );
    assert.equal(reserved.length, 1);
    assert.equal(
      (await row(crashNode.id)).ownerIdentityId,
      crashOwner.identityId
    );
    assert.equal(
      await retire.advance(crashRequest),
      0,
      'A concurrent retirement phase cannot destroy the active anonymous copy'
    );
    const concurrentReply = await commands.reply(
      crashNode.id,
      { displayName: 'Other member', text: 'Reply during anonymous copy' },
      other,
      randomUUID(),
      target
    );
    await crashWorker.advance(crashRequest);
    assert.equal((await row(crashNode.id)).payloadKey, reserved[0].objectKey);
    assert.equal(
      (await row(concurrentReply.id)).ownerIdentityId,
      other.identityId
    );
    assert.equal((await writes.resource(crashNode.id)).revision, 3);
    assert.equal(
      (
        await source.query(
          'SELECT * FROM discussion_erasure_nodes WHERE identityId=?',
          [crashOwner.identityId]
        )
      ).length,
      1
    );

    const rollbackOwner = { ...owner, identityId: 'RollbackOwner' },
      rollbackRequest = { identityId: 'RollbackOwner', revision: 8 };
    const rollbackNode = await create(rollbackOwner);
    await participant.request(rollbackRequest);
    const rollbackBefore = await row(rollbackNode.id);
    const revisionBefore = (await writes.resource(rollbackNode.id)).revision;
    await source.query(
      "CREATE TRIGGER fail_erasure_outbox BEFORE INSERT ON discussion_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected outbox failure'"
    );
    try {
      await assert.rejects(
        worker.advance(rollbackRequest),
        /Injected outbox failure/
      );
    } finally {
      await source.query('DROP TRIGGER fail_erasure_outbox');
    }
    assert.deepEqual(await row(rollbackNode.id), rollbackBefore);
    assert.equal(
      (await writes.resource(rollbackNode.id)).revision,
      revisionBefore
    );
    assert.equal(
      (
        await source.query(
          'SELECT * FROM discussion_erasure_nodes WHERE identityId=?',
          [rollbackOwner.identityId]
        )
      ).length,
      0
    );
    await worker.advance(rollbackRequest);
    console.log(
      'PASS: immutable-copy crash replay and atomic rollback of author, pointer, revision and cleanup target when outbox insert fails'
    );

    for (const phase of ['reserve', 'commit']) {
      const raceOwner = { ...owner, identityId: `ModeratorRace-${phase}` },
        raceRequest = { identityId: raceOwner.identityId, revision: 9 };
      const raceNode = await create(raceOwner);
      await participant.request(raceRequest);
      const descriptor = await repository.next(raceRequest);
      const reference = {
        ...descriptor.payload,
        key: `discussions/${raceNode.id}/versions/${randomUUID()}.json`,
      };
      if (phase === 'commit')
        await repository.reserve(raceRequest, descriptor, reference);
      // Force the repeatable-read inventory snapshot to predate a committed moderation change.
      let inventoryRead;
      const observed = new Promise((resolve) => {
        inventoryRead = resolve;
      });
      const hooked = new MysqlDiscussionContributionErasure({
        transaction: (isolation, work) =>
          source.transaction(isolation, (tx) =>
            work(
              new Proxy(tx, {
                get(object, key) {
                  if (key === 'query')
                    return async (sql, ...args) => {
                      const result = await object.query(sql, ...args);
                      if (sql === 'SELECT * FROM discussion_payload_inventory')
                        inventoryRead();
                      return result;
                    };
                  return Reflect.get(object, key);
                },
              })
            )
          ),
      });
      const moderator = source.createQueryRunner();
      await moderator.connect();
      let attempt;
      try {
        await moderator.startTransaction();
        await moderator.query(
          'SELECT revision FROM discussion_write_aggregates WHERE id=? FOR UPDATE',
          [raceNode.id]
        );
        attempt = hooked[phase](raceRequest, descriptor, reference);
        const rejected = assert.rejects(attempt, /changed during erasure/);
        await observed;
        const deletedAt = Date.now();
        await moderator.query(
          'UPDATE content_nodes SET deletedAt=? WHERE id=?',
          [deletedAt, raceNode.id]
        );
        await moderator.query(
          'UPDATE discussion_write_aggregates SET revision=revision+1 WHERE id=?',
          [raceNode.id]
        );
        await moderator.commitTransaction();
        await rejected;
        await worker.advance(raceRequest);
        assert.equal(
          (
            await source.query(
              'SELECT deletedAt FROM content_nodes WHERE id=?',
              [raceNode.id]
            )
          )[0].deletedAt,
          String(deletedAt)
        );
        assert.equal((await row(raceNode.id)).payloadKey, null);
      } finally {
        if (moderator.isTransactionActive)
          await moderator.rollbackTransaction();
        await moderator.release();
        if (attempt) await attempt.catch(() => undefined);
      }
    }
    console.log(
      'PASS: real repeatable-read/aggregate-lock race cannot resurrect a concurrently moderated contribution'
    );

    const concurrentOwner = { ...owner, identityId: 'ConcurrentOwner' },
      concurrentRequest = { identityId: 'ConcurrentOwner', revision: 10 };
    const concurrentNode = await create(concurrentOwner);
    await participant.request(concurrentRequest);
    const startRevision = (await writes.resource(concurrentNode.id)).revision;
    await Promise.all([
      worker.advance(concurrentRequest),
      worker.advance(concurrentRequest),
    ]);
    assert.equal(
      (await writes.resource(concurrentNode.id)).revision,
      startRevision + 1
    );
    assert.equal(
      (
        await source.query(
          'SELECT * FROM discussion_erasure_nodes WHERE identityId=?',
          [concurrentOwner.identityId]
        )
      ).length,
      1
    );
    await migration.up(runner);
    assert.equal(
      (await participant.request(concurrentRequest)).state,
      'pending'
    );
    console.log(
      'PASS: concurrent canonical erasure retries converge at one revision and one durable projection-cleanup target; full participant remains pending'
    );

    const pausedOwner = { ...owner, identityId: 'PausedBeforeReservation' };
    const pausedRequest = { identityId: pausedOwner.identityId, revision: 11 };
    const pausedNode = await create(pausedOwner);
    await participant.request(pausedRequest);
    let loaded, resume;
    const loading = new Promise((resolve) => {
      loaded = resolve;
    });
    const resumed = new Promise((resolve) => {
      resume = resolve;
    });
    let puts = 0;
    const paused = new AnonymizeDiscussionContributions(repository, {
      read: async (...args) => {
        const content = await payloads.read(...args);
        loaded();
        await resumed;
        return content;
      },
      put: async (...args) => {
        puts++;
        await payloads.put(...args);
      },
    }).advance(pausedRequest);
    try {
      await loading;
      await commands.remove(
        pausedNode.id,
        1,
        { ...other, roles: ['admin'] },
        randomUUID(),
        target
      );
      await worker.advance(pausedRequest);
    } finally {
      resume();
    }
    await paused;
    assert.equal(
      puts,
      0,
      'A worker overtaken before reservation must not upload unregistered content'
    );
    assert.equal((await row(pausedNode.id)).ownerIdentityId, null);
    assert.equal((await row(pausedNode.id)).payloadKey, null);
    await retire.advance(pausedRequest);
    console.log(
      'PASS: a worker paused before reservation cannot create unregistered bytes after another worker tombstones its contribution'
    );
  } finally {
    await runner.release();
  }
};
