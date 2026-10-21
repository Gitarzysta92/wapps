const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const {
  MysqlReviews,
} = require('../../apps/services/community/src/app/reviews/infrastructure/mysql-reviews');

// The caller owns fresh disposable stores and the real Community/BFF/nginx instances.
module.exports = async function qualifyReviewBff({
  source,
  mongo,
  call,
  applicationId,
  actors,
  secret,
  ownerOrigin,
  gateways,
  setParentVisible,
  setParentAvailable,
  setPolicyAvailable,
  recreate,
  bffCount,
  pass,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const base = `application-reviews/${applicationId}`;
  const bindingKey = 'wapps:application:' + applicationId;
  const selector = '?bindingKey=' + encodeURIComponent(bindingKey);
  const actor = actors.get('peer');
  const content = {
    displayName: 'Historical peer',
    rating: 2,
    text: 'Persisted before the generic API.',
  };
  const historicalKey = randomUUID(),
    historicalId = randomUUID(),
    at = Date.now();
  const change = { type: 'publish', expectedRevision: 0, content };
  // This is the pre-migration SQL representation and fingerprint, without a consumer key.
  const historical = await new MysqlReviews(source).transaction(
    { tenantId: actor.tenantId, applicationId },
    actor.identityId,
    (tx) =>
      tx.commit({
        at,
        change,
        command: {
          actorId: actor.identityId,
          key: historicalKey,
          fingerprint: createHash('sha256')
            .update(JSON.stringify({ id: null, change }))
            .digest('hex'),
        },
        record: {
          id: historicalId,
          ownerId: actor.identityId,
          content,
          revision: 1,
          contentRevision: 1,
          hidden: false,
          withdrawn: false,
          moderationReason: null,
          createdAt: at,
          updatedAt: at,
        },
      })
  );
  const publish = { expectedRevision: 0, content };
  const replay = (options = {}) =>
    call(base + '/mine', {
      method: 'PUT',
      user: 'peer',
      body: publish,
      key: historicalKey,
      ...options,
    });
  const detail = (options = {}) => call(base + '/' + historicalId, options);
  async function owner(route, status = 200, user = null) {
    const member = user && actors.get(user);
    const response = await fetch(ownerOrigin + '/api/' + route, {
      headers: {
        'X-Ingress-Auth': secret,
        'X-Anonymous': member ? 'false' : 'true',
        ...(member
          ? {
              'X-User-Id': member.identityId,
              'X-User-Claims': JSON.stringify({
                tenantId: member.tenantId,
                roles: member.roles,
              }),
            }
          : {}),
      },
    });
    assert.equal(response.status, status, route);
    const value = await response.json();
    if (status === 503) assert.ok(!JSON.stringify(value).includes('fixture'));
    return value;
  }
  async function count(table) {
    assert.ok(
      ['review_events', 'review_versions', 'review_commands'].includes(table)
    );
    const [row] = await source.query(
      `SELECT COUNT(*) AS n FROM ${table} WHERE reviewId=?`,
      [historicalId]
    );
    return Number(row.n);
  }

  for (const gateway of gateways) {
    const before = bffCount();
    const visible = await detail({ user: null, at: gateway });
    assert.equal(visible.applicationId, applicationId);
    assert.ok(!('bindingKey' in visible));
    assert.ok(!('ownerId' in visible));
    assert.deepEqual(await replay({ at: gateway }), historical);
    assert.ok(
      bffCount() >= before + 2,
      'Review reads and commands must traverse BFF'
    );
  }
  for (const result of await Promise.all([replay(), replay(), replay()]))
    assert.deepEqual(result, historical);
  assert.equal(await count('review_events'), 1);
  assert.equal(await count('review_versions'), 1);
  assert.equal(await count('review_commands'), 1);
  await replay({
    body: { ...publish, content: { ...content, rating: 3 } },
    status: 409,
  });
  const generic = await owner('reviews/' + historicalId + selector);
  assert.equal(generic.bindingKey, bindingKey);
  assert.ok(!('applicationId' in generic));
  for (const query of [
    '',
    '?bindingKey=',
    selector + '&bindingKey=other',
    selector + '&applicationId=' + applicationId,
  ])
    await owner('reviews/' + historicalId + query, 400);
  for (const context of [
    bindingKey.toUpperCase(),
    applicationId,
    'other:' + applicationId,
    'wapps:application:' + randomUUID(),
  ])
    await owner(
      'reviews/' + historicalId + '?bindingKey=' + encodeURIComponent(context),
      404
    );
  await owner('reviews/' + historicalId + selector, 404, 'foreign');
  await owner('reviews/' + historicalId + selector, 403, 'denied');
  await owner(base + '/' + historicalId, 404);
  await call(base + selector, { status: 400 });
  await call(`application-reviews/${randomUUID()}/${historicalId}`, {
    status: 404,
  });
  await call(base + '/' + historicalId, {
    method: 'DELETE',
    body: { expectedRevision: 1 },
    status: 403,
  });
  await replay({ user: null, status: 401 });
  await call(base + '/moderation', { user: 'peer', status: 403 });
  await call(base + '/' + historicalId + '/helpful', {
    method: 'PUT',
    user: 'peer',
    body: { expectedRevision: 1, helpful: true },
    status: 403,
  });
  pass(
    'Review generic owner and dedicated BFF mapping: historical SQL receipt, concurrent exact replay, key/tenant/author isolation and retired owner route denial'
  );

  let current = historical;
  const command = async (suffix, type, fields, user) => {
    current = await call(
      base + '/' + (suffix === 'mine' ? 'mine' : historicalId + suffix),
      {
        method: type,
        user,
        body: { expectedRevision: current.revision, ...fields },
      }
    );
    return current;
  };
  await command('/helpful', 'PUT', { helpful: true }, 'owner');
  assert.equal((await detail()).helpfulCount, 1);
  await command(
    '/reports',
    'POST',
    { reason: 'Check historical text.' },
    'owner'
  );
  await call(base + '/' + historicalId + '/reports', {
    method: 'POST',
    body: { expectedRevision: current.revision, reason: 'Duplicate.' },
    status: 409,
  });
  assert.deepEqual(
    (await call(base + '/' + historicalId + '/reports', { user: 'admin' }))
      .items[0].content,
    content
  );
  await command(
    '/moderation',
    'PUT',
    { hidden: true, reason: 'Staff review.' },
    'admin'
  );
  await detail({ user: null, status: 404 });
  assert.equal((await call(base + '/summary', { user: null })).total, 1);
  assert.equal((await call(base, { user: 'peer' })).mine.hidden, true);
  await command(
    'mine',
    'PUT',
    { content: { ...content, rating: 5, text: 'Corrected text.' } },
    'peer'
  );
  await detail({ user: null, status: 404 });
  assert.deepEqual(
    (await call(base + '/' + historicalId + '/reports', { user: 'admin' }))
      .items[0].content,
    content
  );
  await command('', 'DELETE', {}, 'peer');
  await command(
    '/moderation',
    'PUT',
    { hidden: false, reason: 'Restore moderation.' },
    'admin'
  );
  const withdrawn = await detail({ user: 'peer' });
  assert.equal(withdrawn.withdrawn, true);
  assert.equal(withdrawn.hidden, false);
  await detail({ user: null, status: 404 });
  await command('mine', 'PUT', { content }, 'peer');
  assert.equal((await detail({ user: null })).helpfulCount, 1);
  await command('/helpful', 'PUT', { helpful: false }, 'owner');
  assert.equal((await detail()).helpfulCount, 0);
  assert.deepEqual(await replay(), historical);
  pass(
    'Review helpful votes, immutable reported evidence, staff hiding, author edits, withdrawal, independent restoration and current rating totals'
  );

  const expected = current.revision;
  const recoveryKey = randomUUID();
  const recovery = {
    expectedRevision: expected,
    content: { ...content, text: 'Recovered transaction.' },
  };
  const before = await Promise.all(
    ['review_events', 'review_versions', 'review_commands'].map(count)
  );
  await source.query(
    "CREATE TRIGGER review_api_qualification_failure BEFORE INSERT ON review_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='qualification rollback'"
  );
  try {
    await call(base + '/mine', {
      method: 'PUT',
      user: 'peer',
      body: recovery,
      key: recoveryKey,
      status: 503,
    });
  } finally {
    await source.query('DROP TRIGGER review_api_qualification_failure');
  }
  assert.deepEqual(
    await Promise.all(
      ['review_events', 'review_versions', 'review_commands'].map(count)
    ),
    before
  );
  assert.equal((await detail({ user: 'peer' })).revision, expected);
  current = await call(base + '/mine', {
    method: 'PUT',
    user: 'peer',
    body: recovery,
    key: recoveryKey,
  });
  assert.equal(current.revision, expected + 1);
  assert.deepEqual(
    await call(base + '/mine', {
      method: 'PUT',
      user: 'peer',
      body: recovery,
      key: recoveryKey,
    }),
    current
  );
  pass(
    'Review SQL journal failure rolls back content, state and receipts together; exact retry commits once'
  );

  setParentVisible(false);
  try {
    await detail({ status: 404 });
    await replay({ status: 404 });
  } finally {
    setParentVisible(true);
  }
  setParentAvailable(false);
  try {
    await detail({ status: 503 });
    await replay({ status: 503 });
  } finally {
    setParentAvailable(true);
  }
  setPolicyAvailable(false);
  try {
    await detail({ status: 503 });
    await replay({ status: 503 });
  } finally {
    setPolicyAvailable(true);
  }
  await mongo.close();
  try {
    assert.equal((await detail({ user: 'peer' })).revision, current.revision);
    assert.deepEqual(await replay(), historical);
    await command('/helpful', 'PUT', { helpful: true }, 'owner');
  } finally {
    await mongo.connect();
  }
  await recreate(async () => {
    await detail({ status: 503 });
    await replay({ status: 503 });
  });
  assert.equal((await detail({ user: 'peer' })).revision, current.revision);
  assert.deepEqual(await replay(), historical);
  pass(
    'Review parent revocation and provider outages fail closed; SQL remains current without Mongo; owner/BFF recreation retains receipts and state'
  );
};
