const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

async function qualifyApplicationParity({
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
  const base = '/api/me/application-drafts',
    reviews = '/api/editorial/application-reviews';
  const claims = '/api/me/ownership-claims',
    ownershipReviews = '/api/editorial/ownership-reviews';
  async function request(
    route,
    {
      actor,
      at = local,
      body,
      method,
      status = 200,
      headers = {},
      cache = 'private, no-store',
    } = {}
  ) {
    const response = await fetch(at + route, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(25000),
    });
    const text = await response.text();
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      `${method ?? 'request'} ${route}: HTTP ${
        response.status
      }, expected ${status}: ${text.slice(0, 240)}`
    );
    if (response.status >= 200 && response.status < 500 && cache !== undefined)
      assert.equal(response.headers.get('cache-control'), cache);
    if (response.status === 503)
      assert.equal(response.headers.get('retry-after'), '2');
    return text.startsWith('{') || text.startsWith('[')
      ? JSON.parse(text)
      : text;
  }
  const change = (route, actor, body, options = {}) =>
    request(route, {
      actor,
      body,
      method: 'POST',
      status: 201,
      ...options,
      headers: {
        'Idempotency-Key': options.key ?? randomUUID(),
        ...options.headers,
      },
    });
  const members = [];
  for (const [name, roles, tenantId] of [
    ['author', []],
    ['maintainer', ['editorial:reviewer', 'editorial:ownership-reviewer']],
    ['reviewer', ['editorial:reviewer']],
    ['ownership-staff', ['editorial:ownership-reviewer']],
    ['successor', []],
    [
      'foreign',
      ['editorial:reviewer', 'editorial:ownership-reviewer'],
      'foreign-application-tenant',
    ],
    ['other', []],
  ]) {
    const email = `application-${name}@example.test`;
    let member = await call('/auth/register', {
      at: local,
      body: { ...input, email, nickname: `Application ${name}` },
      headers: { 'Idempotency-Key': 'application-register-' + name },
    });
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
  const [author, maintainer, reviewer, staff, successor, foreign, other] =
    members;
  const second = await call('/auth/signin', {
    at: alpha,
    body: { email: author.email, password: input.password },
  });
  assert.equal(second.uid, author.uid);
  assert.notEqual(second.token, author.token);
  const fields = {
    name: 'Application frozen evidence',
    slug: 'application-parity-' + randomUUID(),
    website: 'https://application-parity.example.test/',
    description: 'Independently reviewed application content.',
    classification: 'general',
  };
  const publicPath = '/api/catalog/apps/' + fields.slug;
  const status = (id, actor = author, options = {}) =>
    request(`${base}/${id}/publication`, { actor, ...options });
  const submit = (id, revision, actor = author, options = {}) =>
    change(
      `${base}/${id}/submit`,
      actor,
      { expectedRevision: revision },
      options
    );
  const decision = (id, body, actor = reviewer, options = {}) =>
    change(
      `${reviews}/${id}/decision`,
      actor,
      { decision: 'approve', reason: '', ...body },
      options
    );
  const update = (id, revision, fields, actor = author, options = {}) =>
    change(
      `${base}/${id}`,
      actor,
      { ...fields, expectedRevision: revision },
      { method: 'PUT', status: 200, ...options }
    );
  const remove = (id, revision, actor, options = {}) =>
    change(
      `${base}/${id}`,
      actor,
      { expectedRevision: revision },
      { method: 'DELETE', status: 200, ...options }
    );
  const source = (id, actor, options = {}) =>
    request(`${base}/canonical/${id}`, { actor, ...options });
  const open = (value, actor, options = {}) =>
    change(
      base + '/from-application',
      actor,
      {
        fields: value.fields,
        editing: {
          applicationId: value.applicationId,
          claimId: value.claimId,
          sourcePublicationRevision: value.sourcePublicationRevision,
        },
      },
      options
    );
  const ownDecision = (
    id,
    revision,
    decision = 'approve',
    actor = staff,
    options = {}
  ) =>
    change(
      `${ownershipReviews}/${id}/decision`,
      actor,
      {
        decision,
        expectedRevision: revision,
        reason: 'Independent ownership decision.',
      },
      options
    );
  const claimRead = (id, actor = maintainer, options = {}) =>
    request(`${claims}/${id}`, { actor, ...options });
  const claimChange = (
    id,
    action,
    revision,
    actor = maintainer,
    options = {}
  ) =>
    change(
      `${claims}/${id}/${action}`,
      actor,
      { expectedRevision: revision },
      options
    );
  const contentFields = ({
    name,
    slug,
    website,
    description,
    classification,
  }) => ({ name, slug, website, description, classification });
  const state = async (id) =>
    (
      await services.sql.query(
        "SELECT * FROM editorial_resource_states WHERE resourceKind='app' AND resourceId=?",
        [id]
      )
    )[0];
  async function projected(id, revision) {
    for (let attempt = 0; attempt < 120; attempt++) {
      services.assertWorker();
      const projection = await services.projections.findOne({
        kind: 'app',
        resourceId: id,
      });
      if (projection?.revision === revision)
        return request(publicPath, { cache: 'no-store' });
      await delay(100);
    }
    assert.fail('Application projection did not converge');
  }
  const createKey = randomUUID();
  const created = await Promise.all(
    origins.map((at) => change(base, author, fields, { at, key: createKey }))
  );
  assert.deepEqual(created[0], created[1]);
  const id = created[0].id;
  assert.deepEqual(
    contentFields(await request(`${base}/${id}`, { actor: second, at: alpha })),
    fields
  );
  await change(
    base,
    author,
    { ...fields, name: 'Conflicting receipt' },
    { key: createKey, status: 409 }
  );
  for (const actor of [other, foreign]) {
    await request(`${base}/${id}`, { actor, status: 404 });
    await update(id, 1, fields, actor, { status: 404 });
    await submit(id, 1, actor, { status: 404 });
  }
  await request(`${base}/${id}`, {
    actor: other,
    status: 404,
    headers: {
      'X-User-Id': author.uid,
      'X-User-Claims': '{"roles":["admin"]}',
      'X-Ingress-Auth': 'forged',
    },
  });
  await request(publicPath, { status: 404, cache: 'no-store' });
  const submissionKey = randomUUID();
  const submission = await submit(id, 1, author, { key: submissionKey });
  assert.deepEqual(
    await submit(id, 1, second, { key: submissionKey, at: alpha }),
    submission
  );
  await update(id, 2, {
    ...fields,
    name: 'Private replacement',
    classification: 'mature',
  });
  const frozen = await status(id);
  assert.deepEqual(contentFields(frozen.latestSubmission), fields);
  await decision(id, { expectedRevision: 2, submittedRevision: 1 }, reviewer, {
    status: 409,
  });
  await decision(id, { expectedRevision: 3, submittedRevision: 2 }, reviewer, {
    status: 409,
  });
  await decision(id, { expectedRevision: 3, submittedRevision: 1 }, author, {
    status: 403,
  });
  await decision(id, { expectedRevision: 3, submittedRevision: 1 }, foreign, {
    status: 404,
  });
  const self = await change(base, reviewer, {
    ...fields,
    slug: fields.slug + '-self',
  });
  await submit(self.id, 1, reviewer);
  await decision(
    self.id,
    { expectedRevision: 2, submittedRevision: 1 },
    reviewer,
    { status: 403 }
  );
  await remove(self.id, 2, reviewer);
  console.log(
    'PASS application independent sessions, canonical owner/tenant isolation, forged-header denial, immutable submission/classification and self-review denial'
  );

  const approvalKey = randomUUID(),
    approvalBody = { expectedRevision: 3, submittedRevision: 1 };
  await services.sql.query(
    "CREATE TRIGGER application_parity_outbox BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='application outbox rollback'"
  );
  try {
    await decision(id, approvalBody, reviewer, {
      key: approvalKey,
      status: 503,
    });
  } finally {
    await services.sql.query('DROP TRIGGER application_parity_outbox');
  }
  assert.deepEqual(await status(id), frozen);
  assert.equal(await state(id), undefined);
  const approved = await Promise.all(
    origins.map((at) =>
      decision(id, approvalBody, reviewer, { key: approvalKey, at })
    )
  );
  assert.deepEqual(approved[0], approved[1]);
  assert.equal(approved[0].publicationRevision, 1);
  await request(publicPath, { status: 503, cache: 'no-store' });
  await services.startWorker();
  const published = await projected(id, 1);
  assert.deepEqual(contentFields(published), fields);
  await services.restartEditorial();
  await restartAccount();
  await restartBff();
  assert.deepEqual(
    await decision(id, approvalBody, reviewer, { key: approvalKey }),
    approved[0]
  );
  assert.equal(Number((await state(id)).revision), 1);
  await services.pauseMongo();
  try {
    await request(publicPath, { status: 503, cache: 'no-store' });
    await status(id);
  } finally {
    await services.resumeMongo();
  }
  assert.deepEqual(await projected(id, 1), published);
  console.log(
    'PASS publication/outbox rollback and concurrent exact replay, real broker projection, truthful lag, frozen public fields and process restart'
  );

  const claimInput = {
    applicationId: id,
    evidenceUrl: fields.website + 'team',
    notes: 'I maintain this application and its official domain.',
  };
  await change(claims, foreign, claimInput, { status: 404 });
  const negative = await change(claims, maintainer, claimInput);
  const missed = await claimChange(negative.id, 'verify', 1);
  assert.equal(missed.proofMatched, false);
  assert.equal(missed.status, 'awaiting-proof');
  await claimChange(negative.id, 'verify', missed.revision, maintainer, {
    status: 429,
  });
  await claimChange(negative.id, 'cancel', missed.revision);
  const claimKey = randomUUID();
  const claim = await change(claims, maintainer, claimInput, { key: claimKey });
  assert.deepEqual(
    await change(claims, maintainer, claimInput, { key: claimKey, at: alpha }),
    claim
  );
  await change(
    claims,
    maintainer,
    { ...claimInput, notes: claimInput.notes + ' Changed request.' },
    { key: claimKey, status: 409 }
  );
  const challenge = await claimRead(claim.id);
  for (const actor of [other, foreign])
    await claimRead(claim.id, actor, { status: 404 });
  services.dns.records.set(challenge.challengeName, challenge.challengeValue);
  services.dns.fail(true);
  const verifyKey = randomUUID();
  try {
    await claimChange(claim.id, 'verify', 1, maintainer, {
      key: verifyKey,
      status: 503,
    });
  } finally {
    services.dns.fail(false);
  }
  assert.equal((await claimRead(claim.id)).revision, 1);
  // Accelerate only the failed test lease, preserving its fingerprint and attempt counters.
  await services.sql.query(
    'UPDATE application_ownership_checks SET leaseUntil=0 WHERE commandKey=?',
    [verifyKey]
  );
  await services.crashEditorial();
  await services.restartEditorial();
  const verified = await claimChange(claim.id, 'verify', 1, maintainer, {
    key: verifyKey,
  });
  assert.equal(verified.proofMatched, true);
  const queries = services.dns.queries.length;
  assert.deepEqual(
    await claimChange(claim.id, 'verify', 1, maintainer, { key: verifyKey }),
    verified
  );
  assert.equal(services.dns.queries.length, queries);
  await source(id, maintainer, { status: 404 });
  await ownDecision(claim.id, 2, 'approve', maintainer, { status: 403 });
  await ownDecision(claim.id, 2, 'approve', reviewer, { status: 403 });
  await ownDecision(claim.id, 2, 'approve', foreign, { status: 404 });
  console.log(
    'PASS real controlled DNS negative/rate-limit/cancel, unavailable proof and leased recovery across restart; exact proof replay grants nothing and dedicated independent ownership approval is required'
  );

  await services.stopWorker();
  const stale = await services.projections.findOne({
    kind: 'app',
    resourceId: id,
  });
  const grantKey = randomUUID();
  await services.sql.query(
    "CREATE TRIGGER application_parity_grant BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='grant rollback'"
  );
  try {
    await ownDecision(claim.id, 2, 'approve', staff, {
      key: grantKey,
      status: 503,
    });
  } finally {
    await services.sql.query('DROP TRIGGER application_parity_grant');
  }
  assert.equal((await claimRead(claim.id)).status, 'awaiting-review');
  assert.equal(
    (
      await services.sql.query(
        'SELECT * FROM application_ownership_grants WHERE applicationId=?',
        [id]
      )
    ).length,
    0
  );
  const grant = await ownDecision(claim.id, 2, 'approve', staff, {
    key: grantKey,
    at: alpha,
  });
  assert.equal(grant.applicationRevision, 2);
  assert.deepEqual(
    await ownDecision(claim.id, 2, 'approve', staff, { key: grantKey }),
    grant
  );
  assert.deepEqual(
    await services.projections.findOne({ kind: 'app', resourceId: id }),
    stale
  );
  await request(publicPath, { status: 503, cache: 'no-store' });
  const canonical = await source(id, maintainer);
  assert.equal(canonical.claimId, claim.id);
  assert.deepEqual(canonical.fields, fields);
  await source(id, author, { status: 404 });
  await submit(id, 4, author, { status: 403 });
  // A former author's private workspace can be removed without changing canonical content.
  await remove(id, 4, author);
  await request(`${base}/${id}`, { actor: author, status: 404 });
  assert.deepEqual((await source(id, maintainer)).fields, fields);
  await services.startWorker();
  await projected(id, 2);
  const editing = await open(canonical, maintainer);
  await open(canonical, other, { status: 403 });
  const media = await require('./application-parity-media-checks.cjs')({
    local,
    maintainer,
    other,
    reviewer,
    id: editing.id,
    services,
    change,
    request,
  });
  const proposed = {
    ...fields,
    name: 'Verified owner reviewed update',
    description: 'Reviewed canonical replacement.',
  };
  await update(editing.id, 2, proposed, maintainer);
  await submit(editing.id, 3, maintainer);
  await update(
    editing.id,
    4,
    {
      ...proposed,
      description: 'Never reviewed private history',
      classification: 'mature',
    },
    maintainer
  );
  const editingApprovalBody = { expectedRevision: 5, submittedRevision: 3 };
  await decision(editing.id, editingApprovalBody, maintainer, { status: 403 });
  await decision(editing.id, editingApprovalBody, staff, { status: 403 });
  assert.deepEqual(
    contentFields(await request(publicPath, { cache: 'no-store' })),
    fields
  );
  await media.review(3);
  const updated = await decision(editing.id, editingApprovalBody);
  assert.equal(updated.publicationRevision, 3);
  const replacement = await projected(id, 3);
  assert.deepEqual(contentFields(replacement), proposed);
  await media.published(id);
  assert.equal(
    (await request(`${base}/${editing.id}`, { actor: maintainer }))
      .classification,
    'mature'
  );
  console.log(
    'PASS atomic ownership grant and canonical editing during projection lag; former private removal preserves publication; verified owners still require independent frozen content/media review'
  );

  await services.stopWorker();
  const beforeRevoke = await services.projections.findOne({
    kind: 'app',
    resourceId: id,
  });
  const revoked = await ownDecision(claim.id, 3, 'revoke');
  assert.equal(revoked.applicationRevision, 4);
  await source(id, maintainer, { status: 404 });
  await open(await sourceForPrevious(canonical, 3), maintainer, {
    status: 403,
  });
  await submit(editing.id, 6, maintainer, { status: 403 });
  await change(
    `${base}/${editing.id}/withdraw`,
    maintainer,
    { expectedRevision: 6 },
    { status: 403 }
  );
  await change(
    `${base}/${editing.id}/rebase`,
    maintainer,
    {
      fields: proposed,
      editing: {
        applicationId: id,
        claimId: claim.id,
        sourcePublicationRevision: 4,
      },
      expectedRevision: 6,
      imageChoices: { logo: 'canonical', banner: 'canonical' },
    },
    { status: 403 }
  );
  assert.deepEqual(
    await services.projections.findOne({ kind: 'app', resourceId: id }),
    beforeRevoke
  );
  assert.deepEqual(
    await ownDecision(claim.id, 2, 'approve', staff, { key: grantKey }),
    grant
  );
  await source(id, maintainer, { status: 404 });
  const returnClaim = await change(claims, maintainer, claimInput);
  const returnChallenge = await claimRead(returnClaim.id);
  services.dns.records.set(
    returnChallenge.challengeName,
    returnChallenge.challengeValue
  );
  await claimChange(returnClaim.id, 'verify', 1);
  await ownDecision(returnClaim.id, 2);
  await submit(editing.id, 6, maintainer, { status: 403 });
  const releaseKey = randomUUID();
  const released = await claimChange(returnClaim.id, 'release', 3, maintainer, {
    key: releaseKey,
  });
  assert.deepEqual(
    await claimChange(returnClaim.id, 'release', 3, maintainer, {
      key: releaseKey,
    }),
    released
  );
  await source(id, maintainer, { status: 404 });
  await remove(editing.id, 6, maintainer);
  await services.startWorker();
  assert.deepEqual(contentFields(await projected(id, 6)), proposed);
  console.log(
    'PASS canonical revoke/release immediately deny source/open/rebase/submit/withdraw with stale Mongo; new grants never authorize old claim-bound drafts and old receipts cannot revive authority'
  );

  await require('./application-parity-privacy-checks.cjs')({
    call,
    local,
    services,
    maintainer,
    successor,
    staff,
    reviewer,
    id,
    claimInput,
    proposed,
    publicPath,
    claims,
    base,
    request,
    change,
    claimRead,
    claimChange,
    ownDecision,
    source,
    open,
    submit,
    decision,
    projected,
  });

  // The successor workflow ends in an explicit withdrawal; old messages cannot resurrect it.
  await services.startWorker();
  const finalState = await state(id);
  for (let attempt = 0; ; attempt++) {
    const projection = await services.projections.findOne({
      kind: 'app',
      resourceId: id,
    });
    if (
      projection?.revision === Number(finalState.revision) &&
      projection.deletedAt !== null
    )
      break;
    assert.ok(attempt < 120, 'Application withdrawal did not materialize');
    await delay(100);
  }
  await services.sql.query(
    "UPDATE editorial_outbox SET deliveredAt=NULL,availableAt=createdAt WHERE resourceKind='app' AND resourceId=? AND revision=1",
    [id]
  );
  for (let attempt = 0; ; attempt++) {
    const [event] = await services.sql.query(
      "SELECT deliveredAt FROM editorial_outbox WHERE resourceKind='app' AND resourceId=? AND revision=1",
      [id]
    );
    if (event.deliveredAt !== null) break;
    assert.ok(attempt < 120, 'Old application event was not acknowledged');
    await delay(100);
  }
  assert.equal(
    (await services.projections.findOne({ kind: 'app', resourceId: id }))
      .revision,
    Number(finalState.revision)
  );
  await request(publicPath, { status: 404, cache: 'no-store' });
  console.log(
    'PASS successor withdrawal is authoritative before materialization and old broker event redelivery cannot restore content or ownership'
  );

  const routes = [
    base,
    base.toUpperCase() + '/',
    `${base}/${id}`,
    `${base}/${id}/publication`,
    `${base}/canonical/${id}`,
    `${base}/${id}/unknown`,
    reviews,
    reviews.toUpperCase() + '/',
    `${reviews}/${id}`,
    `${reviews}/${id}/unknown`,
    claims,
    claims.toUpperCase() + '/',
    `${claims}/${claim.id}`,
    `${claims}/${claim.id}/unknown`,
    ownershipReviews,
    ownershipReviews.toUpperCase() + '/',
    `${ownershipReviews}/${claim.id}`,
    `${ownershipReviews}/${claim.id}/unknown`,
  ];
  await stopBff();
  try {
    for (const at of origins) {
      for (const route of routes)
        await request(route, { at, actor: reviewer, status: [502, 504] });
      for (const [route, method, body] of [
        [base, 'POST', fields],
        [`${base}/${id}`, 'PUT', { ...fields, expectedRevision: 1 }],
        [`${base}/${id}`, 'DELETE', { expectedRevision: 1 }],
        [`${base}/${id}/submit`, 'POST', { expectedRevision: 1 }],
        [`${base}/${id}/withdraw`, 'POST', { expectedRevision: 1 }],
        [
          `${reviews}/${id}/decision`,
          'POST',
          { decision: 'approve', ...approvalBody },
        ],
        [claims, 'POST', claimInput],
        ...['verify', 'cancel', 'release'].map((action) => [
          `${claims}/${claim.id}/${action}`,
          'POST',
          { expectedRevision: 1 },
        ]),
        [
          `${ownershipReviews}/${claim.id}/decision`,
          'POST',
          { decision: 'approve', expectedRevision: 2 },
        ],
      ])
        await change(route, author, body, { method, at, status: [502, 504] });
    }
  } finally {
    await restartBff();
  }
  for (const at of origins) {
    for (const family of [base, claims]) {
      await request(family.toUpperCase() + '/', { at, actor: author });
      await request(family + '?ownerIdentityId=' + other.uid, {
        at,
        actor: author,
        status: 400,
      });
      await request(family + '/unknown/suffix', {
        at,
        actor: author,
        status: 404,
        cache: null,
      });
    }
    await request(reviews.toUpperCase() + '/', { at, actor: reviewer });
    await request(ownershipReviews.toUpperCase() + '/', { at, actor: staff });
    await change(
      base,
      author,
      { ...fields, description: 'x'.repeat(70000) },
      { at, status: 413, cache: null }
    );
  }
  await services.stopEditorial();
  try {
    for (const at of origins)
      for (const [route, actor] of [
        [base, author],
        [claims, successor],
        [reviews, reviewer],
        [ownershipReviews, staff],
      ])
        await request(route, { at, actor, status: 503 });
  } finally {
    await services.restartEditorial();
  }
  await services.pausePolicy();
  try {
    await request(base, { actor: author, status: 503 });
    await request(claims, { actor: successor, status: 503 });
  } finally {
    await services.resumePolicy();
  }
  await request(base, { actor: author });
  await request(claims, { actor: successor });
  console.log(
    'PASS application/ownership family case/slash/unknown suffix and command matrix requires BFF in both configurations, bounded requests and owner/policy outage recovery fail closed'
  );

  async function sourceForPrevious(value, revision) {
    return { ...value, sourcePublicationRevision: revision };
  }
}

module.exports = { qualifyApplicationParity };
