const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = '../../apps/services/community/src/app/discussions/';
const materializer =
  '../../sdk/features/discussion/applications/materializer/service/src/';
const {
  EraseDiscussionProjections,
} = require(`${root}application/erase-discussion-projections`);
const {
  MysqlDiscussionProjectionErasure,
} = require(`${root}infrastructure/mysql-discussion-projection-erasure`);
const {
  MongoDiscussionProjectionErasure,
} = require(`${root}infrastructure/mongo-discussion-projection-erasure`);
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
const {
  MysqlAccountErasureParticipant,
} = require('../../libs/adapters/account-mysql/src');

module.exports = async function qualifyDiscussionProjectionErasure({
  source,
  minio,
  mongo,
  pool,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const request = { identityId: 'ErasureOwner', revision: 4 };
  const repository = new MysqlDiscussionProjectionErasure(source);
  const nodes = mongo.db(source.options.database).collection('erasure_nodes');
  const heads = mongo.db(source.options.database).collection('erasure_heads');
  const legacy = mongo
    .db(source.options.database)
    .collection('legacy_erasure_nodes');
  const storage = new MongoDiscussionProjectionErasure(nodes, legacy);
  await storage.ensureIndexes();
  const cleanup = new EraseDiscussionProjections(repository, storage, true);
  const targets = await source.query(
    'SELECT * FROM discussion_erasure_nodes WHERE identityId=? ORDER BY nodeId',
    [request.identityId]
  );
  assert.ok(targets.length > 1);
  const first = targets[0];
  const sourceReader = new MysqlDiscussionSnapshotReader(pool);
  const payloadReader = new MinioImmutablePayloadReader(minio);
  const store = new MongoGenerationStore(nodes, heads);
  await store.ensureIndexes();
  const project = (id) =>
    materializeDiscussion(id, sourceReader, payloadReader, store);
  await nodes.deleteOne({ _id: first.nodeId });
  assert.equal(await cleanup.advance(request), 'pending');
  assert.equal((await repository.next(request)).nodeId, first.nodeId);
  for (const target of targets) await project(target.discussionId);
  const stable = await nodes.findOne({ _id: first.nodeId });
  assert.equal(stable.ownerIdentityId, null);
  await nodes.insertMany(
    Array.from({ length: 205 }, (_, index) => ({
      ...stable,
      _id: `old-${index}:${first.nodeId}`,
      schemaVersion: 2,
      revision: 1,
      ownerIdentityId: request.identityId,
      payload: {
        content: 'Historical private body',
        privateMetadata: request.identityId,
      },
    }))
  );
  await legacy.insertOne({
    _id: first.nodeId,
    payload: { content: 'Legacy private body' },
  });
  assert.equal(await cleanup.advance(request), 'pending');
  assert.equal(
    await nodes.countDocuments({ id: first.nodeId, schemaVersion: 2 }),
    105
  );
  assert.equal(await legacy.countDocuments({ _id: first.nodeId }), 0);
  assert.equal((await repository.next(request)).nodeId, first.nodeId);
  assert.equal(await cleanup.advance(request), 'pending');
  assert.equal(
    await nodes.countDocuments({ id: first.nodeId, schemaVersion: 2 }),
    5
  );
  const interrupted = new EraseDiscussionProjections(
    {
      next: (...args) => repository.next(...args),
      complete: async () => {
        throw new Error('SQL unavailable after Mongo cleanup');
      },
    },
    storage,
    true
  );
  await assert.rejects(interrupted.advance(request), /SQL unavailable/);
  assert.equal(
    await nodes.countDocuments({ id: first.nodeId, schemaVersion: 2 }),
    0
  );
  assert.equal((await repository.next(request)).nodeId, first.nodeId);
  await cleanup.advance(request);
  assert.deepEqual(
    await nodes.findOne({ _id: first.nodeId }),
    stable,
    'Permanent stable projection guards are never deleted'
  );
  const another = await repository.next(request);
  assert.ok(another);
  const saved = await nodes.findOne({ _id: another.nodeId });
  await nodes.updateOne(
    { _id: another.nodeId },
    { $set: { ownerIdentityId: request.identityId } }
  );
  await assert.rejects(cleanup.advance(request), /Invalid anonymous.*guard/);
  assert.equal((await repository.next(request)).nodeId, another.nodeId);
  await nodes.replaceOne({ _id: saved._id }, saved);
  while (await repository.next(request)) await cleanup.advance(request);
  assert.equal(
    (
      await source.query(
        'SELECT * FROM discussion_erasure_nodes WHERE identityId=?',
        [request.identityId]
      )
    ).length,
    0
  );
  console.log(
    'PASS: projection lag retains durable targets; 100-copy batches remove 205 historical versions; post-Mongo SQL failure replays; current anonymous records/tombstones survive; corrupt attribution blocks cleanup'
  );

  const oldOrphan = randomUUID();
  await nodes.insertOne({
    ...stable,
    _id: `orphan:${oldOrphan}`,
    id: oldOrphan,
    schemaVersion: 2,
    ownerIdentityId: request.identityId,
  });
  await legacy.insertMany(
    Array.from({ length: 105 }, () => ({
      _id: randomUUID(),
      payload: { content: 'Unowned old cache body' },
    }))
  );
  assert.equal(await cleanup.advance(request), 'pending');
  assert.equal(await legacy.countDocuments({}), 5);
  assert.equal(await cleanup.advance(request), 'pending');
  assert.equal(await legacy.countDocuments({}), 0);
  assert.equal(await cleanup.advance(request), 'pending');
  assert.equal(await nodes.countDocuments({ schemaVersion: 2 }), 0);
  const unaccounted = randomUUID();
  await nodes.insertOne({
    ...stable,
    _id: unaccounted,
    id: unaccounted,
    ownerIdentityId: request.identityId,
  });
  await assert.rejects(cleanup.advance(request), /Unaccounted.*attribution/);
  await nodes.deleteOne({ _id: unaccounted });
  const unknown = randomUUID();
  await nodes.insertOne({
    ...stable,
    _id: unknown,
    id: unknown,
    schemaVersion: 999,
  });
  await assert.rejects(cleanup.advance(request), /Unrecognized.*schema/);
  assert.ok(
    await nodes.findOne({ _id: unknown }),
    'Unknown formats must not be silently discarded'
  );
  await nodes.deleteOne({ _id: unknown });
  assert.equal(await cleanup.advance(request), 'drained');
  assert.equal(
    (
      await new MysqlAccountErasureParticipant('discussion', source).request(
        request
      )
    ).state,
    'pending'
  );
  assert.ok(
    await nodes.findOne({ ownerIdentityId: 'OtherMember' }),
    'Another member keeps their current projection'
  );
  await assert.rejects(
    new EraseDiscussionProjections(repository, storage, false).advance(request),
    /Drain and fence/
  );
  await assert.rejects(
    cleanup.advance({ ...request, revision: 5 }),
    /exact pending erasure/
  );
  console.log(
    'PASS: obsolete v1/v2 orphans drain in bounded batches, unknown schemas/current orphan attribution block, other members retain current records, and projection completion never finishes service erasure'
  );
};
