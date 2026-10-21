const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { articleParityHttp } = require('./article-parity-http.cjs');
const {
  qualifyArticleCovers,
} = require('./bff-article-cover-parity-checks.cjs');
const {
  qualifyArticleComments,
} = require('./bff-article-comment-parity-checks.cjs');

async function qualifyArticleParity({
  call,
  origins,
  input,
  credentials,
  subjectFor,
  services,
  restartAccount,
  restartBff,
  stopBff,
}) {
  const [local, alpha] = origins;
  const { request, change, until } = articleParityHttp(local);
  const drafts = '/api/me/articles',
    reviews = '/api/editorial/article-reviews';
  const members = [];
  for (const [name, roles, tenantId] of [
    ['author', []],
    ['other', []],
    ['reviewer', ['editorial:reviewer']],
    ['foreign', ['editorial:reviewer'], 'foreign-article-tenant'],
  ]) {
    const email = `article-${name}@example.test`;
    let member = await call('/auth/register', {
      at: local,
      body: { ...input, email, nickname: `Article ${name}` },
      headers: { 'Idempotency-Key': 'article-register-' + name },
    });
    // Controlled operator setup changes only this run's credential claims; sign-in resolves canonical Identity.
    if (roles.length) {
      await credentials.setOperatorClaims(await subjectFor(member.uid), {
        roles,
        ...(tenantId ? { tenantId } : {}),
      });
      member = await call('/auth/signin', {
        at: local,
        body: { email, password: input.password },
      });
    }
    members.push({ ...member, email });
  }
  const [author, other, reviewer, foreign] = members;
  const independent = await call('/auth/signin', {
    at: alpha,
    body: { email: author.email, password: input.password },
  });
  assert.equal(independent.uid, author.uid);
  assert.notEqual(independent.token, author.token);
  const fields = {
    title: 'Article parity ' + randomUUID(),
    slug: 'article-parity-' + randomUUID(),
    excerpt: 'A complete independent article publication journey.',
    byline: 'Public article author',
    category: 'Guides',
    tags: ['article-parity'],
    classification: 'general',
    sections: [
      { heading: 'Reviewed section', paragraphs: ['Frozen article text.'] },
    ],
  };
  const createKey = randomUUID();
  const created = await change(drafts, author, fields, { key: createKey });
  const id = created.id,
    publicPath = '/api/catalog/articles/' + fields.slug;
  const read = (target = id, actor = author, options = {}) =>
    request(`${drafts}/${target}`, { actor, ...options });
  const status = (target = id, actor = author) =>
    request(`${drafts}/${target}/publication`, { actor });
  const update = async (value, options = {}) =>
    change(
      `${drafts}/${id}`,
      author,
      {
        ...value,
        expectedRevision: (await read()).revision,
      },
      { method: 'PUT', ...options }
    );
  async function publish(action, options = {}) {
    const target = options.target ?? id,
      owner = options.owner ?? author;
    const state = await status(target, owner),
      review = action === 'approve' || action === 'reject';
    const route = review
      ? `${reviews}/${target}/decision`
      : `${drafts}/${target}/${action}`;
    const body = {
      expectedRevision: state.revision,
      expectedPublicationRevision: state.publicationRevision,
      ...(review
        ? {
            decision: action,
            submittedRevision: state.latestSubmission.submittedRevision,
            reason: 'Independent review.',
          }
        : {}),
    };
    const actor = options.actor ?? (review ? reviewer : owner),
      key = options.key ?? randomUUID();
    const result = await change(route, actor, body, {
      key,
      at: options.at ?? local,
      ...(options.status ? { status: options.status } : {}),
    });
    return { route, body, actor, key, result };
  }
  const replay = (command, options = {}) =>
    change(command.route, command.actor, command.body, {
      key: command.key,
      ...options,
    });
  const projected = (revision, deleted = false) =>
    until(async () => {
      services.assertWorker();
      const row = await services.projections.findOne({
        kind: 'article',
        resourceId: id,
      });
      assert.equal(row?.revision, revision);
      assert.equal(row.deletedAt !== null, deleted);
      return row;
    }, 'Editorial article projection did not converge');
  assert.deepEqual(
    await change(drafts, independent, fields, { key: createKey, at: alpha }),
    created
  );
  await change(
    drafts,
    author,
    { ...fields, title: 'Changed key payload' },
    { key: createKey, status: 409 }
  );
  assert.equal(
    (await read(id, independent, { at: alpha })).title,
    fields.title
  );
  assert.ok(
    (await request(drafts, { actor: author })).some((row) => row.id === id)
  );
  assert.deepEqual(await request(drafts, { actor: other }), []);
  for (const actor of [other, foreign]) {
    await read(id, actor, { status: 404 });
    await request(`${drafts}/${id}/publication`, { actor, status: 404 });
    await change(
      `${drafts}/${id}`,
      actor,
      { ...fields, expectedRevision: 1 },
      { method: 'PUT', status: 404 }
    );
  }
  await request(drafts, {
    headers: { 'X-User-Id': author.uid, 'X-Ingress-Auth': 'forged' },
    status: 401,
  });
  await request(reviews, { actor: author, status: 403 });
  await request(`${reviews}/${id}`, { actor: author, status: 403 });
  await request(`${reviews}/${id}`, { actor: foreign, status: 404 });
  await request(reviews, {
    actor: author,
    status: 403,
    headers: {
      'X-User-Id': reviewer.uid,
      'X-User-Claims': JSON.stringify({ roles: ['editorial:reviewer'] }),
      'X-Ingress-Auth': 'forged',
    },
  });
  await request(`${drafts}/${id}?tenantId=foreign`, {
    actor: author,
    status: 400,
  });
  await change(
    drafts,
    author,
    { ...fields, ownerIdentityId: other.uid },
    { status: 400 }
  );
  await request(publicPath, { status: 404 });
  await request('/api/article-comments/' + id, { status: 404 });
  const concurrent = await Promise.all(
    ['One', 'Two'].map((title, index) =>
      change(
        `${drafts}/${id}`,
        author,
        {
          ...fields,
          title,
          expectedRevision: 1,
        },
        { method: 'PUT', at: origins[index], status: [200, 409] }
      )
    )
  );
  assert.equal(concurrent.filter((row) => row.revision === 2).length, 1);
  assert.equal(concurrent.filter((row) => row.statusCode === 409).length, 1);
  const large = {
    ...fields,
    sections: [
      { heading: '', paragraphs: Array(6).fill('\u754c'.repeat(3900)) },
    ],
  };
  assert.ok(Buffer.byteLength(JSON.stringify(large)) > 64 * 1024);
  await update(large, { at: alpha });
  assert.deepEqual((await read()).sections, large.sections);
  await update(fields);
  const before = await read(),
    rollbackKey = randomUUID();
  await services.sql.query(
    "CREATE TRIGGER article_parity_receipt BEFORE INSERT ON article_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'article draft rollback'"
  );
  try {
    await update(
      { ...fields, title: 'Rolled back' },
      { key: rollbackKey, status: 503 }
    );
  } finally {
    await services.sql.query('DROP TRIGGER article_parity_receipt');
  }
  assert.deepEqual(await read(), before);
  const recovered = await update(
    { ...fields, title: 'Rolled back' },
    { key: rollbackKey }
  );
  assert.deepEqual(
    await change(
      `${drafts}/${id}`,
      author,
      { ...fields, title: 'Rolled back', expectedRevision: before.revision },
      { method: 'PUT', key: rollbackKey }
    ),
    recovered
  );
  await update(fields);
  const removableKey = randomUUID(),
    removableFields = { ...fields, slug: 'deleted-' + randomUUID() };
  const removable = await change(drafts, author, removableFields, {
    key: removableKey,
  });
  const deleted = await change(
    `${drafts}/${removable.id}`,
    author,
    { expectedRevision: 1 },
    { method: 'DELETE' }
  );
  assert.equal(deleted.revision, 2);
  assert.deepEqual(
    await change(drafts, author, removableFields, { key: removableKey }),
    removable
  );
  await read(removable.id, author, { status: 404 });
  const [tombstone] = await services.sql.query(
    'SELECT deletedAt, fields, revision FROM article_drafts WHERE id=?',
    [removable.id]
  );
  assert.ok(tombstone.deletedAt);
  assert.equal(Number(tombstone.revision), 2);
  console.log(
    'PASS article drafts: real independent sessions, canonical owner/tenant/forged-context denial, concurrent revisions, key conflicts, multilingual bodies above 64 KiB, receipt rollback and non-resurrecting delete history'
  );

  const media = await qualifyArticleCovers({
    request,
    change,
    origins,
    author,
    other,
    foreign,
    id,
  });
  const withFirst = {
    ...fields,
    cover: { imageId: media.first.id, alt: 'Reviewed green cover' },
  };
  const withSecond = {
    ...fields,
    title: fields.title + ' edited',
    classification: 'mature',
    cover: { imageId: media.second.id, alt: 'Reviewed blue cover' },
  };
  await update(withFirst);
  await change(
    `/api/me/article-covers/${media.first.id}`,
    author,
    { expectedRevision: 2 },
    { method: 'DELETE', status: 409 }
  );
  const submitted = await publish('submit');
  await publish('submit', { status: 409 });
  await change(
    `${drafts}/${id}`,
    author,
    { expectedRevision: (await read()).revision },
    { method: 'DELETE', status: 409 }
  );
  await update(withSecond);
  const frozen = await request(`${reviews}/${id}`, {
    actor: reviewer,
    at: alpha,
  });
  assert.equal(frozen.latestSubmission.title, fields.title);
  assert.equal(frozen.latestSubmission.classification, 'general');
  assert.equal(frozen.latestSubmission.cover.imageId, media.first.id);
  assert.deepEqual(frozen.latestSubmission.sections, fields.sections);
  assert.ok(
    (await request(reviews, { actor: reviewer })).items.some(
      (row) => row.id === id
    )
  );
  const frozenOwner = `${drafts}/${id}/submissions/${submitted.result.submittedRevision}/cover`;
  const frozenReviewer = `${reviews}/${id}/submissions/${submitted.result.submittedRevision}/cover`;
  for (const at of origins) {
    assert.deepEqual(
      await request(frozenOwner, { actor: author, binary: true, at }),
      media.first.normalized
    );
    assert.deepEqual(
      await request(frozenReviewer, { actor: reviewer, binary: true, at }),
      media.first.normalized
    );
  }
  await request(frozenOwner, { actor: other, status: 404 });
  await request(frozenReviewer, { actor: author, status: 403 });
  await request(`${reviews}/${id}/submissions/9999/cover`, {
    actor: reviewer,
    status: 404,
  });
  await publish('reject');
  await publish('submit', { at: alpha });
  await request(frozenOwner, { actor: author, status: 404 });
  await update(withFirst);
  const self = await change(drafts, reviewer, {
    ...fields,
    slug: 'self-' + randomUUID(),
  });
  await publish('submit', { target: self.id, owner: reviewer });
  await publish('approve', { target: self.id, owner: reviewer, status: 403 });
  await request(`${reviews}/${self.id}`, { actor: reviewer, status: 403 });
  assert.ok(
    !(await request(reviews, { actor: reviewer })).items.some(
      (row) => row.id === self.id
    )
  );
  await publish('withdraw', { target: self.id, owner: reviewer });
  console.log(
    'PASS frozen submitted text/classification/covers despite private edits, independent review, protected submission previews, rejection/resubmission and self-review denial'
  );

  const beforeApproval = await status(),
    approveKey = randomUUID();
  const outboxCount = async () =>
    Number(
      (
        await services.sql.query(
          "SELECT COUNT(*) total FROM editorial_outbox WHERE resourceKind='article' AND resourceId=?",
          [id]
        )
      )[0].total
    );
  const intents = await outboxCount();
  await services.sql.query(
    "CREATE TRIGGER article_parity_outbox BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'article publication rollback'"
  );
  try {
    await publish('approve', { key: approveKey, status: 503 });
  } finally {
    await services.sql.query('DROP TRIGGER article_parity_outbox');
  }
  assert.deepEqual(await status(), beforeApproval);
  assert.equal(await outboxCount(), intents);
  await request('/api/catalog/article-visibility/' + id, { status: 404 });
  const approved = await publish('approve', { key: approveKey, at: alpha });
  assert.equal(approved.result.publicationRevision, 1);
  assert.deepEqual(await replay(approved), approved.result);
  await request(publicPath, { status: 503 });
  const publicFirst = `/api/media/articles/${id}/${media.first.id}`,
    publicSecond = `/api/media/articles/${id}/${media.second.id}`;
  assert.deepEqual(
    await request(publicSecond, { binary: true }),
    media.second.normalized
  );
  await request(publicFirst, { status: 404 });
  assert.equal(
    (await request('/api/catalog/article-visibility/' + id)).revision,
    1
  );
  assert.deepEqual(await request('/api/article-comments/' + id), {
    items: [],
    next: null,
  });
  const comments = await qualifyArticleComments({
    request,
    change,
    until,
    origins,
    services,
    author,
    other,
    foreign,
    id,
  });
  await services.startWorker();
  await projected(1);
  for (const at of origins) {
    const published = await request(publicPath, { at });
    assert.equal(published.title, withSecond.title);
    assert.equal(published.classification, 'mature');
    assert.equal(published.cover.imageId, media.second.id);
    for (const key of [
      'ownerIdentityId',
      'tenantId',
      'reviewerIdentityId',
      'latestSubmission',
    ])
      assert.equal(published[key], undefined);
    const listing = await request(
      '/api/catalog/articles?' +
        new URLSearchParams({
          q: fields.title.toUpperCase(),
          category: 'Guides',
          tag: 'article-parity',
          page: '1',
          pageSize: '3',
          sort: 'name-desc',
        }),
      { at }
    );
    assert.equal(listing.total, 1);
    assert.equal(listing.pageSize, 3);
    assert.equal(listing.items[0].id, id);
    assert.equal(listing.items[0].sections, undefined);
    assert.equal(
      (await request('/api/catalog/article-selection?ids=' + id, { at }))
        .items[0].id,
      id
    );
  }
  await update(
    { ...withFirst, slug: 'renamed-' + randomUUID() },
    { status: 409 }
  );
  const duplicate = await change(drafts, author, fields);
  await publish('submit', { target: duplicate.id });
  await publish('approve', { target: duplicate.id, status: 409 });
  await publish('withdraw', { target: duplicate.id });
  console.log(
    'PASS article approval/outbox rollback, real broker/materializer recovery, frozen mature classification, exact public browse/filter/selection/visibility and immutable unique published slugs'
  );

  const offlineUpload = await media.reserve(media.first.bytes);
  const offlineUploadKey = randomUUID();
  await services.pauseStorage();
  try {
    await media.upload(offlineUpload, media.first.bytes, {
      key: offlineUploadKey,
      status: 503,
    });
    assert.equal(
      (
        await request(`/api/me/article-covers/${offlineUpload.id}`, {
          actor: author,
        })
      ).status,
      'pending'
    );
    await request(publicSecond, { status: 503 });
    assert.equal((await read()).title, withFirst.title);
  } finally {
    await services.resumeStorage();
  }
  assert.equal(
    (
      await media.upload(offlineUpload, media.first.bytes, {
        key: offlineUploadKey,
      })
    ).status,
    'ready'
  );
  assert.deepEqual(
    await request(publicSecond, { binary: true }),
    media.second.normalized
  );
  await services.pauseMongo();
  try {
    await request(publicPath, { status: 503 });
    assert.equal(
      (await request('/api/catalog/article-visibility/' + id)).revision,
      1
    );
    assert.deepEqual(
      await request(publicSecond, { binary: true }),
      media.second.normalized
    );
  } finally {
    await services.resumeMongo();
  }
  const beforePolicyOutage = await read();
  await services.pausePolicy();
  try {
    await change(
      `${drafts}/${id}`,
      author,
      { ...fields, expectedRevision: beforePolicyOutage.revision },
      { method: 'PUT', status: 503 }
    );
  } finally {
    await services.resumePolicy();
  }
  await services.stopCommunity();
  try {
    await request(comments.base, { status: 503 });
  } finally {
    await services.restartCommunity();
  }
  await services.stopEditorial();
  try {
    await request(publicPath, { status: 503 });
    await request(publicSecond, { status: 503 });
    await request(comments.base, { status: 503 });
    await change(comments.base, author, comments.content, { status: 503 });
  } finally {
    await services.restartEditorial();
  }
  await restartAccount();
  await restartBff();
  assert.deepEqual(await replay(approved), approved.result);
  assert.deepEqual(
    await media.upload(media.second, media.second.bytes, {
      key: media.second.key,
    }),
    media.second.result
  );
  await comments.assertVisible();
  console.log(
    'PASS article storage, Mongo, policy, Community and Editorial outages fail truthfully; independent API/Account/BFF restart preserves durable covers, publication, comment generations and exact historical receipts'
  );

  const families = [
    drafts,
    reviews,
    '/api/catalog/articles',
    '/api/catalog/article-selection',
    '/api/catalog/article-visibility',
    '/api/me/article-covers',
    '/api/media/articles',
    '/api/article-comments',
  ];
  const routes = families.flatMap((family) => [
    family,
    family + '/',
    family + '/unknown/action',
    family.toUpperCase(),
    family.toUpperCase() + '/UNKNOWN/',
  ]);
  routes.push(
    frozenOwner,
    frozenReviewer,
    media.first.route,
    publicFirst,
    publicSecond
  );
  await stopBff();
  try {
    for (const at of origins)
      for (const route of routes)
        await request(route, { at, actor: reviewer, status: [502, 504] });
  } finally {
    await restartBff();
  }
  assert.equal((await read()).title, withFirst.title);
  console.log(
    `PASS both selected article gateway route matrices fail with BFF stopped: ${
      routes.length * origins.length
    } case/slash/unknown-family and protected/public-media requests, no direct-owner fallback`
  );

  await services.stopWorker();
  await publish('submit');
  const replaced = await publish('approve');
  assert.equal(replaced.result.publicationRevision, 2);
  assert.equal(
    (await services.projections.findOne({ kind: 'article', resourceId: id }))
      .revision,
    1
  );
  await request(publicPath, { status: 503 });
  await request(publicSecond, { status: 404 });
  assert.deepEqual(
    await request(publicFirst, { binary: true }),
    media.first.normalized
  );
  await comments.assertVisible();
  const retained = await services.discussionHeads.findOne({
    _id: comments.root.id,
  });
  assert.ok(retained);
  const withdrawn = await publish('withdraw');
  assert.equal(withdrawn.result.publicationRevision, 3);
  for (const at of origins) {
    for (const route of [
      publicPath,
      publicFirst,
      publicSecond,
      '/api/catalog/article-visibility/' + id,
    ])
      await request(route, { at, status: 404 });
    assert.deepEqual(
      await request('/api/catalog/article-selection?ids=' + id, { at }),
      { items: [] }
    );
  }
  await comments.assertHidden();
  assert.deepEqual(
    await services.discussionHeads.findOne({ _id: comments.root.id }),
    retained
  );
  await services.restartEditorial();
  assert.deepEqual(await replay(approved), approved.result);
  assert.deepEqual(await replay(replaced), replaced.result);
  assert.deepEqual(await replay(withdrawn), withdrawn.result);
  await comments.assertHidden();
  await services.startWorker();
  await projected(3, true);
  await comments.assertHidden();
  await services.stopWorker();
  await publish('submit');
  const republished = await publish('approve');
  assert.equal(republished.result.publicationRevision, 4);
  await request(publicPath, { status: 503 });
  await comments.assertVisible();
  await services.startWorker();
  await projected(4);
  assert.equal((await request(publicPath)).classification, 'general');
  await publish('withdraw');
  await projected(5, true);
  await comments.assertHidden();
  console.log(
    'PASS current cover replacement and article withdrawal override stale projections; retained comment generations follow canonical publication through withdrawal/republication; historical replay cannot resurrect and real worker converges to retained revision-5 tombstone'
  );
}

module.exports = { qualifyArticleParity };
