const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const base = '../../apps/services/editorial/src/app/';
const { recordEditorialMediaAsset } = require(base +
  'application-media/editorial-media-assets');
const { MysqlEditorialContributionErasure } = require(base +
  'account-erasure/mysql-editorial-contribution-erasure');
const { EditorialAuthorErasure1791840010000 } = require(base +
  'account-erasure/editorial-author-erasure.migration');
const {
  MysqlAccountErasureParticipant,
} = require('../../libs/adapters/account-mysql/src');
const {
  ACCOUNT_ERASURE_WRITER,
} = require('../../libs/usecases/account/src');
const { EditorialCommands } = require(base + 'application/editorial-commands');
const { MysqlEditorialWrites } = require(base +
  'infrastructure/mysql-editorial-writes');
const { ApplicationOwnership } = require(base +
  'application-ownership/application-ownership');
const { MysqlApplicationOwnership } = require(base +
  'application-ownership/mysql-application-ownership');
const { MysqlArticleCoverReads } = require(base +
  'article-covers/mysql-article-cover-reads');
const { MysqlArticleCatalog } = require(base +
  'articles/mysql-article-catalog');
const { MysqlPublicationActivity } = require(base +
  'infrastructure/mysql-profile-activity');
const { projectEditorialSnapshot } = require(base +
  'application/editorial-materialization');

