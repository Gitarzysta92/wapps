const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function applicationOwnershipHttpChecks({
  source,
  records,
  restart,
  origin,
  secret,
  pass,
}) {
  const owner = 'HttpVerifiedMaintainer';
  const reviewer = 'HttpOwnershipReviewer';
  async function request(
    method,
    route,
    body,
    uid = owner,
    roles = [],
    key = randomUUID(),
    tenantId = 'default'
  ) {
    const response = await fetch(origin() + '/api/' + route, {
      method,
      headers: {
        'content-type': 'application/json',
        'idempotency-key': key,
        ...(uid
          ? {
              'x-user-id': uid,
              'x-user-claims': JSON.stringify({ tenantId, roles }),
              'x-ingress-auth': secret,
            }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    return {
      status: response.status,
      json: await response.json(),
      cache: response.headers.get('cache-control'),
      retryAfter: response.headers.get('retry-after'),
    };
  }
  const post = async (...args) => {
    const result = await request('POST', ...args);
    assert.equal(result.status, 201, JSON.stringify(result.json));
    if (args[0] !== 'apps') assert.equal(result.cache, 'no-store');
    return result.json;
  };
  const get = async (...args) => {
    const result = await request('GET', args[0], undefined, ...args.slice(1));
    assert.equal(result.status, 200, JSON.stringify(result.json));
    assert.equal(result.cache, 'no-store');
    return result.json;
  };
  const fields = {
    name: 'HTTP Ownership Application',
    slug: 'http-ownership-application',
    website: 'https://http-ownership.example.test',
    description:
      'An application claimed and edited through the compiled HTTP service.',
  };
  const app = await post('apps', fields, 'HttpCatalogAuthor', [
    'editorial:publisher',
  ]);
  const claimInput = {
    applicationId: app.id,
    evidenceUrl: fields.website + '/team',
    notes: 'I control and maintain the application and its official website.',
  };
  for (const route of [
    'me/ownership-claims',
    'editorial/ownership-reviews',
    'me/application-drafts/canonical/' + app.id,
  ])
    assert.equal((await request('GET', route, undefined, '')).status, 401);
  assert.equal(
    (await request('GET', 'me/ownership-claims?page=0')).status,
    400
  );
  assert.equal(
    (
      await request('POST', 'me/ownership-claims', {
        ...claimInput,
        hostname: 'attacker.example.test',
      })
    ).status,
    400
  );
  const missing = await post('me/ownership-claims', claimInput);
  const missingBase = 'me/ownership-claims/' + missing.id;
  const negative = await post(missingBase + '/verify', { expectedRevision: 1 });
  assert.equal(negative.proofMatched, false);
  const cooldown = await request('POST', missingBase + '/verify', {
    expectedRevision: 2,
  });
  assert.equal(cooldown.status, 429);
  assert.equal(cooldown.retryAfter, '30');
  await post(missingBase + '/cancel', { expectedRevision: 2 });
  const createKey = randomUUID();
  const claim = await post(
    'me/ownership-claims',
    claimInput,
    owner,
    [],
    createKey
  );
  assert.deepEqual(
    await post('me/ownership-claims', claimInput, owner, [], createKey),
    claim
  );
  const base = 'me/ownership-claims/' + claim.id;
  const details = await get(base);
  assert.equal(details.hostname, 'http-ownership.example.test');
  records.set(details.challengeName, details.challengeValue);
  assert.equal(
    (await request('GET', base, undefined, 'OtherMaintainer')).status,
    404
  );
  assert.equal(
    (await request('GET', base, undefined, owner, [], randomUUID(), 'other'))
      .status,
    404
  );
  assert.equal(
    (await request('POST', base + '/approve', { expectedRevision: 1 })).status,
    400
  );
  const proofKey = randomUUID();
  const verified = await post(
    base + '/verify',
    { expectedRevision: 1 },
    owner,
    [],
    proofKey
  );
  assert.equal(verified.proofMatched, true);
  assert.deepEqual(
    await post(base + '/verify', { expectedRevision: 1 }, owner, [], proofKey),
    verified
  );
  const decisionRoute = 'editorial/ownership-reviews/' + claim.id + '/decision';
  const approve = { decision: 'approve', expectedRevision: 2 };
  assert.equal(
    (
      await request('POST', decisionRoute, approve, reviewer, [
        'editorial:reviewer',
      ])
    ).status,
    403
  );
  assert.equal(
    (await request('POST', decisionRoute, approve, owner, ['admin'])).status,
    403
  );
  assert.equal(
    (
      await request('GET', 'editorial/ownership-reviews', undefined, reviewer, [
        'editorial:reviewer',
      ])
    ).status,
    403
  );
  const queue = await get('editorial/ownership-reviews', reviewer, [
    'editorial:ownership-reviewer',
  ]);
  assert(queue.items.some((item) => item.id === claim.id));
  const beforeRestart = await get(base);
  await restart();
  assert.deepEqual(await get(base), beforeRestart);
  const approved = await post(decisionRoute, approve, reviewer, [
    'editorial:ownership-reviewer',
  ]);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.applicationRevision, 2);
  const grantsRoute = 'editorial/ownership-reviews?view=grants';
  const reviewRoles = ['editorial:ownership-reviewer'];
  assert(
    (await get(grantsRoute, reviewer, reviewRoles)).items.some(
      (item) => item.id === claim.id
    )
  );
  assert(
    !(
      await get('editorial/ownership-reviews', reviewer, reviewRoles)
    ).items.some((item) => item.id === claim.id)
  );
  assert(
    !(await get(grantsRoute, owner, ['admin'])).items.some(
      (item) => item.id === claim.id
    )
  );
  assert(
    !(
      await get(grantsRoute, reviewer, reviewRoles, randomUUID(), 'other')
    ).items.some((item) => item.id === claim.id)
  );
  assert.equal(
    (
      await request('GET', grantsRoute, undefined, reviewer, [
        'editorial:reviewer',
      ])
    ).status,
    403
  );
  for (const route of [
    'me/ownership-claims?view=grants',
    'editorial/ownership-reviews?view=all',
    'editorial/ownership-reviews?view=grants&tenantId=other',
  ])
    assert.equal(
      (await request('GET', route, undefined, reviewer, reviewRoles)).status,
      400
    );
  pass(
    'active ownership grants are discoverable only by independent ownership reviewers in the same tenant; invalid and authority-overriding list queries fail'
  );
  pass(
    'compiled ownership HTTP routes enforce private access and dedicated independent review, perform real DNS proof, map rate limits, replay receipts and survive API restart'
  );

  const canonicalRoute = 'me/application-drafts/canonical/' + app.id;
  const canonical = await get(canonicalRoute);
  const canonicalFields = canonical.fields;
  const editing = {
    applicationId: canonical.applicationId,
    claimId: canonical.claimId,
    sourcePublicationRevision: canonical.sourcePublicationRevision,
  };
  assert.equal(editing.claimId, claim.id);
  const openInput = {
    editing,
    fields: { ...canonicalFields, name: 'Verified HTTP update' },
  };
  const draft = await post('me/application-drafts/from-application', openInput);
  assert.notEqual(draft.id, app.id);
  const draftBase = 'me/application-drafts/' + draft.id;
  assert.equal(
    (await request('GET', draftBase, undefined, 'HttpCatalogAuthor')).status,
    404
  );
  await post(draftBase + '/submit', { expectedRevision: 1 });
  const contentReview =
    'editorial/application-reviews/' + draft.id + '/decision';
  assert.equal(
    (
      await request(
        'POST',
        contentReview,
        { decision: 'approve', expectedRevision: 2, submittedRevision: 1 },
        reviewer,
        ['editorial:ownership-reviewer']
      )
    ).status,
    403
  );
  const publication = await post(
    contentReview,
    { decision: 'approve', expectedRevision: 2, submittedRevision: 1 },
    reviewer,
    ['editorial:reviewer']
  );
  assert.equal(publication.publicationRevision, 3);
  const [publicRow] = await source.query(
    'SELECT name FROM app_records WHERE id = ?',
    [app.id]
  );
  assert.equal(publicRow.name, openInput.fields.name);
  assert.equal(
    (await source.query('SELECT id FROM app_records WHERE id = ?', [draft.id]))
      .length,
    0
  );
  await post(draftBase + '/submit', { expectedRevision: 3 });
  const correction = await request(
    'PUT',
    'apps/' + app.id,
    { name: 'Staff HTTP correction', expectedRevision: 3 },
    'HttpModerator',
    ['editorial:moderator']
  );
  assert.equal(correction.status, 200, JSON.stringify(correction.json));
  assert.equal(
    (
      await request(
        'POST',
        contentReview,
        { decision: 'approve', expectedRevision: 4, submittedRevision: 3 },
        reviewer,
        ['editorial:reviewer']
      )
    ).status,
    409
  );
  const refreshed = await get(canonicalRoute);
  const currentFields = refreshed.fields;
  const currentTarget = {
    applicationId: refreshed.applicationId,
    claimId: refreshed.claimId,
    sourcePublicationRevision: refreshed.sourcePublicationRevision,
  };
  const merged = await post(draftBase + '/rebase', {
    expectedRevision: 4,
    editing: currentTarget,
    fields: currentFields,
  });
  assert.equal(merged.revision, 5);
  assert.equal(
    (await get(draftBase + '/publication')).latestSubmission.status,
    'cancelled'
  );
  await restart();
  assert.equal((await get(draftBase)).name, 'Staff HTTP correction');
  assert.equal((await get(draftBase)).editing.sourcePublicationRevision, 4);
  await post(draftBase + '/submit', { expectedRevision: 5 });
  await post(base + '/release', { expectedRevision: 3 });
  assert(
    !(await get(grantsRoute, reviewer, reviewRoles)).items.some(
      (item) => item.id === claim.id
    )
  );
  assert.equal(
    (
      await request(
        'POST',
        contentReview,
        { decision: 'approve', expectedRevision: 6, submittedRevision: 5 },
        reviewer,
        ['editorial:reviewer']
      )
    ).status,
    403
  );
  assert.equal(
    (await request('POST', draftBase + '/withdraw', { expectedRevision: 6 }))
      .status,
    403
  );
  assert.equal((await request('GET', canonicalRoute)).status, 404);
  const removed = await request('DELETE', draftBase, { expectedRevision: 6 });
  assert.equal(removed.status, 200, JSON.stringify(removed.json));
  assert.equal(
    (
      await source.query('SELECT name FROM app_records WHERE id = ?', [app.id])
    )[0].name,
    'Staff HTTP correction'
  );
  assert.deepEqual(
    await post(base + '/verify', { expectedRevision: 1 }, owner, [], proofKey),
    verified
  );
  assert.equal((await get(base)).status, 'revoked');
  pass(
    'compiled verified-owner editing preserves canonical identity, requires content review, recovers revision conflicts across restart and enforces grant release without erasing public content'
  );
  return async () => {
    assert.equal((await request('GET', 'me/ownership-claims')).status, 503);
    assert.equal((await request('GET', canonicalRoute)).status, 503);
    assert.equal(
      (await request('POST', 'me/ownership-claims', claimInput)).status,
      503
    );
    pass(
      'ownership and canonical editing HTTP access fail closed during a real policy outage'
    );
  };
}

module.exports = { applicationOwnershipHttpChecks };
