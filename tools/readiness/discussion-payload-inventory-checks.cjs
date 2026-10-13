const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const { DataSource } = require('typeorm');
const { S3Client, PutBucketVersioningCommand } = require('@aws-sdk/client-s3');
const root =
  '../../sdk/features/discussion/applications/management/service/src/app/discussions/';
const {
  InventoryDiscussionPayloads,
} = require(`${root}application/discussion-payload-inventory`);
const {
  RegisteredDiscussionPayloads,
} = require(`${root}application/registered-discussion-payloads`);
const {
  DurableDiscussionCommands,
} = require(`${root}application/durable-discussion-commands`);
const {
  MysqlDiscussionPayloadInventory,
} = require(`${root}infrastructure/mysql-discussion-payload-inventory`);
const {
  MinioDiscussionPayloadInventory,
} = require(`${root}infrastructure/minio-discussion-payload-inventory`);
const {
  MysqlDiscussionPayloads,
} = require(`${root}infrastructure/mysql-discussion-payloads`);
const {
  MysqlDiscussionWrites,
} = require(`${root}infrastructure/mysql-discussion-writes`);
const {
  MinioDiscussionPayloadObjects,
} = require(`${root}infrastructure/immutable-discussion-payloads`);
const {
  DiscussionPayloadInventory1791840005000,
} = require(`${root}infrastructure/discussion-payload-inventory.migration`);
const {
  MysqlDiscussionAccountExportSource,
} = require(`${root}infrastructure/mysql-discussion-account-export-source`);
const {
  MinioDiscussionExportPayloads,
} = require(`${root}infrastructure/discussion-export-payloads`);
const {
  MysqlAccountErasureParticipant,
} = require('../../sdk/features/identity/packages/infrastructure/mysql/src');