module.exports = async function editorialAuthorErasureChecks({
  source,
  origin,
  secret,
  restart,
  pass,
  policy,
  reader,
  projections,
  qualifyBrowser,
  qualifyProjections,
}) {
  const actor = (identityId, roles = [], tenantId = 'default') => ({
    identityId,
    roles,
    tenantId,
  });
  const owner = actor('ErasureAuthor', [
    'editorial:publisher',
    'editorial:taxonomy',
  ]);
  const staff = actor('ErasureStaff', [
    'editorial:reviewer',
    'editorial:ownership-reviewer',
  ]);
  const peer = actor('erasureauthor', owner.roles);
  const editorial = new EditorialCommands(
    new MysqlEditorialWrites(source, 'default'),
    policy,
    { generate: randomUUID }
  );
  const ownership = new ApplicationOwnership(
    new MysqlApplicationOwnership(source),
    { matches: async () => true },
    policy,
    { id: randomUUID, token: () => randomBytes(32).toString('hex') }
  );
  const participant = new MysqlAccountErasureParticipant('editorial', source);
  const erasure = new MysqlEditorialContributionErasure(source);
  const input = { identityId: owner.identityId, revision: 9 };
  const insert = (table, row) =>
    source.query(
      `INSERT INTO ${table} (${Object.keys(row).join(
        ','
      )}) VALUES (${Object.keys(row)
        .map(() => '?')
        .join(',')})`,
      Object.values(row)
    );
  const scalar = async (sql, args = []) =>
    Number((await source.query(sql, args))[0].n);
  const state = async (kind, id) =>
    (
      await source.query(
        'SELECT * FROM editorial_resource_states WHERE resourceKind=? AND resourceId=?',
        [kind, id]
      )
    )[0];
  const targetCount = () =>
    scalar(
      'SELECT COUNT(*) n FROM editorial_erasure_resources WHERE identityId=?',
      [owner.identityId]
    );
  const publish = async (kind, id) =>
    projections.publish(projectEditorialSnapshot(await reader.read(kind, id)));
  async function request(status, method, route, body, current = owner) {
    const response = await fetch(origin() + '/api/' + route, {
      method,
      headers: {
        'content-type': 'application/json',
        'idempotency-key': randomUUID(),
        ...(current
          ? {
              'x-user-id': current.identityId,
              'x-user-claims': JSON.stringify({
                tenantId: current.tenantId,
                roles: current.roles,
              }),
              'x-ingress-auth': secret,
            }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    const value = await response.json();
    assert.equal(
      response.status,
      status,
      `${method} ${route}: ${JSON.stringify(value)}`
    );
    return value;
  }
  async function grant(current, application) {
    const claim = await ownership.create(
      current,
      {
        applicationId: application.id,
        evidenceUrl: 'https://erase.example.test/team',
        notes: 'I control the official website.',
      },
      randomUUID()
    );
    const proof = await ownership.change(
      current,
      claim.id,
      'verify',
      { expectedRevision: claim.revision },
      randomUUID()
    );
    return ownership.change(
      staff,
      claim.id,
      'approve',
      { expectedRevision: proof.revision },
      randomUUID()
    );
  }
  async function approve(family, review, id) {
    const current = await request(200, 'GET', `me/${family}/${id}/publication`);
    await request(201, 'POST', `me/${family}/${id}/submit`, {
      expectedRevision: current.revision,
      ...(family === 'suites'
        ? {}
        : { expectedPublicationRevision: current.publicationRevision }),
    });
    const submitted = await request(
      200,
      'GET',
      `editorial/${review}/${id}`,
      undefined,
      staff
    );
    return request(
      201,
      'POST',
      `editorial/${review}/${id}/decision`,
      {
        decision: 'approve',
        expectedRevision: submitted.revision,
        ...(family === 'suites'
          ? {}
          : { expectedPublicationRevision: submitted.publicationRevision }),
        submittedRevision: submitted.latestSubmission.submittedRevision,
        reason: '',
      },
      staff
    );
  }
  const app = await editorial.create(
    'app',
    {
      name: 'Retained application',
      slug: 'erasure-application',
      website: 'https://erase.example.test',
    },
    owner,
    randomUUID()
  );
  const approvedGrant = await grant(owner, app);
  const category = await editorial.create(
    'category',
    { name: 'Retained category', slug: 'erasure-category' },
    owner,
    randomUUID()
  );
  const tag = await editorial.create(
    'tag',
    { name: 'Retained tag', slug: 'erasure-tag' },
    owner,
    randomUUID()
  );
  const peerTag = await editorial.create(
    'tag',
    { name: 'Peer tag', slug: 'erasure-peer-tag' },
    peer,
    randomUUID()
  );
  const foreignTag = await editorial.create(
    'tag',
    { name: 'Foreign tag', slug: 'erasure-foreign-tag' },
    actor('ForeignAuthor', owner.roles, 'foreign'),
    randomUUID()
  );
  const tenantTag = await editorial.create(
    'tag',
    { name: 'Other tenant owned tag', slug: 'erasure-owned-tenant-tag' },
    actor(owner.identityId, owner.roles, 'foreign'),
    randomUUID()
  );
  const removed = await editorial.create(
    'tag',
    { name: 'Removed tag', slug: 'erasure-removed-tag' },
    owner,
    randomUUID()
  );
  await editorial.remove(
    'tag',
    removed.id,
    { expectedRevision: 1 },
    owner,
    randomUUID()
  );
  const suite = await request(201, 'POST', 'me/suites', {
    title: 'Retained collection',
    description: 'Approved collection.',
    applicationIds: [app.id],
  });
  await approve('suites', 'suite-reviews', suite.id);
  const articleFields = {
    title: 'Retained article',
    slug: 'erasure-article',
    excerpt: 'Retained summary.',
    byline: 'An identifiable author',
    category: 'Guides',
    tags: ['privacy'],
    sections: [
      {
        heading: 'Introduction',
        paragraphs: ['This public text survives account erasure.'],
      },
    ],
  };
  const article = await request(201, 'POST', 'me/articles', articleFields);
  const imageId = randomUUID(),
    at = Date.now();
  const asset = {
    id: imageId,
    contentType: 'image/webp',
    bytes: 1024,
    sha256: 'a'.repeat(64),
    width: 800,
    height: 300,
  };
  // Association qualification uses durable ready metadata, without claiming object delivery.
  await insert('article_cover_uploads', {
    id: imageId,
    articleId: article.id,
    tenantId: 'default',
    ownerIdentityId: owner.identityId,
    sourceType: 'image/png',
    sourceBytes: 2048,
    sourceSha256: 'b'.repeat(64),
    revision: 2,
    status: 'ready',
    createdAt: at,
    expiresAt: at + 86400000,
    asset: JSON.stringify(asset),
    attempts: 1,
    leaseToken: null,
    leaseUntil: null,
    commandKey: null,
  });
  await insert('article_cover_commands', {
    tenantId: 'default',
    ownerIdentityId: owner.identityId,
    commandKey: randomUUID(),
    fingerprint: 'c'.repeat(64),
    imageId,
    executions: 1,
    receipt: JSON.stringify({ id: imageId, revision: 2, status: 'ready' }),
    createdAt: at,
    completedAt: at,
  });
  await source.transaction((manager) =>
    recordEditorialMediaAsset(manager, {
      kind: 'article',
      imageId,
      tenantId: 'default',
      articleId: article.id,
      asset,
      createdAt: at,
      retiredAt: null,
    })
  );
  await request(200, 'PUT', `me/articles/${article.id}`, {
    ...articleFields,
    cover: { imageId, alt: 'Retained illustration' },
    expectedRevision: 1,
  });
  await approve('articles', 'article-reviews', article.id);
  const releaseFields = {
    version: '2026.10+stable',
    channel: 'stable',
    type: 'major',
    releasedOn: new Date().toISOString().slice(0, 10),
    title: 'Retained release',
    description: 'Reviewed changes.',
    changes: [{ type: 'security', description: 'Enforce current authority.' }],
  };
  const release = await request(201, 'POST', 'me/releases', {
    applicationId: app.id,
    claimId: approvedGrant.id,
    fields: releaseFields,
  });
  const released = await approve('releases', 'release-reviews', release.id);
  const releaseId = released.releaseId;
  assert.ok(releaseId);
  const resources = [
    ['app', app.id],
    ['article', article.id],
    ['category', category.id],
    ['release', releaseId],
    ['suite', suite.id],
    ['tag', tag.id],
    ['tag', removed.id],
    ['tag', tenantTag.id],
  ];
  const before = new Map();
  for (const [kind, id] of resources) {
    const snapshot = await reader.read(kind, id);
    before.set(id, { state: await state(kind, id), snapshot });
    await projections.publish(projectEditorialSnapshot(snapshot));
  }
  await request(
    200,
    'GET',
    `catalog/articles/${articleFields.slug}`,
    undefined,
    null
  );
  const covers = new MysqlArticleCoverReads(source, 'default');
  assert.deepEqual(await covers.published(article.id, imageId), asset);
  await assert.rejects(
    erasure.advance(input),
    /Missing Editorial erasure request/
  );
  assert.equal((await participant.request(input)).state, 'pending');
  await assert.rejects(
    erasure.advance({ ...input, revision: input.revision + 1 }),
    /exact erasure request/
  );
  assert.equal(await targetCount(), 0);
  const activity = new MysqlPublicationActivity(source, 'default');
  assert.deepEqual(await activity.read(owner.identityId, null, true), []);

  const tables = [
    'editorial_resource_states',
    'editorial_outbox',
    'editorial_erasure_resources',
    'application_ownership_grants',
    'application_ownership_claims',
    'application_ownership_decisions',
    'article_publications',
  ];
  const snapshotRows = async () =>
    Object.fromEntries(
      await Promise.all(
        tables.map(async (table) => [
          table,
          await source.query(`SELECT * FROM ${table}`),
        ])
      )
    );
  for (const table of [
    'editorial_outbox',
    'editorial_erasure_resources',
    'application_ownership_decisions',
  ]) {
    const previous = await snapshotRows();
    await source.query(
      `CREATE TRIGGER qualification_erasure_failure BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected erasure failure'`
    );
    try {
      await assert.rejects(erasure.advance(input), /Injected erasure failure/);
    } finally {
      await source.query('DROP TRIGGER qualification_erasure_failure');
    }
    assert.deepEqual(await snapshotRows(), previous);
  }
  assert.equal(await erasure.advance(input), true);
  assert.equal(await targetCount(), 1);
  assert.equal((await state('app', app.id)).ownerIdentityId, null);
  const [ended] = await source.query(
    'SELECT * FROM application_ownership_grants WHERE applicationId=?',
    [app.id]
  );
  assert.ok(ended.revokedAt);
  const [decision] = await source.query(
    'SELECT * FROM application_ownership_decisions WHERE claimId=? ORDER BY revision DESC LIMIT 1',
    [approvedGrant.id]
  );
  assert.equal(decision.action, 'revoke');
  assert.equal(decision.actorIdentityId, ACCOUNT_ERASURE_WRITER);
  assert.equal(decision.reason, 'Ownership ended by account erasure.');
  pass(
    'missing and mismatched erasure requests fail; outbox, target and grant-decision failures roll back the whole transaction; one bounded call anonymizes the app and revokes verified ownership'
  );

  const newOwner = actor('NewApplicationOwner');
  await grant(newOwner, app);
  const transferred = await state('app', app.id);
  assert.equal(transferred.ownerIdentityId, newOwner.identityId);
  await restart();
  assert.equal(
    await new MysqlEditorialContributionErasure(source).advance(input),
    true
  );
  assert.equal(await targetCount(), 2);
  assert.equal((await state('article', article.id)).ownerIdentityId, null);
  const lag = await request(
    503,
    'GET',
    `catalog/articles/${articleFields.slug}`,
    undefined,
    null
  );
  assert.ok(!JSON.stringify(lag).includes(articleFields.byline));
  const anonymous = await reader.read('article', article.id);
  assert.equal(anonymous.content.byline, 'Deleted account');
  assert.deepEqual(anonymous.content, {
    ...before.get(article.id).snapshot.content,
    byline: 'Deleted account',
  });
  if (qualifyBrowser && !qualifyProjections)
    await qualifyBrowser({
      fields: articleFields,
      materialize: () => publish('article', article.id),
    });
  else await publish('article', article.id);
  const publicArticle = await request(
    200,
    'GET',
    `catalog/articles/${articleFields.slug}`,
    undefined,
    null
  );
  assert.equal(publicArticle.byline, 'Deleted account');
  assert.equal(
    await projections.publish(
      projectEditorialSnapshot(before.get(article.id).snapshot)
    ),
    'superseded'
  );
  assert.deepEqual(await covers.published(article.id, imageId), asset);
  await assert.rejects(
    covers.published(article.id, randomUUID()),
    /cover not found/
  );
  await assert.rejects(
    new MysqlArticleCoverReads(source, 'foreign').published(
      article.id,
      imageId
    ),
    /cover not found/
  );
  assert.equal(
    (
      await new MysqlArticleCatalog(source, 'default').select({
        ownerIdentityId: owner.identityId,
        after: null,
      })
    ).total,
    0
  );
  await request(403, 'POST', 'me/articles', articleFields);
  await request(
    403,
    'POST',
    `editorial/article-reviews/${article.id}/decision`,
    {
      decision: 'approve',
      expectedRevision: 3,
      expectedPublicationRevision: 1,
      submittedRevision: 2,
      reason: '',
    },
    staff
  );
  pass(
    'restart resumes bounded erasure; article reads hide stale attributed Mongo data, retain exact public text/cover/timestamps after rebuild, reject older snapshots and deny former-owner/reviewer writes'
  );

  const outcomes = await Promise.all([
    erasure.advance(input),
    new MysqlEditorialContributionErasure(source).advance(input),
  ]);
  assert.deepEqual(outcomes, [true, true]);
  assert.equal(await targetCount(), 4);
  let calls = 0;
  while (await erasure.advance(input)) assert.ok(++calls <= resources.length);
  assert.equal(await targetCount(), resources.length);
  for (const [kind, id] of resources) {
    const current = await state(kind, id),
      previous = before.get(id);
    if (id === app.id) assert.deepEqual(current, transferred);
    else {
      assert.equal(current.ownerIdentityId, null);
      assert.equal(
        Number(current.revision),
        Number(previous.state.revision) + 1
      );
      assert.equal(current.deletedAt, previous.state.deletedAt);
      const snapshot = await reader.read(kind, id);
      if (kind !== 'article')
        assert.deepEqual(snapshot.content, previous.snapshot.content);
    }
    const [target] = await source.query(
      'SELECT * FROM editorial_erasure_resources WHERE identityId=? AND resourceKind=? AND resourceId=?',
      [owner.identityId, kind, id]
    );
    assert.equal(
      Number(target.projectionRevision),
      Number(previous.state.revision) + 1
    );
    const [outbox] = await source.query(
      'SELECT * FROM editorial_outbox WHERE resourceKind=? AND resourceId=? AND revision=?',
      [kind, id, target.projectionRevision]
    );
    assert.equal(outbox.actorIdentityId, null);
    assert.equal(
      outbox.operation,
      previous.state.deletedAt === null ? 'publish' : 'withdraw'
    );
    await publish(kind, id);
    assert.equal(
      await projections.publish(projectEditorialSnapshot(previous.snapshot)),
      'superseded'
    );
  }
  assert.equal(
    (await state('tag', peerTag.id)).ownerIdentityId,
    peer.identityId
  );
  assert.equal(
    (await state('tag', foreignTag.id)).ownerIdentityId,
    'ForeignAuthor'
  );
  assert.deepEqual(await activity.read(owner.identityId, null, true), []);
  assert.equal(await erasure.advance(input), false);
  assert.equal((await participant.request(input)).state, 'pending');
  pass(
    'concurrent workers converge across all six kinds, multiple tenants and tombstones; exact revisions/outbox/targets survive retries; case-distinct peers and subsequent ownership are preserved; participant stays pending'
  );

  const raceAuthor = actor('ConcurrentAuthor', owner.roles);
  const raceApp = await editorial.create(
    'app',
    {
      name: 'Transferred concurrently',
      slug: 'erasure-race',
      website: 'https://erase.example.test',
    },
    raceAuthor,
    randomUUID()
  );
  const raceRequest = { identityId: raceAuthor.identityId, revision: 2 };
  await participant.request(raceRequest);
  let selected, resume;
  const selectedPromise = new Promise((resolve) => {
    selected = resolve;
  });
  const resumePromise = new Promise((resolve) => {
    resume = resolve;
  });
  const pausedSource = {
    transaction: (isolation, run) =>
      source.transaction(isolation, async (manager) => {
        const instrumented = Object.create(manager);
        instrumented.query = async (sql, args) => {
          const result = await manager.query(sql, args);
          if (
            sql.startsWith(
              'SELECT resourceKind,resourceId FROM editorial_resource_states WHERE ownerIdentityId='
            )
          ) {
            selected();
            await resumePromise;
          }
          return result;
        };
        return run(instrumented);
      }),
  };
  const pending = new MysqlEditorialContributionErasure(pausedSource).advance(
    raceRequest
  );
  try {
    await selectedPromise;
    await grant(newOwner, raceApp);
  } finally {
    resume();
  }
  assert.equal(await pending, true);
  assert.equal(
    (await state('app', raceApp.id)).ownerIdentityId,
    newOwner.identityId
  );
  assert.equal(
    await scalar(
      'SELECT COUNT(*) n FROM editorial_erasure_resources WHERE identityId=?',
      [raceAuthor.identityId]
    ),
    0
  );
  assert.equal(await erasure.advance(raceRequest), false);
  pass(
    'a legitimate ownership approval between candidate selection and resource locking is preserved by the locked ownership recheck'
  );

  const runner = source.createQueryRunner();
  try {
    await new EditorialAuthorErasure1791840010000().up(runner);
    for (const Migration of source.options.migrations)
      await new Migration().up(runner);
    await assert.rejects(
      new EditorialAuthorErasure1791840010000().down(runner),
      /authoritative|preserv|destructive/i
    );
    await source.query(
      'UPDATE identity_erasure_requests SET completedAt=requestedAt WHERE identityId=?',
      [owner.identityId]
    );
    await assert.rejects(erasure.advance(input), /pending erasure request/);
    await assert.rejects(
      new EditorialAuthorErasure1791840010000().up(runner),
      /target authority/
    );
    await source.query(
      'UPDATE identity_erasure_requests SET completedAt=NULL WHERE identityId=?',
      [owner.identityId]
    );
  } finally {
    await runner.release();
  }
  await restart();
  await request(
    200,
    'GET',
    `catalog/articles/${articleFields.slug}`,
    undefined,
    null
  );
  await request(200, 'GET', `catalog/suites/${suite.id}`, undefined, null);
  await request(
    200,
    'GET',
    `catalog/releases/erasure-application/${encodeURIComponent(
      releaseFields.version
    )}`,
    undefined,
    null
  );
  pass(
    'all migration reentry validations accept canonical anonymity and retained ownership history; premature completion and destructive rollback are refused; public article/suite/release reads survive API restart'
  );
  await require('./editorial-author-erasure-migration-checks.cjs')({
    source,
    pass,
  });
  if (qualifyProjections)
    await qualifyProjections({
      source,
      reader,
      projections,
      input,
      resources,
      before,
      app,
      article,
      articleFields,
      newOwner: { ...newOwner, roles: owner.roles },
      editorial,
      participant,
      restart,
      request,
      qualifyBrowser,
      pass,
    });
};
