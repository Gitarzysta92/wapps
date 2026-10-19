const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = '../../apps/services/editorial/src/app/';
const { ArticleWorkspace1791676818000 } = require(base +
  'articles/article-workspace.migration');
const { projectEditorialSnapshot } = require(base +
  'application/editorial-materialization');

async function articlePublicationChecks({
  source,
  origin,
  secret,
  restart,
  stopPolicy,
  reader,
  projections,
  collection,
  pass,
  broker,
  qualifyBrowser,
}) {
  const owner = { identityId: 'ArticleAuthor', tenantId: 'default', roles: [] };
  const other = {
    identityId: 'OtherArticleAuthor',
    tenantId: 'default',
    roles: [],
  };
  const staff = {
    identityId: 'ArticleReviewer',
    tenantId: 'default',
    roles: ['editorial:reviewer'],
  };
  const fields = {
    title: 'An independently reviewed article',
    slug: 'reviewed-article',
    excerpt: 'A genuine supplied summary.',
    byline: 'Public author name',
    category: 'Guides',
    tags: ['offline', 'privacy'],
    sections: [
      {
        heading: 'Introduction',
        paragraphs: ['This is the exact reviewed body.', 'A second paragraph.'],
      },
    ],
  };
  async function request(
    method,
    route,
    body,
    actor = owner,
    key = randomUUID()
  ) {
    const response = await fetch(origin() + '/api/' + route, {
      method,
      headers: {
        'content-type': 'application/json',
        'idempotency-key': key,
        ...(actor
          ? {
              'x-user-id': actor.identityId,
              'x-user-claims': JSON.stringify({
                tenantId: actor.tenantId,
                roles: actor.roles,
              }),
              'x-ingress-auth': secret,
            }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.status !== 401)
      assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, json: await response.json() };
  }
  async function expectRequest(
    expected,
    method,
    route,
    body,
    actor = owner,
    key
  ) {
    const result = await request(method, route, body, actor, key);
    assert.equal(
      result.status,
      expected,
      method + ' ' + route + ': ' + JSON.stringify(result.json)
    );
    return result.json;
  }
  const status = (id, actor = owner) =>
    expectRequest(
      200,
      'GET',
      `me/articles/${id}/publication`,
      undefined,
      actor
    );
  const draft = (id, actor = owner) =>
    expectRequest(200, 'GET', `me/articles/${id}`, undefined, actor);
  const publicRead = (slug = fields.slug) =>
    request('GET', `catalog/articles/${slug}`, undefined, null);
  const outboxCount = async () =>
    Number(
      (await source.query('SELECT COUNT(*) AS total FROM editorial_outbox'))[0]
        .total
    );
  async function materialize(id) {
    return projections.publish(
      projectEditorialSnapshot(await reader.read('article', id))
    );
  }
  async function submit(id, actor = owner, key) {
    const current = await status(id, actor);
    return expectRequest(
      201,
      'POST',
      `me/articles/${id}/submit`,
      {
        expectedRevision: current.revision,
        expectedPublicationRevision: current.publicationRevision,
      },
      actor,
      key
    );
  }
  async function decide(
    id,
    decision = 'approve',
    actor = staff,
    key,
    code = 201
  ) {
    const current = await expectRequest(
      200,
      'GET',
      `editorial/article-reviews/${id}`,
      undefined,
      actor
    );
    return expectRequest(
      code,
      'POST',
      `editorial/article-reviews/${id}/decision`,
      {
        decision,
        expectedRevision: current.revision,
        expectedPublicationRevision: current.publicationRevision,
        submittedRevision: current.latestSubmission.submittedRevision,
        reason: decision === 'reject' ? 'Please add supporting details.' : '',
      },
      actor,
      key
    );
  }
  async function withdraw(id, actor = owner, key) {
    const current = await status(id, actor);
    return expectRequest(
      201,
      'POST',
      `me/articles/${id}/withdraw`,
      {
        expectedRevision: current.revision,
        expectedPublicationRevision: current.publicationRevision,
      },
      actor,
      key
    );
  }

  await expectRequest(401, 'GET', 'me/articles', undefined, null);
  await expectRequest(401, 'POST', 'me/articles', fields, null);
  await expectRequest(400, 'POST', 'me/articles', {
    ...fields,
    ownerIdentityId: 'forged',
  });
  await expectRequest(400, 'POST', 'me/articles', {
    ...fields,
    coverImageUrl: 'https://mutable.example/cover.png',
  });
  const rollbackKey = randomUUID();
  await source.query(
    "CREATE TRIGGER fail_article_receipt BEFORE INSERT ON article_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected receipt failure'"
  );
  try {
    await expectRequest(503, 'POST', 'me/articles', fields, owner, rollbackKey);
  } finally {
    await source.query('DROP TRIGGER fail_article_receipt');
  }
  assert.equal(
    Number(
      (await source.query('SELECT COUNT(*) AS total FROM article_drafts'))[0]
        .total
    ),
    0
  );
  const created = await expectRequest(
    201,
    'POST',
    'me/articles',
    fields,
    owner,
    rollbackKey
  );
  assert.deepEqual(
    await expectRequest(201, 'POST', 'me/articles', fields, owner, rollbackKey),
    created
  );
  await expectRequest(
    409,
    'POST',
    'me/articles',
    { ...fields, byline: 'different' },
    owner,
    rollbackKey
  );
  await expectRequest(
    404,
    'GET',
    `me/articles/${created.id}`,
    undefined,
    other
  );
  await expectRequest(404, 'GET', `me/articles/${created.id}`, undefined, {
    ...owner,
    tenantId: 'OtherTenant',
  });
  await expectRequest(404, 'GET', `me/articles/${created.id}`, undefined, {
    ...owner,
    identityId: owner.identityId.toLowerCase(),
  });
  await expectRequest(
    403,
    'GET',
    'editorial/article-reviews',
    undefined,
    owner
  );
  assert.equal((await publicRead()).status, 404);
  pass(
    'durable private article creation, rollback with missing receipt, exact-key replay, strict fields and owner/tenant/case isolation'
  );

  const changes = await Promise.all([
    request('PUT', `me/articles/${created.id}`, {
      ...fields,
      expectedRevision: 1,
    }),
    request('PUT', `me/articles/${created.id}`, {
      ...fields,
      expectedRevision: 1,
    }),
  ]);
  assert.deepEqual(changes.map((value) => value.status).sort(), [200, 409]);
  await submit(created.id);
  const frozen = (await status(created.id)).latestSubmission;
  assert.deepEqual(frozen.sections, fields.sections);
  await expectRequest(409, 'POST', `me/articles/${created.id}/submit`, {
    expectedRevision: 3,
    expectedPublicationRevision: null,
  });
  const editedFields = {
    ...fields,
    title: 'Private future title',
    byline: 'Private future byline',
    sections: [{ heading: 'Private', paragraphs: ['Not approved yet.'] }],
  };
  const edited = await expectRequest(200, 'PUT', `me/articles/${created.id}`, {
    ...editedFields,
    expectedRevision: 3,
  });
  assert.deepEqual((await status(created.id)).latestSubmission, frozen);
  await expectRequest(409, 'DELETE', `me/articles/${created.id}`, {
    expectedRevision: edited.revision,
  });
  await expectRequest(
    403,
    'GET',
    `editorial/article-reviews/${created.id}`,
    undefined,
    { ...owner, roles: ['admin'] }
  );
  const review = await expectRequest(
    200,
    'GET',
    `editorial/article-reviews/${created.id}`,
    undefined,
    staff
  );
  assert.equal(review.latestSubmission.byline, fields.byline);
  const approvalBody = {
    decision: 'approve',
    expectedRevision: review.revision,
    expectedPublicationRevision: null,
    submittedRevision: frozen.submittedRevision,
    reason: '',
  };
  await expectRequest(
    403,
    'POST',
    `editorial/article-reviews/${created.id}/decision`,
    approvalBody,
    { ...owner, roles: ['admin'] }
  );
  await expectRequest(
    409,
    'POST',
    `editorial/article-reviews/${created.id}/decision`,
    { ...approvalBody, submittedRevision: 1 },
    staff
  );
  const beforeOutbox = await outboxCount(),
    approvalKey = randomUUID();
  await source.query(
    "CREATE TRIGGER fail_article_outbox BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected intent failure'"
  );
  try {
    await expectRequest(
      503,
      'POST',
      `editorial/article-reviews/${created.id}/decision`,
      approvalBody,
      staff,
      approvalKey
    );
  } finally {
    await source.query('DROP TRIGGER fail_article_outbox');
  }
  assert.equal((await status(created.id)).revision, edited.revision);
  assert.equal((await status(created.id)).latestSubmission.status, 'submitted');
  assert.equal(
    Number(
      (
        await source.query('SELECT COUNT(*) AS total FROM article_publications')
      )[0].total
    ),
    0
  );
  assert.equal(await outboxCount(), beforeOutbox);
  const approved = await expectRequest(
    201,
    'POST',
    `editorial/article-reviews/${created.id}/decision`,
    approvalBody,
    staff,
    approvalKey
  );
  assert.deepEqual(
    await expectRequest(
      201,
      'POST',
      `editorial/article-reviews/${created.id}/decision`,
      approvalBody,
      staff,
      approvalKey
    ),
    approved
  );
  assert.equal(await outboxCount(), beforeOutbox + 1);
  assert.equal((await publicRead()).status, 503);
  await materialize(created.id);
  const originalProjection = await projections.find('article', created.id);
  const original = (await publicRead()).json;
  assert.equal(original.title, fields.title);
  assert.equal(original.byline, fields.byline);
  assert.deepEqual(original.sections, fields.sections);
  assert.equal(original.ownerIdentityId, undefined);
  assert.equal((await draft(created.id)).title, editedFields.title);
  pass(
    'immutable submitted content, independent staff review, conflicting edits and atomic publication/decision/revision/receipt/outbox rollback'
  );

  const listing = await expectRequest(
    200,
    'GET',
    'catalog/articles?q=reviewed&category=Guides&tag=offline&page=1',
    undefined,
    null
  );
  assert.equal(listing.total, 1);
  assert.equal(listing.items[0].sections, undefined);
  assert.equal(
    (
      await expectRequest(
        200,
        'GET',
        'catalog/articles?category=Other',
        undefined,
        null
      )
    ).total,
    0
  );
  assert.equal(
    (await expectRequest(200, 'GET', 'catalog/articles?q=%25', undefined, null))
      .total,
    0
  );
  assert.equal(
    (
      await expectRequest(
        200,
        'GET',
        'catalog/articles?page=2',
        undefined,
        null
      )
    ).items.length,
    0
  );
  await expectRequest(
    400,
    'GET',
    'catalog/articles?page=1&page=2',
    undefined,
    null
  );
  await expectRequest(
    400,
    'GET',
    'catalog/articles?ownerIdentityId=private',
    undefined,
    null
  );
  const selection = await expectRequest(
    200,
    'GET',
    `catalog/article-selection?ids=${created.id},${randomUUID()}`,
    undefined,
    null
  );
  assert.equal(selection.items.length, 1);
  assert.equal(selection.items[0].id, created.id);
  assert.equal(selection.items[0].sections, undefined);
  await expectRequest(409, 'PUT', `me/articles/${created.id}`, {
    ...fields,
    slug: 'changed-url',
    expectedRevision: approved.revision,
  });
  await expectRequest(409, 'DELETE', `me/articles/${created.id}`, {
    expectedRevision: approved.revision,
  });
  await restart();
  assert.equal((await publicRead()).json.title, fields.title);
  assert.equal((await draft(created.id)).title, editedFields.title);
  assert.deepEqual(
    await expectRequest(
      201,
      'POST',
      `editorial/article-reviews/${created.id}/decision`,
      approvalBody,
      staff,
      approvalKey
    ),
    approved
  );
  pass(
    'canonical article list/detail/filters/pagination/ID selection, separate private editing and durable state after API restart'
  );

  await submit(created.id);
  await decide(created.id, 'reject');
  assert.equal(
    (await status(created.id)).latestSubmission.reason,
    'Please add supporting details.'
  );
  assert.deepEqual((await publicRead()).json, original);
  await submit(created.id);
  await decide(created.id);
  assert.equal((await publicRead()).status, 503);
  await materialize(created.id);
  const replacement = (await publicRead()).json;
  assert.equal(replacement.title, editedFields.title);
  assert.equal(replacement.publishedAt, original.publishedAt);
  assert.ok(replacement.updatedAt >= original.updatedAt);
  assert.equal(await projections.publish(originalProjection), 'superseded');
  await submit(created.id);
  const beforeWithdrawal = await status(created.id),
    withdrawalKey = randomUUID();
  const withdrawalBody = {
    expectedRevision: beforeWithdrawal.revision,
    expectedPublicationRevision: beforeWithdrawal.publicationRevision,
  };
  const withdrawn = await expectRequest(
    201,
    'POST',
    `me/articles/${created.id}/withdraw`,
    withdrawalBody,
    owner,
    withdrawalKey
  );
  assert.equal((await publicRead()).status, 404);
  assert.equal((await status(created.id)).latestSubmission.status, 'cancelled');
  assert.equal(
    (
      await expectRequest(
        200,
        'GET',
        `catalog/article-selection?ids=${created.id}`,
        undefined,
        null
      )
    ).items.length,
    0
  );
  assert.equal((await projections.find('article', created.id)).deletedAt, null);
  const collision = await expectRequest(
    201,
    'POST',
    'me/articles',
    fields,
    other
  );
  await submit(collision.id, other);
  await decide(collision.id, 'approve', staff, undefined, 409);
  assert.equal((await status(collision.id, other)).publicationRevision, null);
  assert.equal(
    (await status(collision.id, other)).latestSubmission.status,
    'submitted'
  );
  await withdraw(collision.id, other);
  await submit(created.id);
  await decide(created.id);
  await materialize(created.id);
  assert.deepEqual(
    await expectRequest(
      201,
      'POST',
      `me/articles/${created.id}/withdraw`,
      withdrawalBody,
      owner,
      withdrawalKey
    ),
    withdrawn
  );
  assert.equal((await publicRead()).status, 200);
  pass(
    'rejection preserves approved content; revision replacement, immediate withdrawal under projection lag, retained URLs and historical retry cannot reapply withdrawal'
  );

  const pending = [];
  for (const [index, author] of [owner, other].entries()) {
    const item = await expectRequest(
      201,
      'POST',
      'me/articles',
      { ...fields, slug: `concurrent-${index}` },
      author
    );
    await submit(item.id, author);
    const current = await status(item.id, author);
    pending.push({
      id: item.id,
      body: {
        decision: 'approve',
        expectedRevision: current.revision,
        expectedPublicationRevision: null,
        submittedRevision: current.latestSubmission.submittedRevision,
        reason: '',
      },
    });
  }
  const crossedKey = randomUUID();
  const crossed = await Promise.all(
    pending.map((item) =>
      request(
        'POST',
        `editorial/article-reviews/${item.id}/decision`,
        item.body,
        staff,
        crossedKey
      )
    )
  );
  assert.deepEqual(crossed.map((value) => value.status).sort(), [201, 409]);
  const winner = crossed.findIndex((value) => value.status === 201),
    loser = 1 - winner;
  assert.equal(
    (await status(pending[loser].id, loser === 0 ? owner : other))
      .latestSubmission.status,
    'submitted'
  );
  for (const item of pending) {
    const author = item === pending[0] ? owner : other;
    await withdraw(item.id, author);
  }
  pass(
    'concurrent staff commands across different owners serialize a shared idempotency namespace without duplicate effects or partial decisions'
  );

  const migration = new ArticleWorkspace1791676818000(),
    runner = source.createQueryRunner();
  try {
    await migration.up(runner);
    await assert.rejects(migration.down(), /data-preserving/);
    await source.query(
      "UPDATE article_submissions SET reviewerIdentityId = ? WHERE articleId = ? AND status = 'approved'",
      [owner.identityId, created.id]
    );
    try {
      await assert.rejects(
        migration.up(runner),
        /^Error: Invalid independent Editorial review attribution$/
      );
    } finally {
      await source.query(
        "UPDATE article_submissions SET reviewerIdentityId = ? WHERE articleId = ? AND status = 'approved'",
        [staff.identityId, created.id]
      );
    }
    await source.query(
      'RENAME TABLE article_commands TO article_commands_missing'
    );
    try {
      await assert.rejects(migration.up(runner), /Missing completed/);
    } finally {
      await source.query(
        'RENAME TABLE article_commands_missing TO article_commands'
      );
    }
    await migration.up(runner);
  } finally {
    await runner.release();
  }
  pass(
    'additive populated migration reentry validates independent reviewers, refuses lost completed tables and destructive rollback'
  );

  if (broker)
    await require('./article-publication-delivery.cjs').articlePublicationDelivery(
      {
        source,
        reader,
        projections,
        collection,
        ...broker,
        id: created.id,
        withdraw: () => withdraw(created.id),
        pass,
      }
    );
  else await withdraw(created.id);
  assert.equal((await publicRead()).status, 404);
  const deleting = await draft(created.id);
  const deleteKey = randomUUID();
  const deleted = await expectRequest(
    200,
    'DELETE',
    `me/articles/${created.id}`,
    { expectedRevision: deleting.revision },
    owner,
    deleteKey
  );
  assert.equal(
    (
      await source.query('SELECT fields FROM article_drafts WHERE id = ?', [
        created.id,
      ])
    )[0].fields,
    null
  );
  assert.equal(
    (
      await source.query(
        'SELECT articleId FROM article_submissions WHERE articleId = ?',
        [created.id]
      )
    ).length,
    0
  );
  await restart();
  await expectRequest(404, 'GET', `me/articles/${created.id}`);
  assert.equal((await publicRead()).status, 404);
  assert.deepEqual(
    await expectRequest(
      200,
      'DELETE',
      `me/articles/${created.id}`,
      { expectedRevision: deleting.revision },
      owner,
      deleteKey
    ),
    deleted
  );
  assert.deepEqual(
    await expectRequest(201, 'POST', 'me/articles', fields, owner, rollbackKey),
    created
  );
  const finalRunner = source.createQueryRunner();
  try {
    await migration.up(finalRunner);
  } finally {
    await finalRunner.release();
  }
  pass(
    'explicit withdrawal then private deletion retains publication tombstones and canonical URL, erases private payload, survives restart and never resurrects on old receipts'
  );

  await qualifyBrowser?.();
  const beforeCommands = Number(
    (await source.query('SELECT COUNT(*) AS total FROM article_commands'))[0]
      .total
  );
  await stopPolicy();
  await expectRequest(503, 'GET', 'me/articles');
  await expectRequest(503, 'POST', 'me/articles', fields);
  assert.equal(
    Number(
      (await source.query('SELECT COUNT(*) AS total FROM article_commands'))[0]
        .total
    ),
    beforeCommands
  );
  pass(
    'OPA outage fails closed before private reads or writes without producing receipts'
  );
}
module.exports = { articlePublicationChecks };