module.exports = async function qualifyDiscussionPayloadInventory({
  source,
  minio,
  uploaded,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const repository = new MysqlDiscussionPayloadInventory(source);
  const objects = new MinioDiscussionPayloadInventory(minio);
  const inventory = new InventoryDiscussionPayloads(repository, objects);
  const registry = new MysqlDiscussionPayloads(source);
  const owner = {
    identityId: 'InventoryOwner',
    tenantId: 'default',
    roles: ['admin'],
  };
  const eraseOwner = { ...owner, identityId: 'InventoryErase' };
  const payloadObjects = new MinioDiscussionPayloadObjects(minio);
  const commands = new DurableDiscussionCommands(
    new MysqlDiscussionWrites(source),
    new RegisteredDiscussionPayloads(registry, {
      put: async (reference, body) => {
        uploaded.push(reference.key);
        await payloadObjects.put(reference, body);
      },
      retire: (reference) => payloadObjects.retire(reference),
    }),
    { evaluate: async () => ({ ok: true, value: true }) },
    { generate: randomUUID }
  );
  const node = await commands.create(
    { content: 'Preserve current public body' },
    owner,
    randomUUID()
  );
  const eraseNode = await commands.create(
    { content: 'Preserve erased owner public contribution' },
    eraseOwner,
    randomUUID()
  );
  const before = await source.query(
    'SELECT * FROM discussion_outbox ORDER BY id'
  );
  const body = Buffer.from(
    JSON.stringify({ content: 'Historical private body', private: 'metadata' })
  );
  const keyFor = (id = node.id) =>
    `discussions/${id}/versions/${randomUUID()}.json`;
  const put = async (key, bytes = body) => {
    uploaded.push(key);
    await minio.putImmutableBytes('discussion-content', key, bytes);
    return key;
  };
  const snapshot = async (key) => {
    const stored = await minio.getObjectSnapshot(
      'discussion-content',
      key,
      1024
    );
    return {
      key,
      etag: stored.etag,
      bytes: stored.body.length,
      decision: await repository.classify(key),
    };
  };
  const reference = (key, bytes = body) => ({
    key,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  const rowsFor = (key) =>
    source.query('SELECT * FROM discussion_payload_objects WHERE objectKey=?', [
      key,
    ]);
  const scope = (member = owner) => ({
    ownerIdentityId: member.identityId,
    actorIdentityId: null,
    tenantId: member.tenantId,
  });

  const migration = new DiscussionPayloadInventory1791840005000();
  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    await migration.up(runner);
    const checkpoint = (
      await source.query('SELECT * FROM discussion_payload_inventory')
    )[0];
    await source.query('DELETE FROM discussion_payload_inventory');
    await assert.rejects(
      migration.up(runner),
      /Applied.*checkpoint is missing/
    );
    await source.query(
      'INSERT INTO discussion_payload_inventory (id,revision,afterKey,completedAt,legacyWritersStoppedAt,lastPlanHash) VALUES (?,?,?,?,?,?)',
      [
        checkpoint.id,
        checkpoint.revision,
        checkpoint.afterKey,
        checkpoint.completedAt,
        checkpoint.legacyWritersStoppedAt,
        checkpoint.lastPlanHash,
      ]
    );
    await source.query('UPDATE discussion_payload_inventory SET afterKey=?', [
      'unrecognized',
    ]);
    await assert.rejects(migration.up(runner), /Invalid.*checkpoint/);
    await source.query(
      "UPDATE discussion_payload_inventory SET afterKey='' WHERE id=1"
    );
    await source.query(
      'RENAME TABLE discussion_payload_inventory TO saved_inventory_checkpoint'
    );
    try {
      await assert.rejects(migration.up(runner), /Applied.*table is missing/);
    } finally {
      await source.query(
        'RENAME TABLE saved_inventory_checkpoint TO discussion_payload_inventory'
      );
    }
    await source.query(
      'CREATE UNIQUE INDEX unexpected_inventory_key ON discussion_payload_inventory (revision)'
    );
    try {
      await assert.rejects(migration.up(runner), /Incompatible.*schema/);
    } finally {
      await source.query(
        'DROP INDEX unexpected_inventory_key ON discussion_payload_inventory'
      );
    }
    await migration.up(runner);
    await assert.rejects(migration.down(), /data-preserving rollback/);
  } finally {
    await runner.release();
  }
  await repository.exclusive(async () => {
    const competing = new MysqlDiscussionPayloadInventory(source);
    await assert.rejects(
      competing.exclusive(async () => undefined),
      /already running/
    );
  });

  const missingRegistry = (
    await source.query(
      'SELECT * FROM discussion_payload_objects WHERE nodeId=?',
      [node.id]
    )
  )[0];
  await source.query(
    'DELETE FROM discussion_payload_objects WHERE objectKey=?',
    [missingRegistry.objectKey]
  );
  try {
    await assert.rejects(
      repository.classify(missingRegistry.objectKey),
      /no valid registration/
    );
  } finally {
    await source.query(
      'INSERT INTO discussion_payload_objects (objectKey,nodeId,ownerIdentityId,actorIdentityId,tenantId,sha256,bytes,state,registeredAt,retiredAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [
        missingRegistry.objectKey,
        missingRegistry.nodeId,
        missingRegistry.ownerIdentityId,
        missingRegistry.actorIdentityId,
        missingRegistry.tenantId,
        missingRegistry.sha256,
        missingRegistry.bytes,
        missingRegistry.state,
        missingRegistry.registeredAt,
        missingRegistry.retiredAt,
      ]
    );
  }

  const unknownKey = await put('unknown-private-object');
  assert.equal((await repository.classify(unknownKey)).kind, 'blocked');
  await minio.deleteObject('discussion-content', unknownKey);
  const unownedId = '00000000-0000-0000-0000-000000000001';
  const legacyUnowned = await put(`discussions/${unownedId}/content`);
  await source.query(
    "INSERT INTO content_nodes (id,referenceKey,kind,state,visibility,createdAt) VALUES (?,?,'discussion','published','public',1)",
    [unownedId, randomUUID()]
  );
  const blocked = await inventory.plan();
  assert.equal(blocked.items[0].decision.kind, 'blocked');
  await assert.rejects(
    inventory.apply(blocked.fingerprint, true),
    /ownership backfill/
  );
  assert.equal((await repository.progress()).after, '');
  assert.deepEqual(
    await minio.getBytes('discussion-content', legacyUnowned, 1024),
    body
  );
  await source.query('DELETE FROM content_nodes WHERE id=?', [unownedId]);

  const mutable = await put(`discussions/${node.id}/content`);
  const legacyItem = await snapshot(mutable);
  const copied = reference(keyFor());
  await repository.exclusive(() => repository.prepareCopy(legacyItem, copied));
  assert.equal((await rowsFor(copied.key))[0].state, 'reserved');
  await assert.rejects(
    repository.exclusive(() =>
      repository.retire(legacyItem, () => objects.retire(legacyItem), copied)
    ),
    /differs from its reservation/
  );
  uploaded.push(copied.key);
  await objects.copy(copied, body);
  await repository.exclusive(() => repository.prepareCopy(legacyItem, copied));
  await objects.copy(copied, body);
  await repository.exclusive(() => repository.confirmCopy(legacyItem, copied));
  assert.equal((await rowsFor(copied.key))[0].state, 'uploaded');
  // Simulate the crash after the marker succeeds but before the SQL callback completes.
  await assert.rejects(
    repository.exclusive(() =>
      repository.retire(
        legacyItem,
        async () => {
          await objects.retire(legacyItem);
          throw new Error('lost marker response');
        },
        copied
      )
    ),
    /lost marker response/
  );
  assert.equal((await snapshot(mutable)).bytes, 0);
  assert.deepEqual(
    await minio.getBytes('discussion-content', copied.key, 1024),
    body
  );

  const changedKey = await put(keyFor(randomUUID()));
  const changed = await snapshot(changedKey);
  const relationId = randomUUID();
  const changedNode = changed.decision.nodeId;
  await source.query(
    'INSERT INTO content_node_relations (id,fromContentId,toContentId,relationType,createdAt) VALUES (?,?,?,?,?)',
    [relationId, node.id, changedNode, 'replies', Date.now()]
  );
  try {
    assert.equal((await repository.classify(changedKey)).kind, 'blocked');
  } finally {
    await source.query('DELETE FROM content_node_relations WHERE id=?', [
      relationId,
    ]);
  }
  await minio.uploadJson('discussion-content', changedKey, {
    content: 'New generation',
  });
  await assert.rejects(
    repository.exclusive(() =>
      repository.retire(changed, () => objects.retire(changed))
    ),
    /generation changed/
  );
  assert.match(
    (await minio.getBytes('discussion-content', changedKey, 1024)).toString(),
    /New generation/
  );

  const racingId = randomUUID(),
    racingKey = await put(keyFor(racingId));
  const staleOrphan = await snapshot(racingKey);
  await registry.reserve(racingId, reference(racingKey), scope());
  let markerCalled = false;
  await assert.rejects(
    repository.exclusive(() =>
      repository.retire(staleOrphan, async () => {
        markerCalled = true;
      })
    ),
    /authority changed/
  );
  assert.equal(markerCalled, false);
  assert.deepEqual(
    await minio.getBytes('discussion-content', racingKey, 1024),
    body
  );

  const lockedId = randomUUID(),
    lockedKey = await put(keyFor(lockedId));
  const lockedItem = await snapshot(lockedKey);
  const contender = new DataSource({
    ...source.options,
    migrations: [],
    extra: { connectionLimit: 1 },
  });
  await contender.initialize();
  try {
    await contender.query('SET SESSION innodb_lock_wait_timeout=1');
    const competingRegistry = new MysqlDiscussionPayloads(contender);
    await repository.exclusive(() =>
      repository.retire(lockedItem, async () => {
        await assert.rejects(
          competingRegistry.reserve(lockedId, reference(lockedKey), scope()),
          /lock wait timeout/i
        );
        await objects.retire(lockedItem);
      })
    );
    await competingRegistry.reserve(lockedId, reference(lockedKey), scope());
    await assert.rejects(
      objects.copy(reference(lockedKey), body),
      /differs from its durable reservation/
    );
  } finally {
    await contender.destroy();
  }

  const erasedLegacy = await put(`discussions/${eraseNode.id}/content`);
  const erasedItem = await snapshot(erasedLegacy);
  const lateCopy = reference(keyFor(eraseNode.id));
  await repository.exclusive(() =>
    repository.prepareCopy(erasedItem, lateCopy)
  );
  const erasure = new MysqlAccountErasureParticipant('discussion', source);
  await erasure.request({ identityId: eraseOwner.identityId, revision: 3 });
  uploaded.push(lateCopy.key);
  await objects.copy(lateCopy, body);
  await assert.rejects(
    repository.exclusive(() => repository.confirmCopy(erasedItem, lateCopy)),
    /erasure prevents this write/
  );
  assert.equal((await rowsFor(lateCopy.key))[0].state, 'reserved');
  assert.equal((await repository.classify(erasedLegacy)).kind, 'retire-erased');

  const historic = [];
  for (let i = 0; i < 34; i++) historic.push(await put(keyFor()));
  // Keep a valid unretired mutable source to exercise the application's deterministic-copy path.
  const secondNode = await commands.create(
    { content: 'Another current body' },
    owner,
    randomUUID()
  );
  const secondLegacy = await put(`discussions/${secondNode.id}/content`);
  const beforeInventory = await source.query(
    'SELECT * FROM discussion_outbox ORDER BY id'
  );
  const invoke = async (...args) => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        path.resolve(
          'dist/sdk/features/discussion/applications/management/main.js'
        ),
        ...args,
      ],
      {
        timeout: 20_000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          DISCUSSION_DATABASE_HOST: source.options.host,
          DISCUSSION_DATABASE_PORT: String(source.options.port),
          DISCUSSION_DATABASE_USERNAME: source.options.username,
          DISCUSSION_DATABASE_PASSWORD: source.options.password,
          DISCUSSION_DATABASE_NAME: source.options.database,
          DISCUSSION_STORAGE_HOST: `http://127.0.0.1:${process.env.DISCUSSION_TEST_MINIO_PORT}`,
          DISCUSSION_STORAGE_ACCESSKEY:
            process.env.DISCUSSION_TEST_MINIO_USERNAME ?? 'wapps',
          DISCUSSION_STORAGE_SECRETKEY: process.env.LOCAL_PASSWORD,
        },
      }
    );
    return JSON.parse(
      stdout
        .trim()
        .split('\n')
        .findLast((line) => line.startsWith('{'))
    );
  };
  assert.equal((await invoke('--migrate')).migrated.length, 0);
  let batches = 0;
  let lastPlan;
  for (;;) {
    const plan = await invoke('--inventory-payloads');
    assert.equal(plan.status, 'planned');
    assert.ok(plan.items.length <= 32);
    lastPlan = plan;
    const result = await invoke(
      '--inventory-payloads',
      '--apply',
      plan.fingerprint,
      '--legacy-writers-stopped'
    );
    assert.equal(result.status, 'applied');
    batches++;
    if (result.progress.completedAt !== null) break;
    assert.ok(batches < 15, 'Inventory must converge within its bounded pages');
  }
  assert.ok(batches > 1);
  const complete = await repository.progress();
  assert.equal(
    (
      await invoke(
        '--inventory-payloads',
        '--apply',
        lastPlan.fingerprint,
        '--legacy-writers-stopped'
      )
    ).progress.revision,
    complete.revision
  );
  assert.equal((await inventory.plan()).items.length, 0);
  assert.ok(complete.legacyWritersStoppedAt > 0);
  for (const key of historic) {
    const [record] = await rowsFor(key);
    assert.equal(record.ownerIdentityId, owner.identityId);
    assert.equal(record.actorIdentityId, null);
    assert.equal(record.state, 'uploaded');
    assert.deepEqual(
      await minio.getBytes('discussion-content', key, 1024),
      body
    );
  }
  for (const key of [
    legacyUnowned,
    mutable,
    changedKey,
    lockedKey,
    erasedLegacy,
    secondLegacy,
  ])
    assert.equal(
      (await minio.getBytes('discussion-content', key, 1024)).length,
      0
    );
  const [preservedCopy] = await source.query(
    "SELECT * FROM discussion_payload_objects WHERE nodeId=? AND state='uploaded'",
    [secondNode.id]
  );
  uploaded.push(preservedCopy.objectKey);
  assert.deepEqual(
    await minio.getBytes('discussion-content', preservedCopy.objectKey, 1024),
    body
  );
  assert.deepEqual(
    await source.query('SELECT * FROM discussion_outbox ORDER BY id'),
    beforeInventory
  );
  assert.equal(beforeInventory.length, before.length + 1);
  assert.equal(
    (await erasure.request({ identityId: eraseOwner.identityId, revision: 3 }))
      .state,
    'pending'
  );
  const [current] = await source.query(
    'SELECT payloadKey FROM discussion_write_nodes WHERE nodeId=?',
    [eraseNode.id]
  );
  assert.match(
    (
      await minio.getBytes('discussion-content', current.payloadKey, 1024)
    ).toString(),
    /Preserve erased owner public contribution/
  );
  // Remove only the intentionally impossible post-retirement upload fixture before checking real export.
  await source.query(
    'DELETE FROM discussion_payload_objects WHERE objectKey=?',
    [lockedKey]
  );
  const exported = [];
  for await (const row of new MysqlDiscussionAccountExportSource(
    source,
    new MinioDiscussionExportPayloads(minio)
  ).capture(owner.identityId, new AbortController().signal))
    exported.push(row);
  const versions = exported.filter(
    (row) => row.type === 'record' && row.collection === 'payload-versions'
  );
  assert.ok(versions.length >= historic.length + 3);
  assert.ok(
    versions.some((row) =>
      JSON.stringify(row.data).includes('Historical private body')
    )
  );
  const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: `http://127.0.0.1:${process.env.DISCUSSION_TEST_MINIO_PORT}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.DISCUSSION_TEST_MINIO_USERNAME ?? 'wapps',
      secretAccessKey: process.env.LOCAL_PASSWORD,
    },
  });
  try {
    for (const Status of ['Enabled', 'Suspended']) {
      await s3.send(
        new PutBucketVersioningCommand({
          Bucket: 'discussion-content',
          VersioningConfiguration: { Status },
        })
      );
      await assert.rejects(inventory.plan(), /unversioned bucket/);
    }
  } finally {
    s3.destroy();
  }
  console.log(
    'PASS: reviewed inventory CLI, strict migration/re-entry/loss checks, advisory exclusion, 32-object paging/replay, owned history export, legacy copy crash recovery, unresolved ownership preservation, generation drift, SQL registration gaps and erasure races; current public content/outbox remain unchanged and erasure stays pending'
  );
};
