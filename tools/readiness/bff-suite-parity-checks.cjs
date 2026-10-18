const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

async function qualifySuiteParity({
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
  const base = '/api/me/suites',
    reviews = '/api/editorial/suite-reviews',
    catalog = '/api/catalog/suites';
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
      }, expected ${status}: ${text.slice(0, 200)}`
    );
    if (response.status >= 200 && response.status < 500)
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
  const users = [];
  for (const name of [
    'owner',
    'other',
    'reviewer',
    'scoped-reviewer',
    'privacy',
  ]) {
    const email = `suite-${name}@example.test`;
    let member = await call('/auth/register', {
      at: local,
      body: { ...input, email, nickname: `Suite ${name}` },
      headers: { 'Idempotency-Key': 'suite-register-' + name },
    });
    if (name.includes('reviewer')) {
      await credentials.setOperatorClaims(await subjectFor(member.uid), {
        roles: ['editorial:reviewer'],
        ...(name === 'scoped-reviewer'
          ? { tenantId: 'foreign-suite-tenant' }
          : {}),
      });
      member = await call('/auth/signin', {
        at: local,
        body: { email, password: input.password },
      });
    }
    users.push({ ...member, email });
  }
  const [owner, other, reviewer, scoped, privacy] = users;
  const second = await call('/auth/signin', {
    at: alpha,
    body: { email: owner.email, password: input.password },
  });
  const publicPath = (id) => catalog + '/' + id;
  const statusPath = (id) => `${base}/${id}/publication`;
  const status = (id, actor = owner, options = {}) =>
    request(statusPath(id), { actor, ...options });
  const update = (id, body, options = {}) =>
    change(`${base}/${id}`, owner, body, {
      method: 'PUT',
      status: 200,
      ...options,
    });
  const submit = (id, revision, actor = owner, options = {}) =>
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
      { decision: 'approve', ...body },
      options
    );
  const withdraw = (id, revision, actor = owner, options = {}) =>
    change(
      `${base}/${id}/withdraw`,
      actor,
      { expectedRevision: revision },
      options
    );
  const fieldsOf = ({
    title,
    description,
    applicationIds,
    classification,
  }) => ({ title, description, applicationIds, classification });
  async function projected(id, revision = 1) {
    for (let attempt = 0; attempt < 120; attempt++) {
      services.assertWorker();
      const response = await fetch(local + publicPath(id), {
        signal: AbortSignal.timeout(5000),
      });
      const value = await response.json();
      if (response.status === 200 && value.revision === revision) return value;
      assert.ok([200, 503].includes(response.status), JSON.stringify(value));
      await delay(100);
    }
    assert.fail('Suite projection did not converge');
  }

  // Applications are dependencies of this slice; provision them via local BFF with real sessions.
  const applications = [];
  for (const name of ['first', 'second', 'hidden']) {
    const draft = await change('/api/me/application-drafts', owner, {
      name: `Suite member ${name}`,
      slug: 'suite-member-' + randomUUID(),
      website: 'https://suite-member.example.test/',
      description: 'Suite qualification member.',
      classification: 'general',
    });
    await change(`/api/me/application-drafts/${draft.id}/submit`, owner, {
      expectedRevision: 1,
    });
    await change(
      `/api/editorial/application-reviews/${draft.id}/decision`,
      reviewer,
      {
        decision: 'approve',
        expectedRevision: 2,
        submittedRevision: 1,
        reason: '',
      }
    );
    applications.push(draft.id);
  }
  const fields = {
    title: 'Frozen suite evidence',
    description: 'Owner-private collection.',
    applicationIds: applications.slice(0, 2),
    classification: 'general',
  };
  const createKey = randomUUID();
  const created = await Promise.all(
    origins.map((at) => change(base, owner, fields, { at, key: createKey }))
  );
  assert.deepEqual(created[0], created[1]);
  const id = created[0].id;
  assert.equal(created[0].revision, 1);
  assert.equal((await request(base, { actor: second })).length, 1);
  assert.deepEqual(
    fieldsOf(await request(`${base}/${id}`, { actor: second, at: alpha })),
    fields
  );
  for (const actor of [other, scoped]) {
    await request(`${base}/${id}`, { actor, status: 404 });
    await update(
      id,
      { ...fields, expectedRevision: 1 },
      { actor, status: 404 }
    );
    await submit(id, 1, actor, { status: 404 });
  }
  await decision(id, { expectedRevision: 1, submittedRevision: 1 }, scoped, {
    status: 404,
  });
  await request(reviews, { actor: owner, status: 403 });
  await request(`${base}/${id}`, {
    actor: other,
    status: 404,
    headers: {
      'X-User-Id': owner.uid,
      'X-User-Claims': '{"roles":["editorial:reviewer"]}',
      'X-Ingress-Auth': 'forged',
    },
  });
  await change(
    base,
    owner,
    { ...fields, title: 'Different payload' },
    { key: createKey, status: 409 }
  );
  await update(id, { ...fields, expectedRevision: 2 }, { status: 409 });
  const edited = {
    ...fields,
    applicationIds: [...fields.applicationIds].reverse(),
    title: 'Frozen suite evidence revised',
  };
  const updateKey = randomUUID();
  const updated = await update(
    id,
    { ...edited, expectedRevision: 1 },
    { key: updateKey }
  );
  assert.deepEqual(
    await update(
      id,
      { ...edited, expectedRevision: 1 },
      { key: updateKey, at: alpha }
    ),
    updated
  );
  const submittedKey = randomUUID();
  const submitted = await submit(id, 2, owner, { key: submittedKey });
  assert.deepEqual(
    await submit(id, 2, second, { key: submittedKey, at: alpha }),
    submitted
  );
  await submit(id, 3, owner, { status: 409 });
  const privateEdit = {
    ...edited,
    title: 'Private later title',
    applicationIds: [applications[0]],
    classification: 'mature',
  };
  await update(id, { ...privateEdit, expectedRevision: 3 });
  const frozen = await status(id);
  assert.deepEqual(fieldsOf(frozen.latestSubmission), edited);
  assert.deepEqual(
    await request(`${reviews}/${id}`, { actor: reviewer, at: alpha }),
    frozen
  );
  assert.ok(
    (await request(reviews, { actor: reviewer })).items.some(
      (item) => item.id === id
    )
  );
  await decision(id, { expectedRevision: 3, submittedRevision: 2 }, reviewer, {
    status: 409,
  });
  await decision(id, { expectedRevision: 4, submittedRevision: 1 }, reviewer, {
    status: 409,
  });
  await decision(id, { expectedRevision: 4, submittedRevision: 2 }, owner, {
    status: 403,
  });
  const self = await change(base, reviewer, fields);
  await submit(self.id, 1, reviewer);
  await decision(
    self.id,
    { expectedRevision: 2, submittedRevision: 1 },
    reviewer,
    { status: 403 }
  );
  await withdraw(self.id, 2, reviewer);
  assert.equal(
    (await status(self.id, reviewer)).latestSubmission.status,
    'cancelled'
  );
  console.log(
    'PASS suite private ownership/tenant isolation, independent sessions, ordered membership, exact replay/conflicts, immutable submission and independent reviewer enforcement'
  );

  const approvalKey = randomUUID(),
    approvalBody = {
      expectedRevision: 4,
      submittedRevision: 2,
      reason: 'Independent approval',
    };
  await services.sql.query(
    "CREATE TRIGGER suite_parity_outbox BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'suite outbox rollback'"
  );
  try {
    await decision(id, approvalBody, reviewer, {
      key: approvalKey,
      status: 503,
    });
  } finally {
    await services.sql.query('DROP TRIGGER suite_parity_outbox');
  }
  assert.deepEqual(await status(id), frozen);
  assert.equal(
    (
      await services.sql.query(
        'SELECT * FROM suite_publications WHERE suiteId=?',
        [id]
      )
    ).length,
    0
  );
  const approval = await decision(id, approvalBody, reviewer, {
    key: approvalKey,
    at: alpha,
  });
  assert.equal(approval.publicationRevision, 1);
  for (const route of [
    publicPath(id),
    catalog,
    '/api/catalog/suite-selection?ids=' + id,
  ])
    await request(route, { status: 503 });
  await services.startWorker();
  const published = await projected(id);
  assert.deepEqual(fieldsOf(published), edited);
  assert.equal(published.submittedRevision, 2);
  assert.deepEqual(
    (
      await request(
        '/api/catalog/suite-selection?ids=' + id + ',' + randomUUID(),
        { at: alpha }
      )
    ).items,
    [published]
  );
  assert.deepEqual(
    (
      await request(
        catalog + '?q=Frozen%20suite&page=1&pageSize=1&sort=name-desc',
        { at: alpha }
      )
    ).items,
    [published]
  );
  assert.equal(published.classification, 'general');
  assert.equal(
    (await request(`${base}/${id}`, { actor: owner })).classification,
    'mature'
  );
  const stateBeforeReplay = await services.sql.query(
    "SELECT * FROM editorial_resource_states WHERE resourceKind='suite' AND resourceId=?",
    [id]
  );
  const outboxBeforeReplay = await services.sql.query(
    "SELECT id FROM editorial_outbox WHERE resourceKind='suite' AND resourceId=?",
    [id]
  );
  await services.restartEditorial();
  await restartAccount();
  await restartBff();
  assert.deepEqual(
    await decision(id, approvalBody, reviewer, { key: approvalKey }),
    approval
  );
  assert.deepEqual(
    await services.sql.query(
      "SELECT * FROM editorial_resource_states WHERE resourceKind='suite' AND resourceId=?",
      [id]
    ),
    stateBeforeReplay
  );
  assert.deepEqual(
    await services.sql.query(
      "SELECT id FROM editorial_outbox WHERE resourceKind='suite' AND resourceId=?",
      [id]
    ),
    outboxBeforeReplay
  );
  assert.deepEqual(await request(publicPath(id)), published);
  // Re-expose a confirmed outbox row to model a lost publisher acknowledgement.
  await services.sql.query(
    "UPDATE editorial_outbox SET deliveredAt=NULL,availableAt=createdAt WHERE resourceKind='suite' AND resourceId=? AND revision=1",
    [id]
  );
  for (let attempt = 0; ; attempt++) {
    const [event] = await services.sql.query(
      "SELECT deliveredAt FROM editorial_outbox WHERE resourceKind='suite' AND resourceId=? AND revision=1",
      [id]
    );
    if (event.deliveredAt !== null) break;
    assert.ok(attempt < 120, 'Duplicate suite outbox delivery did not settle');
    await delay(100);
  }
  assert.deepEqual(await projected(id), published);
  await services.pauseMongo();
  try {
    await request(publicPath(id), { status: 503 });
    await request(`${base}/${id}`, { actor: owner });
  } finally {
    await services.resumeMongo();
  }
  assert.deepEqual(await projected(id), published);
  console.log(
    'PASS suite approval/outbox rollback, actual broker materialization/replay, truthful projection lag, approved classification and exact receipts across independent process restart'
  );

  const rejectedDraft = await change(base, owner, {
    ...fields,
    title: 'Rejected suite revision',
    applicationIds: [applications[0]],
  });
  await submit(rejectedDraft.id, 1);
  const rejectionBody = {
    decision: 'reject',
    expectedRevision: 2,
    submittedRevision: 1,
    reason: 'Revise this collection',
  };
  const rejectionKey = randomUUID();
  const rejected = await decision(rejectedDraft.id, rejectionBody, reviewer, {
    key: rejectionKey,
  });
  assert.deepEqual(
    await decision(rejectedDraft.id, rejectionBody, reviewer, {
      key: rejectionKey,
    }),
    rejected
  );
  await request(publicPath(rejectedDraft.id), { status: 404 });
  await submit(rejectedDraft.id, 3);
  await decision(rejectedDraft.id, {
    expectedRevision: 4,
    submittedRevision: 3,
  });
  const retained = await projected(rejectedDraft.id);
  await update(rejectedDraft.id, {
    ...fields,
    title: 'Unapproved replacement',
    applicationIds: [applications[0]],
    expectedRevision: 5,
  });
  await submit(rejectedDraft.id, 6);
  await decision(rejectedDraft.id, {
    decision: 'reject',
    expectedRevision: 7,
    submittedRevision: 6,
    reason: 'Keep the approved version',
  });
  assert.deepEqual(await request(publicPath(rejectedDraft.id)), retained);
  await withdraw(rejectedDraft.id, 8);
  console.log(
    'PASS rejected suite submissions replay exactly, resubmission freezes a new revision and a later rejection retains the earlier approved publication'
  );

  // Missing members cannot be newly added; retained unavailable references remain removable.
  await update(
    id,
    { ...privateEdit, applicationIds: [randomUUID()], expectedRevision: 5 },
    { status: 400 }
  );
  const memberPath = `/api/me/application-drafts/${applications[1]}`;
  await change(memberPath + '/withdraw', owner, { expectedRevision: 3 });
  await update(id, { ...edited, expectedRevision: 5 }, { status: 400 });
  assert.deepEqual(await request(publicPath(id)), published);
  const selection = await request(
    '/api/catalog/app-selection?ids=' + applications[1],
    { cache: 'no-store' }
  );
  assert.deepEqual(selection.items, []);
  const hidden = await change(base, owner, {
    ...fields,
    title: 'Hidden member pending',
    applicationIds: [applications[2]],
  });
  await submit(hidden.id, 1);
  await change(
    `/api/me/application-drafts/${applications[2]}/withdraw`,
    owner,
    { expectedRevision: 3 }
  );
  await decision(
    hidden.id,
    { expectedRevision: 2, submittedRevision: 1 },
    reviewer,
    { status: 400 }
  );
  await update(hidden.id, {
    ...fields,
    applicationIds: [applications[0]],
    expectedRevision: 2,
  });
  await withdraw(hidden.id, 3);
  const removal = await update(id, {
    ...privateEdit,
    description: 'Only available members',
    expectedRevision: 5,
  });
  assert.equal(removal.revision, 6);
  assert.deepEqual(await request(publicPath(id)), published);
  console.log(
    'PASS unavailable/hidden suite members deny additions and approval, remain removable privately and expose no application metadata through current canonical selections'
  );

  // An approved publication survives a new submission, private removal and old receipt replay.
  await submit(id, 6);
  const deleteKey = randomUUID();
  const beforeDelete = await status(id);
  await services.sql.query(
    "CREATE TRIGGER suite_parity_delete BEFORE INSERT ON suite_commands FOR EACH ROW BEGIN IF NEW.deleted=1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='suite deletion rollback'; END IF; END"
  );
  try {
    await change(
      `${base}/${id}`,
      owner,
      { expectedRevision: 7 },
      { method: 'DELETE', status: 503, key: deleteKey }
    );
  } finally {
    await services.sql.query('DROP TRIGGER suite_parity_delete');
  }
  assert.deepEqual(await status(id), beforeDelete);
  assert.deepEqual(await request(publicPath(id)), published);
  const removed = await change(
    `${base}/${id}`,
    owner,
    { expectedRevision: 7 },
    { method: 'DELETE', status: 200, key: deleteKey, at: alpha }
  );
  assert.equal(removed.revision, 8);
  assert.deepEqual(
    await change(
      `${base}/${id}`,
      second,
      { expectedRevision: 7 },
      { method: 'DELETE', status: 200, key: deleteKey }
    ),
    removed
  );
  await request(`${base}/${id}`, { actor: owner, status: 404 });
  await request(`${reviews}/${id}`, { actor: reviewer, status: 404 });
  assert.ok(
    !(await request(reviews, { actor: reviewer })).items.some(
      (item) => item.id === id
    )
  );
  assert.deepEqual(await request(publicPath(id)), published);
  assert.equal((await status(id)).latestSubmission, null);
  assert.deepEqual(
    await change(base, owner, fields, { key: createKey }),
    created[0]
  );
  assert.deepEqual(
    await update(id, { ...edited, expectedRevision: 1 }, { key: updateKey }),
    updated
  );
  assert.deepEqual(
    await decision(id, approvalBody, reviewer, { key: approvalKey }),
    approval
  );
  await submit(id, 8, owner, { status: 404 });
  await update(id, { ...fields, expectedRevision: 8 }, { status: 404 });
  await decision(id, { expectedRevision: 8, submittedRevision: 6 }, reviewer, {
    status: 404,
  });
  await services.stopWorker();
  const stale = await services.projections.findOne({
    kind: 'suite',
    resourceId: id,
  });
  const withdrawKey = randomUUID();
  await withdraw(id, 8, other, { status: 404 });
  const withdrawn = await withdraw(id, 8, owner, { key: withdrawKey });
  assert.equal(withdrawn.publicationRevision, 2);
  assert.deepEqual(
    await withdraw(id, 8, second, { key: withdrawKey }),
    withdrawn
  );
  await request(publicPath(id), { status: 404 });
  assert.deepEqual(
    (await request('/api/catalog/suite-selection?ids=' + id)).items,
    []
  );
  assert.deepEqual(
    await services.projections.findOne({ kind: 'suite', resourceId: id }),
    stale
  );
  await services.startWorker();
  for (let attempt = 0; ; attempt++) {
    services.assertWorker();
    const current = await services.projections.findOne({
      kind: 'suite',
      resourceId: id,
    });
    if (current?.revision === 2 && current.deletedAt !== null) break;
    assert.ok(attempt < 120, 'Suite withdrawal did not materialize');
    await delay(100);
  }
  await services.restartEditorial();
  assert.deepEqual(
    await decision(id, approvalBody, reviewer, { key: approvalKey }),
    approval
  );
  assert.deepEqual(
    await submit(id, 2, owner, { key: submittedKey }),
    submitted
  );
  await request(publicPath(id), { status: 404 });
  // Preserve the old persisted deletion shape: private/public tombstones without a snapshot.
  await services.sql.query('DELETE FROM suite_publications WHERE suiteId=?', [
    id,
  ]);
  await status(id, owner, { status: 404 });
  await withdraw(id, 9, owner, { status: 404 });
  assert.deepEqual(
    await decision(id, approvalBody, reviewer, { key: approvalKey }),
    approval
  );
  await request(publicPath(id), { status: 404 });
  console.log(
    'PASS private suite removal preserves its approved snapshot and clears pending reviews; explicit owner withdrawal, tombstones and historical replay prevent resurrection'
  );

  const routes = [
    base,
    base.toUpperCase() + '/',
    `${base}/${hidden.id}`,
    `${base}/${id}/publication`,
    `${base}/${id}/unknown`,
    reviews,
    reviews.toUpperCase() + '/',
    `${reviews}/${hidden.id}`,
    `${reviews}/${id}/unknown`,
    catalog,
    catalog.toUpperCase() + '/',
    publicPath(id),
    catalog + '/unknown',
    '/api/catalog/suite-selection?ids=' + id,
    '/API/CATALOG/SUITE-SELECTION/?ids=' + id,
    '/api/catalog/suite-selection/unknown',
  ];
  await stopBff();
  try {
    for (const at of origins) {
      for (const route of routes)
        await request(route, { at, actor: reviewer, status: [502, 504] });
      await request(publicPath(id), { at, method: 'HEAD', status: [502, 504] });
      for (const [route, method, body] of [
        [base, 'POST', fields],
        [`${base}/${id}`, 'PUT', { ...fields, expectedRevision: 9 }],
        [`${base}/${id}`, 'DELETE', { expectedRevision: 9 }],
        [`${base}/${id}/submit`, 'POST', { expectedRevision: 9 }],
        [`${base}/${id}/withdraw`, 'POST', { expectedRevision: 9 }],
        [
          `${reviews}/${id}/decision`,
          'POST',
          { decision: 'approve', ...approvalBody },
        ],
      ])
        await change(route, owner, body, { at, method, status: [502, 504] });
    }
  } finally {
    await restartBff();
  }
  for (const at of origins) {
    await request(base + '?ownerIdentityId=' + other.uid, {
      at,
      actor: owner,
      status: 400,
    });
    await request(catalog + '?tenantId=foreign', { at, status: 400 });
    await request('/api/catalog/suite-selection?ids=' + id + '&ids=' + id, {
      at,
      status: 400,
    });
    await request(`${base}/${id}/unknown`, {
      at,
      actor: owner,
      status: 404,
      cache: null,
    });
    await request(reviews, { at, actor: owner, status: 403 });
  }
  await services.stopEditorial();
  try {
    for (const at of origins) {
      await request(base, { at, actor: owner, status: 503 });
      await request(catalog, { at, status: 503 });
      await request(reviews, { at, actor: reviewer, status: 503 });
      await decision(id, approvalBody, reviewer, {
        at,
        key: approvalKey,
        status: 503,
      });
    }
  } finally {
    await services.restartEditorial();
  }
  await services.pausePolicy();
  try {
    await request(base, { actor: owner, status: 503 });
  } finally {
    await services.resumePolicy();
  }
  await request(base, { actor: owner });
  console.log(
    'PASS complete local/alpha suite route variants and commands require BFF; malformed selectors, Editorial outage and real OPA outage fail closed'
  );

  await require('./suite-parity-privacy-checks.cjs')({
    call,
    local,
    privacy,
    owner,
    reviewer,
    fields: { ...fields, applicationIds: [applications[0]] },
    services,
    request,
    change,
    submit,
    decision,
    projected,
  });
}

module.exports = { qualifySuiteParity };
