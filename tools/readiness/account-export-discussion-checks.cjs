const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  DurableDiscussionCommands,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/application/durable-discussion-commands');
const {
  MysqlDiscussionWrites,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/mysql-discussion-writes');
const {
  MinioDiscussionPayloadObjects,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/immutable-discussion-payloads');
const {
  MysqlDiscussionPayloads,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/mysql-discussion-payloads');
const {
  RegisteredDiscussionPayloads,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/application/registered-discussion-payloads');
const {
  MinioDiscussionExportPayloads,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/discussion-export-payloads');
const {
  MysqlDiscussionAccountExportSource,
} = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/mysql-discussion-account-export-source');
const {
  MysqlReviews,
} = require('../../sdk/features/discussion/applications/management/service/src/app/reviews/infrastructure/mysql-reviews');
const {
  ApplicationReviews,
} = require('../../sdk/features/discussion/applications/management/service/src/app/reviews/application/application-reviews');

async function collect(iterable) {
  const values = [];
  for await (const value of iterable) values.push(value);
  return values;
}
const signal = () => new AbortController().signal;
const data = (records, collection) =>
  records
    .filter((row) => row.type === 'record' && row.collection === collection)
    .map((row) => row.data);

async function qualifyDiscussionAccountExport({ source, minio, uploaded }) {
  const owner = {
    identityId: 'ExportDiscussionOwner',
    tenantId: 'default',
    roles: ['discussion:writer'],
  };
  const foreign = { ...owner, identityId: 'ExportDiscussionForeign' };
  const otherTenant = { ...owner, tenantId: 'other' };
  const moderator = {
    ...foreign,
    identityId: 'ExportDiscussionModerator',
    roles: ['admin'],
  };
  const policy = { evaluate: async () => ({ ok: true, value: true }) };
  const immutable = new RegisteredDiscussionPayloads(
    new MysqlDiscussionPayloads(source),
    new MinioDiscussionPayloadObjects(minio)
  );
  const payloads = {
    put: async (...args) => {
      const ref = await immutable.put(...args);
      uploaded.push(ref.key);
      return ref;
    },
  };
  const writes = new MysqlDiscussionWrites(source);
  const commands = new DurableDiscussionCommands(
    writes,
    payloads,
    policy,
    { generate: randomUUID },
    { visible: async () => true }
  );
  const root = await commands.create(
    { content: 'Original own content' },
    owner,
    randomUUID()
  );
  const outside = await commands.create(
    { content: 'Foreign private root text' },
    foreign,
    randomUUID()
  );
  const child = await commands.reply(
    outside.id,
    'My reply inside a private thread',
    owner,
    randomUUID()
  );
  await commands.like(child.id, true, owner, randomUUID());
  await commands.reply(
    root.id,
    'Foreign reply text must stay private',
    foreign,
    randomUUID()
  );
  await commands.update(
    root.id,
    {
      expectedRevision: (await writes.resource(root.id)).revision,
      content: 'Original own content',
      state: 'draft',
      visibility: 'private',
    },
    owner,
    randomUUID()
  );
  await commands.update(
    outside.id,
    {
      expectedRevision: (await writes.resource(outside.id)).revision,
      content: 'Foreign private root text',
      visibility: 'private',
    },
    foreign,
    randomUUID()
  );
  const deleted = await commands.create(
    { content: 'Retained removed own content' },
    owner,
    randomUUID()
  );
  await commands.remove(deleted.id, deleted.revision, owner, randomUUID());
  const tenantRoot = await commands.create(
    { content: 'Own other-tenant text', visibility: 'unlisted' },
    otherTenant,
    randomUUID()
  );
  for (let index = 0; index < 130; index++)
    await commands.create(
      { content: `Paged own contribution ${index}` },
      owner,
      randomUUID()
    );
  const target = { kind: 'application', id: randomUUID() };
  const bound = await commands.create(
    {
      target,
      subjectId: target.id,
      content: {
        title: 'Foreign topic',
        text: 'Foreign topic text',
        displayName: 'Foreign member',
        tags: [],
      },
    },
    foreign,
    randomUUID()
  );
  await commands.vote(
    bound.id,
    { expectedRevision: bound.revision, value: -1 },
    owner,
    randomUUID(),
    target
  );
  const identifiers = {
    next: randomUUID,
    fingerprint: (value) => createHash('sha256').update(value).digest('hex'),
  };
  const reviewRepository = new MysqlReviews(source);
  const reviews = new ApplicationReviews(
    reviewRepository,
    { visible: async () => true },
    policy,
    identifiers,
    'default'
  );
  const app = randomUUID();
  const content = {
    displayName: 'Export reviewer',
    rating: 4,
    text: 'Review history 0',
  };
  let review = await reviews.change(
    app,
    null,
    'publish',
    { expectedRevision: 0, content },
    owner,
    randomUUID()
  );
  for (let index = 1; index < 130; index++)
    review = await reviews.change(
      app,
      null,
      'publish',
      {
        expectedRevision: review.revision,
        content: { ...content, text: `Review history ${index}` },
      },
      owner,
      randomUUID()
    );
  review = await reviews.change(
    app,
    review.id,
    'withdraw',
    { expectedRevision: review.revision },
    owner,
    randomUUID()
  );
  review = await reviews.change(
    app,
    review.id,
    'moderate',
    {
      expectedRevision: review.revision,
      hidden: true,
      reason: 'Author-visible moderation reason',
    },
    moderator,
    randomUUID()
  );
  let foreignReview = await reviews.change(
    app,
    null,
    'publish',
    {
      expectedRevision: 0,
      content: { ...content, text: 'Foreign review text must not be copied' },
    },
    foreign,
    randomUUID()
  );
  foreignReview = await reviews.change(
    app,
    foreignReview.id,
    'helpful',
    { expectedRevision: foreignReview.revision, helpful: true },
    owner,
    randomUUID()
  );
  foreignReview = await reviews.change(
    app,
    foreignReview.id,
    'report',
    { expectedRevision: foreignReview.revision, reason: 'My own report' },
    owner,
    randomUUID()
  );
  await reviews.change(
    app,
    foreignReview.id,
    'moderate',
    {
      expectedRevision: foreignReview.revision,
      hidden: true,
      reason: 'Private staff report resolution',
    },
    moderator,
    randomUUID()
  );
  const otherReviews = new ApplicationReviews(
    reviewRepository,
    { visible: async () => true },
    policy,
    identifiers,
    'other'
  );
  await otherReviews.change(
    app,
    null,
    'publish',
    {
      expectedRevision: 0,
      content: { ...content, text: 'Own review in another tenant' },
    },
    otherTenant,
    randomUUID()
  );

  const objects = new MinioDiscussionExportPayloads(minio);
  const reads = [];
  const exportSource = new MysqlDiscussionAccountExportSource(source, {
    read: async (...args) => {
      reads.push(args[0]);
      return objects.read(...args);
    },
    observe: (...args) => objects.observe(...args),
  });
  const iterator = exportSource
    .capture(owner.identityId, signal())
    [Symbol.asyncIterator]();
  const first = await iterator.next();
  assert.equal(first.value.type, 'begin');
  await commands.update(
    root.id,
    {
      expectedRevision: (await writes.resource(root.id)).revision,
      content: 'Edited during capture',
    },
    owner,
    randomUUID()
  );
  await commands.create(
    { content: 'Created after snapshot' },
    owner,
    randomUUID()
  );
  const during = await collect({ [Symbol.asyncIterator]: () => iterator });
  const contributions = data(during, 'contributions');
  assert.equal(
    contributions.length,
    134,
    'Keyset pagination spans more than 128 distinct threads and all owner tenants'
  );
  assert.equal(new Set(contributions.map((row) => row.id)).size, 134);
  assert.equal(
    contributions.find((row) => row.id === root.id).content,
    'Original own content'
  );
  assert.equal(
    contributions.find((row) => row.id === child.id).parentId,
    outside.id
  );
  assert.equal(
    contributions.find((row) => row.id === child.id).content,
    'My reply inside a private thread'
  );
  assert.equal(
    contributions.find((row) => row.id === tenantRoot.id).tenantId,
    'other'
  );
  assert.equal(
    contributions.find((row) => row.id === deleted.id).content,
    null
  );
  assert.ok(contributions.find((row) => row.id === deleted.id).deletedAt);
  assert.equal(reads.includes(outside.id), false);
  assert.equal(reads.includes(deleted.id), true);
  const versions = data(during, 'payload-versions');
  assert.equal(
    versions.length,
    135,
    'All owned registered versions span keyset pages, including replaced and removed content'
  );
  assert.equal(versions.filter((row) => row.nodeId === root.id).length, 2);
  assert.equal(
    versions.find((row) => row.nodeId === deleted.id).content,
    'Retained removed own content'
  );
  assert.equal(
    versions.find((row) => row.nodeId === deleted.id).current,
    false
  );
  assert.equal(
    versions.some(
      (row) =>
        row.content === 'Created after snapshot' ||
        row.content === 'Edited during capture'
    ),
    false
  );
  assert.equal(reads.includes(bound.id), false);
  assert.equal(
    data(during, 'review-versions').length,
    131,
    'Every retained owner review version is captured across batches'
  );
  assert.equal(data(during, 'reviews').length, 2);
  assert.equal(
    data(during, 'reviews').find((row) => row.id === review.id).withdrawn,
    true
  );
  assert.equal(
    data(during, 'reviews').find((row) => row.id === review.id).hidden,
    true
  );
  assert.equal(data(during, 'votes')[0].value, -1);
  assert.equal(data(during, 'votes')[0].subjectId, target.id);
  assert.equal(data(during, 'likes')[0].nodeId, child.id);
  assert.equal(data(during, 'review-helpful')[0].reviewId, foreignReview.id);
  assert.equal(data(during, 'review-reports')[0].reason, 'My own report');
  assert.equal(data(during, 'review-reports')[0].resolution, 'hidden');
  const text = JSON.stringify(during);
  for (const forbidden of [
    'Foreign private root text',
    'Foreign reply text',
    'Foreign topic text',
    'Foreign review text',
    'Private staff report resolution',
    'commandKey',
    'fingerprint',
    'payloadKey',
    foreign.identityId,
    moderator.identityId,
  ])
    assert.equal(text.includes(forbidden), false, forbidden);
  assert.equal(during.at(-1).type, 'end');
  assert.equal(
    during.at(-1).records,
    during.filter((row) => row.type === 'record').length
  );
  const empty = await collect(
    exportSource.capture(owner.identityId.toLowerCase(), signal())
  );
  assert.equal(
    empty.length,
    2,
    'Exact account ownership does not leak to a case variant'
  );
  await assert.rejects(
    collect(exportSource.capture(' ', signal())),
    /Authentication/
  );

  const reopened = await new DataSource(source.options).initialize();
  try {
    const current = await collect(
      new MysqlDiscussionAccountExportSource(reopened, objects).capture(
        owner.identityId,
        signal()
      )
    );
    assert.equal(
      data(current, 'contributions').find((row) => row.id === root.id).content,
      'Edited during capture'
    );
    assert.equal(data(current, 'contributions').length, 135);
  } finally {
    await reopened.destroy();
  }
  const controller = new AbortController();
  const stopped = exportSource
    .capture(owner.identityId, controller.signal)
    [Symbol.asyncIterator]();
  await stopped.next();
  controller.abort(new Error('Stop account capture'));
  await assert.rejects(stopped.next(), /Stop account capture/);
  assert.equal(Number((await source.query('SELECT 1 AS alive'))[0].alive), 1);

  const [reference] = await source.query(
    'SELECT payloadKey, payloadHash, payloadBytes FROM discussion_write_nodes WHERE nodeId = ?',
    [root.id]
  );
  await source.query(
    'UPDATE discussion_write_nodes SET payloadHash = ? WHERE nodeId = ?',
    ['0'.repeat(64), root.id]
  );
  try {
    await assert.rejects(
      collect(exportSource.capture(owner.identityId, signal())),
      /canonical/
    );
  } finally {
    await source.query(
      'UPDATE discussion_write_nodes SET payloadHash = ? WHERE nodeId = ?',
      [reference.payloadHash, root.id]
    );
  }
  const retained = await minio.getBytes(
    'discussion-content',
    reference.payloadKey,
    Number(reference.payloadBytes)
  );
  await minio.deleteObject('discussion-content', reference.payloadKey);
  try {
    await assert.rejects(
      collect(exportSource.capture(owner.identityId, signal()))
    );
  } finally {
    await minio.putImmutableBytes(
      'discussion-content',
      reference.payloadKey,
      retained
    );
  }
  const [relation] = await source.query(
    "SELECT id, toContentId FROM content_node_relations WHERE fromContentId = ? AND relationType = 'replies'",
    [child.id]
  );
  await source.query(
    'UPDATE content_node_relations SET toContentId = ? WHERE id = ?',
    [child.id, relation.id]
  );
  try {
    await assert.rejects(
      collect(exportSource.capture(owner.identityId, signal())),
      /canonical/
    );
  } finally {
    await source.query(
      'UPDATE content_node_relations SET toContentId = ? WHERE id = ?',
      [relation.toContentId, relation.id]
    );
  }
  await source.query(
    'UPDATE content_node_relations SET toContentId = ? WHERE id = ?',
    [randomUUID(), relation.id]
  );
  try {
    await assert.rejects(
      collect(exportSource.capture(owner.identityId, signal())),
      /canonical/
    );
  } finally {
    await source.query(
      'UPDATE content_node_relations SET toContentId = ? WHERE id = ?',
      [relation.toContentId, relation.id]
    );
  }
  const [version] = await source.query(
    'SELECT * FROM review_versions WHERE reviewId = ? AND revision = 130',
    [review.id]
  );
  await source.query(
    'DELETE FROM review_versions WHERE reviewId = ? AND revision = 130',
    [review.id]
  );
  try {
    await assert.rejects(
      collect(exportSource.capture(owner.identityId, signal())),
      /canonical/
    );
  } finally {
    await source.query(
      'INSERT INTO review_versions (reviewId, revision, displayName, rating, text) VALUES (?, ?, ?, ?, ?)',
      [
        version.reviewId,
        version.revision,
        version.displayName,
        version.rating,
        version.text,
      ]
    );
  }
  console.log(
    'Discussion account export passed against real SQL/MinIO: consistent edits, 134 contributions across owner tenants, 135 registered payload versions, 131 retained review versions, tombstones, votes/likes/reports/helpful marks, private foreign-content exclusion, exact-case isolation, reconnect, cancellation, corrupt/missing objects and invalid structural/history authority. Command policy is substituted; source transport/account lifecycle/API/browser export are not qualified here.'
  );
  await require('./discussion-export-history-checks.cjs')({
    source,
    minio,
    uploaded,
  });
}
module.exports = { qualifyDiscussionAccountExport };
