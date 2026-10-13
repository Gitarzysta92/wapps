const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
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
  MysqlDiscussionWrites,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/mysql-discussion-writes');
const {
  MysqlDiscussionPayloads,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/mysql-discussion-payloads');
const {
  MinioDiscussionPayloadObjects,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/immutable-discussion-payloads');
const {
  MinioDiscussionExportPayloads,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/discussion-export-payloads');
const {
  MysqlDiscussionAccountExportSource,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/mysql-discussion-account-export-source');

async function collect(values) {
  const rows = [];
  for await (const row of values) rows.push(row);
  return rows;
}
const records = (rows, collection) =>
  rows
    .filter((row) => row.type === 'record' && row.collection === collection)
    .map((row) => row.data);
const signal = () => new AbortController().signal;

module.exports = async function qualifyDiscussionExportHistory({
  source,
  minio,
  uploaded,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const owner = {
    identityId: 'HistoryOwner',
    tenantId: 'default',
    roles: ['admin'],
  };
  const other = { ...owner, identityId: 'HistoryOther' };
  const staff = { ...owner, identityId: 'HistoryStaff' };
  const scope = (member = owner, actor = member.identityId) => ({
    ownerIdentityId: member.identityId,
    actorIdentityId: actor,
    tenantId: member.tenantId,
  });
  const registry = new MysqlDiscussionPayloads(source);
  const objects = new MinioDiscussionPayloadObjects(minio);
  const writer = new RegisteredDiscussionPayloads(registry, {
    put: async (reference, body) => {
      uploaded.push(reference.key);
      await objects.put(reference, body);
    },
    retire: (reference) => objects.retire(reference),
  });
  const writes = new MysqlDiscussionWrites(source);
  const commands = new DurableDiscussionCommands(
    writes,
    writer,
    { evaluate: async () => ({ ok: true, value: true }) },
    { generate: randomUUID }
  );
  const exportedObjects = new MinioDiscussionExportPayloads(minio);
  const exporter = new MysqlDiscussionAccountExportSource(
    source,
    exportedObjects
  );
  const capture = (member = owner) =>
    collect(exporter.capture(member.identityId, signal()));
  const bytes = (content) =>
    Buffer.from(
      JSON.stringify({ content, internal: 'Private envelope metadata' })
    );
  const reserve = async (content, member = owner) => {
    const nodeId = randomUUID(),
      body = bytes(content);
    const reference = {
      key: `discussions/${nodeId}/versions/${randomUUID()}.json`,
      sha256: createHash('sha256').update(body).digest('hex'),
      bytes: body.length,
    };
    await registry.reserve(nodeId, reference, scope(member));
    uploaded.push(reference.key);
    return { nodeId, reference, body };
  };
  const root = await commands.create(
    { content: 'Historical first body' },
    owner,
    randomUUID()
  );
  const [original] = await source.query(
    'SELECT payloadKey, payloadHash, payloadBytes FROM discussion_write_nodes WHERE nodeId=?',
    [root.id]
  );
  const originalBytes = await minio.getBytes(
    'discussion-content',
    original.payloadKey,
    Number(original.payloadBytes)
  );
  await commands.update(
    root.id,
    {
      content: 'Current staff-edited owner body',
      expectedRevision: root.revision,
    },
    staff,
    randomUUID()
  );
  const absent = await reserve('Upload not yet present');
  const lost = await reserve('Uploaded with lost confirmation');
  await objects.put(lost.reference, lost.body);
  const orphan = await writer.put(
    randomUUID(),
    bytes('Uncommitted own body'),
    scope()
  );
  await writer.put(
    randomUUID(),
    bytes('Unknown importer body'),
    scope(owner, null)
  );
  await writer.put(
    randomUUID(),
    bytes('Private foreign-owner uploaded bytes'),
    scope(other, owner.identityId)
  );

  const iterator = exporter
    .capture(owner.identityId, signal())
    [Symbol.asyncIterator]();
  assert.equal((await iterator.next()).value.type, 'begin');
  await writer.put(
    randomUUID(),
    bytes('Registered after capture began'),
    scope()
  );
  const rows = await collect({ [Symbol.asyncIterator]: () => iterator });
  const versions = records(rows, 'payload-versions');
  assert.equal(versions.length, 6);
  assert.deepEqual(
    versions
      .filter((row) => row.nodeId === root.id)
      .map((row) => row.current)
      .sort(),
    [false, true]
  );
  assert.equal(
    versions.find((row) => row.nodeId === root.id && row.current).uploadedBy,
    'other'
  );
  assert.equal(
    versions.find((row) => row.nodeId === absent.nodeId).storage,
    'not-observed'
  );
  assert.equal(
    versions.find((row) => row.nodeId === absent.nodeId).state,
    'reserved'
  );
  assert.equal(
    versions.find((row) => row.nodeId === lost.nodeId).storage,
    'present'
  );
  assert.equal(
    versions.find((row) => row.nodeId === lost.nodeId).content,
    'Uploaded with lost confirmation'
  );
  assert.ok(
    versions.some(
      (row) =>
        row.content === 'Uncommitted own body' && row.state === 'uploaded'
    )
  );
  assert.equal(
    versions.find((row) => row.content === 'Unknown importer body').uploadedBy,
    'unknown'
  );
  assert.equal(records(rows, 'payload-uploads').length, 1);
  assert.equal('current' in records(rows, 'payload-uploads')[0], false);
  for (const privateValue of [
    'Private foreign-owner uploaded bytes',
    'Private envelope metadata',
    staff.identityId,
    other.identityId,
    'Registered after capture began',
    original.payloadKey,
  ])
    assert.equal(
      JSON.stringify(rows).includes(privateValue),
      false,
      privateValue
    );
  const staffRows = await capture(staff);
  assert.equal(records(staffRows, 'payload-uploads').length, 1);
  assert.equal(records(staffRows, 'payload-versions').length, 0);
  assert.equal(
    JSON.stringify(staffRows).includes('Current staff-edited owner body'),
    false
  );
  assert.equal(JSON.stringify(staffRows).includes(owner.identityId), false);
  assert.equal(
    (await capture({ ...owner, identityId: 'historyOwner' })).length,
    2
  );
  assert.equal(records(await capture(), 'payload-versions').length, 7);
  console.log(
    'PASS: Discussion export includes registered historical/uncommitted and lost-confirmation bytes, observes absent reservations, preserves one SQL snapshot, and exports uploader-only metadata without foreign identities/content'
  );

  await minio.deleteObject('discussion-content', original.payloadKey);
  try {
    await assert.rejects(capture(), /Confirmed discussion object is missing/);
  } finally {
    await minio.putImmutableBytes(
      'discussion-content',
      original.payloadKey,
      originalBytes
    );
  }
  const orphanBytes = await minio.getBytes(
    'discussion-content',
    orphan.key,
    orphan.bytes
  );
  await minio.uploadJson('discussion-content', orphan.key, {
    content: 'Corrupted obsolete body',
  });
  try {
    await assert.rejects(capture(), /integrity|size limit/);
  } finally {
    await minio.deleteObject('discussion-content', orphan.key);
    await minio.putImmutableBytes(
      'discussion-content',
      orphan.key,
      orphanBytes
    );
  }
  const missingBucketOwner = {
    ...owner,
    identityId: 'MissingBucketReservation',
  };
  await reserve('Reserved only', missingBucketOwner);
  const unavailable = new MysqlDiscussionAccountExportSource(
    source,
    new MinioDiscussionExportPayloads({
      getBytes: (_bucket, ...args) =>
        minio.getBytes(`absent-export-bucket-${randomUUID()}`, ...args),
    })
  );
  await assert.rejects(
    collect(unavailable.capture(missingBucketOwner.identityId, signal())),
    (error) => error.name === 'NoSuchBucket'
  );
  console.log(
    'PASS: missing/corrupt obsolete confirmed bytes fail export even when current content is intact; a real missing bucket is not accepted as an absent reservation'
  );

  const erased = { ...owner, identityId: 'RetirementHistoryOwner' };
  await writer.put(
    randomUUID(),
    bytes('Retire while export holds old authority'),
    scope(erased)
  );
  const oldCapture = exporter
    .capture(erased.identityId, signal())
    [Symbol.asyncIterator]();
  assert.equal((await oldCapture.next()).value.type, 'begin');
  const request = { identityId: erased.identityId, revision: 4 };
  await new MysqlAccountErasureParticipant('discussion', source).request(
    request
  );
  await registry.retiring(request);
  await assert.rejects(capture(erased), /retirement is still pending/);
  await new RetireDiscussionPayloads(registry, objects).advance(request);
  await assert.rejects(
    collect({ [Symbol.asyncIterator]: () => oldCapture }),
    /integrity/
  );
  const retired = records(await capture(erased), 'payload-versions');
  assert.equal(retired.length, 1);
  assert.equal(retired[0].state, 'retired');
  assert.equal(retired[0].storage, 'retired');
  assert.equal(retired[0].content, null);
  assert.ok(retired[0].retiredAt);
  console.log(
    'PASS: retirement in progress cannot finish capture; a marker replacing old snapshot bytes fails that attempt, and a fresh capture includes only completed-retirement metadata'
  );
};
