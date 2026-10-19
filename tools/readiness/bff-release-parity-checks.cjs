const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

async function qualifyReleaseParity({
  call,
  origins,
  input,
  source,
  credentials,
  subjectFor,
  services,
  restartAccount,
  restartBff,
  stopBff,
}) {
  const [local, alpha] = origins;
  const base = '/api/me/releases',
    reviews = '/api/editorial/release-reviews';
  const claims = '/api/me/ownership-claims',
    ownershipReviews = '/api/editorial/ownership-reviews';
  const applications = '/api/me/application-drafts';
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
  async function until(read, predicate, label) {
    for (let attempt = 0; attempt < 150; attempt++) {
      const value = await read();
      if (predicate(value)) return value;
      await delay(100);
    }
    assert.fail(label);
  }
  const members = [];
  for (const [name, roles, tenantId] of [
    ['owner', ['editorial:reviewer']],
    ['reviewer', ['editorial:reviewer', 'editorial:ownership-reviewer']],
    ['successor', []],
    ['watcher', []],
    ['disabled', []],
    [
      'foreign',
      ['editorial:reviewer', 'editorial:ownership-reviewer'],
      'foreign-release-tenant',
    ],
  ]) {
    const email = `release-${name}@example.test`;
    let member = await call('/auth/register', {
      at: local,
      body: { ...input, email, nickname: `Release ${name}` },
      headers: { 'Idempotency-Key': 'release-register-' + name },
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
  const [owner, reviewer, successor, watcher, disabled, foreign] = members;
  const second = await call('/auth/signin', {
    at: alpha,
    body: { email: owner.email, password: input.password },
  });
  assert.equal(second.uid, owner.uid);
  assert.notEqual(second.token, owner.token);
  const appFields = {
    name: 'Release parity application',
    slug: 'release-parity-' + randomUUID(),
    website: 'https://release-parity.example.test/',
    description: 'Release ownership and notification qualification.',
    classification: 'general',
  };
  const app = await change(applications, owner, appFields);
  const applicationId = app.id;
  await change(`${applications}/${app.id}/submit`, owner, {
    expectedRevision: 1,
  });
  await change(
    `/api/editorial/application-reviews/${app.id}/decision`,
    reviewer,
    {
      decision: 'approve',
      expectedRevision: 2,
      submittedRevision: 1,
    }
  );
  await services.startWorker();
  const projection = (kind, id, revision) =>
    until(
      async () => {
        services.assertWorker();
        return services.projections.findOne({ kind, resourceId: id });
      },
      (value) => value?.revision === revision,
      `${kind} projection did not reach ${revision}`
    );
  await projection('app', app.id, 1);
  async function grant(actor) {
    const created = await change(claims, actor, {
      applicationId,
      evidenceUrl: appFields.website,
      notes: 'Controlled DNS release ownership.',
    });
    const claim = await request(`${claims}/${created.id}`, { actor });
    services.dns.records.set(claim.challengeName, claim.challengeValue);
    await change(`${claims}/${created.id}/verify`, actor, {
      expectedRevision: claim.revision,
    });
    assert.ok(services.dns.queries.includes(claim.challengeName));
    const verified = await request(`${claims}/${created.id}`, { actor });
    await change(`${ownershipReviews}/${created.id}/decision`, reviewer, {
      decision: 'approve',
      expectedRevision: verified.revision,
      reason: 'Independent DNS review.',
    });
    return created.id;
  }
  const claimId = await grant(owner);
  await projection('app', app.id, 2);
  await change(
    `${applications}/${app.id}`,
    owner,
    { expectedRevision: 3 },
    { method: 'DELETE', status: 200 }
  );
  const fields = {
    version: '1.0.0+build_A-2',
    channel: 'stable',
    type: 'minor',
    releasedOn: '2026-01-01',
    title: 'Frozen release notes',
    description: 'Independently reviewed release content.',
    changes: [
      { type: 'feature', description: 'A reviewed application release.' },
    ],
  };
  const catalog = '/api/catalog/releases/' + appFields.slug;
  const publicPath = (version = fields.version) =>
    `${catalog}/${encodeURIComponent(version)}`;
  const state = (id, actor = owner, options = {}) =>
    request(`${base}/${id}/publication`, { actor, ...options });
  const draft = (id, actor = owner, options = {}) =>
    request(`${base}/${id}`, { actor, ...options });
  const edit = async (id, content, actor = owner, options = {}) =>
    change(
      `${base}/${id}`,
      actor,
      {
        expectedRevision: (await draft(id, actor)).revision,
        fields: content,
      },
      { method: 'PUT', status: 200, ...options }
    );
  async function publication(id, action, actor = owner, options = {}) {
    const current = await state(id, actor);
    const reviewing = action === 'approve' || action === 'reject';
    const body = {
      expectedRevision: current.revision,
      expectedPublicationRevision: current.publicationRevision,
      ...(reviewing
        ? {
            decision: action,
            submittedRevision: current.latestSubmission?.submittedRevision ?? 1,
            reason: 'Independent release review.',
          }
        : {}),
    };
    const route = reviewing
      ? `${reviews}/${id}/decision`
      : `${base}/${id}/${action}`;
    const commandActor = options.reviewer ?? (reviewing ? reviewer : actor);
    const key = options.key ?? randomUUID();
    const result = await change(route, commandActor, body, { ...options, key });
    return { route, body, key, actor: commandActor, result };
  }
  const replay = (command, options = {}) =>
    change(command.route, command.actor, command.body, {
      key: command.key,
      ...options,
    });
  const create = (content, actor = owner, claim = claimId, options = {}) =>
    change(
      base,
      actor,
      {
        applicationId,
        claimId: claim,
        fields: content,
      },
      options
    );
  const open = (
    releaseId,
    revision,
    actor = owner,
    claim = claimId,
    options = {}
  ) =>
    change(
      base + '/open',
      actor,
      {
        applicationId,
        claimId: claim,
        releaseId,
        expectedPublicationRevision: revision,
      },
      options
    );
  const sourcePath = `${base}/source/${applicationId}`;
  assert.equal(
    (await request(sourcePath, { actor: second, at: alpha })).claimId,
    claimId
  );
  const createKey = randomUUID();
  const created = await Promise.all(
    origins.map((at) => create(fields, owner, claimId, { key: createKey, at }))
  );
  assert.deepEqual(created[0], created[1]);
  const id = created[0].id,
    releaseId = (await draft(id)).target.releaseId;
  assert.equal((await draft(id, second, { at: alpha })).title, fields.title);
  assert.equal((await request(base, { actor: owner })).length, 1);
  await create({ ...fields, title: 'Conflicting create' }, owner, claimId, {
    key: createKey,
    status: 409,
  });
  for (const actor of [watcher, foreign]) {
    await draft(id, actor, { status: 404 });
    await request(sourcePath, { actor, status: 404 });
    await change(
      `${base}/${id}`,
      actor,
      { expectedRevision: 1, fields },
      { method: 'PUT', status: 404 }
    );
  }
  await request(base, { status: 401 });
  await request(base, {
    actor: { token: 'invalid' },
    status: 401,
    cache: null,
  });
  await draft(id, watcher, {
    status: 404,
    headers: {
      'X-User-Id': owner.uid,
      'X-User-Claims': '{"roles":["editorial:reviewer"]}',
      'X-Ingress-Auth': 'forged',
    },
  });
  await request(reviews, { actor: watcher, status: 403 });
  await request(publicPath(), { status: 404 });
  await edit(id, { ...fields, releasedOn: '2999-01-01' });
  await publication(id, 'submit', owner, { status: 400 });
  await change(
    `${base}/${id}`,
    owner,
    { expectedRevision: 1, fields },
    { method: 'PUT', status: 409 }
  );
  const concurrent = await Promise.all(
    ['first', 'second'].map((title) =>
      change(
        `${base}/${id}`,
        owner,
        { expectedRevision: 2, fields: { ...fields, title } },
        { method: 'PUT', status: [200, 409] }
      )
    )
  );
  assert.equal(concurrent.filter((value) => value.revision === 3).length, 1);
  await edit(id, fields);
  await publication(id, 'submit');
  await edit(id, { ...fields, title: 'Unsubmitted private edit' });
  const pending = await request(`${reviews}/${id}`, { actor: reviewer });
  assert.equal(pending.latestSubmission.title, fields.title);
  assert.ok(
    (await request(reviews, { actor: reviewer })).items.some(
      (value) => value.id === id
    )
  );
  for (const [actor, status] of [
    [owner, 403],
    [foreign, 404],
  ])
    await publication(id, 'approve', owner, { reviewer: actor, status });
  await publication(id, 'reject');
  assert.equal((await state(id)).latestSubmission.status, 'rejected');
  await edit(id, fields);
  await publication(id, 'submit');
  await edit(id, { ...fields, title: 'Private after resubmission' });
  console.log(
    'PASS release sessions: controlled DNS/current grant, create replay, tenant/forged-context/self-review denial, concurrent revisions and frozen independent review'
  );

  await services.stopWorker();
  const before = await state(id);
  const cursor = () =>
    services.sql.query(
      'SELECT * FROM content_update_cursors WHERE targetKind=? AND targetId=?',
      ['applications', applicationId]
    );
  const beforeCursor = await cursor();
  const approvalKey = randomUUID();
  for (const table of ['release_commands', 'editorial_outbox']) {
    await services.sql.query(
      `CREATE TRIGGER release_failure BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected release failure'`
    );
    try {
      await publication(id, 'approve', owner, {
        key: approvalKey,
        status: 503,
      });
      assert.deepEqual(await state(id), before);
      assert.deepEqual(await cursor(), beforeCursor);
      assert.equal(
        (
          await services.sql.query(
            'SELECT * FROM release_publications WHERE releaseId=?',
            [releaseId]
          )
        ).length,
        0
      );
      assert.equal(
        (
          await services.sql.query(
            "SELECT * FROM editorial_outbox WHERE resourceKind='release' AND resourceId=?",
            [releaseId]
          )
        ).length,
        0
      );
    } finally {
      await services.sql.query('DROP TRIGGER release_failure');
    }
  }
  const approval = await publication(id, 'approve', owner, {
    key: approvalKey,
  });
  assert.deepEqual(
    await Promise.all(origins.map((at) => replay(approval, { at }))),
    [approval.result, approval.result]
  );
  assert.equal(
    (
      await services.sql.query(
        'SELECT * FROM release_publications WHERE releaseId=?',
        [releaseId]
      )
    ).length,
    1
  );
  assert.equal(
    (
      await services.sql.query(
        "SELECT * FROM editorial_outbox WHERE resourceKind='release' AND resourceId=?",
        [releaseId]
      )
    ).length,
    1
  );
  await request(publicPath(), { status: 503 });
  assert.equal(
    (await request(sourcePath + '?releaseId=' + releaseId, { actor: owner }))
      .release.title,
    fields.title
  );
  await services.startWorker();
  const originalProjection = await projection('release', releaseId, 1);
  for (const at of origins) {
    const visible = await request(publicPath(), { at });
    assert.equal(visible.title, fields.title);
    assert.equal(visible.claimId, undefined);
    assert.equal(visible.latestSubmission, undefined);
  }
  await edit(id, { ...fields, version: '2.0.0' }, owner, { status: 409 });
  const duplicate = await create({ ...fields, channel: 'prerelease' });
  await publication(duplicate.id, 'submit');
  await publication(duplicate.id, 'approve', owner, { status: 409 });
  await publication(duplicate.id, 'reject');
  console.log(
    'PASS release atomicity: receipt/outbox failures roll back publication, review, cursor and revision; exact concurrent approval replay commits once and broker lag is explicit'
  );

  // More than one page is needed to prove page boundaries and uniqueness across channels.
  for (let index = 0; index < 21; index++) {
    const content = {
      ...fields,
      version: `2.0.${index}-beta.1`,
      channel: 'prerelease',
      releasedOn: '2026-01-02',
    };
    const entry = await create(content);
    await publication(entry.id, 'submit');
    const approved = await publication(entry.id, 'approve');
    await projection('release', approved.result.releaseId, 1);
  }
  const page1 = await request(catalog),
    page2 = await request(catalog + '?page=2', { at: alpha });
  assert.equal(page1.total, 22);
  assert.equal(page1.items.length, 20);
  assert.equal(page2.items.length, 2);
  assert.equal(
    new Set([...page1.items, ...page2.items].map((value) => value.id)).size,
    22
  );
  assert.equal(page2.items.at(-1).version, fields.version);
  assert.equal((await request(catalog + '?channel=prerelease')).total, 21);
  assert.equal(
    (await request(catalog + '?channel=stable&before=2026-01-02')).total,
    1
  );
  assert.equal((await request(catalog + '?before=2026-01-01')).total, 0);
  assert.deepEqual((await request(catalog + '?page=3')).items, []);
  for (const query of [
    'page=10001',
    'page=0',
    'page=1&page=2',
    'channel=unknown',
    'before=invalid',
    'tenantId=foreign',
  ])
    await request(catalog + '?' + query, { status: 400 });
  console.log(
    'PASS release catalog: stable/prerelease version uniqueness, encoded immutable URLs, nonoverlapping real pagination and strict channel/date/selector contracts'
  );

  await require('./release-parity-notifications.cjs')({
    origins,
    source,
    services,
    owner,
    reviewer,
    watcher,
    disabled,
    second,
    applicationId,
    appFields,
    claimId,
    fields,
    request,
    change,
    create,
    edit,
    publication,
    replay,
    projection,
    until,
    restartAccount,
    restartBff,
  });

  const imported = await open(releaseId, 1);
  await edit(imported.id, { ...fields, title: 'Old grant pending revision' });
  await publication(imported.id, 'submit');
  await services.stopWorker();
  const currentClaim = await request(`${claims}/${claimId}`, { actor: owner });
  await change(`${ownershipReviews}/${claimId}/decision`, reviewer, {
    decision: 'revoke',
    expectedRevision: currentClaim.revision,
    reason: 'Revoke release publication authority.',
  });
  const revokedCursor = await cursor();
  await request(sourcePath, { actor: owner, status: 404 });
  await create(fields, owner, claimId, { status: 403 });
  await open(releaseId, 1, owner, claimId, { status: 403 });
  await change(
    `${base}/${id}/rebase`,
    owner,
    {
      expectedRevision: (await draft(id)).revision,
      expectedPublicationRevision: 1,
      fields,
    },
    { status: 403 }
  );
  await publication(id, 'submit', owner, { status: 403 });
  await publication(imported.id, 'approve', owner, { status: 403 });
  assert.deepEqual(await cursor(), revokedCursor);
  await edit(id, { ...fields, title: 'Private editing after revocation' });
  await publication(imported.id, 'reject');
  assert.deepEqual(await replay(approval), approval.result);
  assert.equal(
    (
      await services.projections.findOne({
        kind: 'release',
        resourceId: releaseId,
      })
    ).revision,
    1
  );
  const replacementClaim = await grant(successor);
  const replacement = await open(releaseId, 1, successor, replacementClaim);
  const stale = await open(releaseId, 1, successor, replacementClaim);
  await edit(
    replacement.id,
    { ...fields, title: 'Successor approved content' },
    successor
  );
  await publication(replacement.id, 'submit', successor);
  const replacementApproval = await publication(
    replacement.id,
    'approve',
    successor
  );
  assert.equal(replacementApproval.result.publicationRevision, 2);
  await request(publicPath(), { status: 503 });
  await change(
    `${base}/${stale.id}/rebase`,
    successor,
    { expectedRevision: 1, expectedPublicationRevision: 1, fields },
    { status: 409 }
  );
  await change(`${base}/${stale.id}/rebase`, successor, {
    expectedRevision: 1,
    expectedPublicationRevision: 2,
    fields: { ...fields, title: 'Rebased private merge' },
  });
  assert.equal(
    (await draft(stale.id, successor)).target.sourcePublicationRevision,
    2
  );
  const history = await services.sql.query(
    'SELECT fields,status FROM release_submissions WHERE draftId=? AND status=?',
    [id, 'approved']
  );
  assert.equal(history.length, 1);
  assert.equal(
    (typeof history[0].fields === 'string'
      ? JSON.parse(history[0].fields)
      : history[0].fields
    ).title,
    fields.title
  );
  const withdrawal = await publication(replacement.id, 'withdraw', successor);
  assert.equal(withdrawal.result.publicationRevision, 3);
  await request(publicPath(), { status: 404 });
  assert.equal(
    (
      await services.projections.findOne({
        kind: 'release',
        resourceId: releaseId,
      })
    ).revision,
    1
  );
  assert.equal(
    (
      await request(sourcePath + '?releaseId=' + releaseId, {
        actor: successor,
      })
    ).release.visible,
    false
  );
  assert.deepEqual(
    await replay(replacementApproval),
    replacementApproval.result
  );
  await request(publicPath(), { status: 404 });
  await services.restartEditorial();
  await restartAccount({ FAVORITE_UPDATE_WORKER_ENABLED: 'true' });
  await restartBff();
  assert.deepEqual(await replay(withdrawal, { at: alpha }), withdrawal.result);
  assert.deepEqual(await replay(approval), approval.result);
  await services.startWorker();
  const tombstone = await projection('release', releaseId, 3);
  assert.ok(tombstone.deletedAt);
  const {
    MongoEditorialProjections,
  } = require('../../apps/services/editorial/src/app/infrastructure/mongo-editorial-projections');
  assert.equal(
    await new MongoEditorialProjections(services.projections).publish(
      originalProjection
    ),
    'superseded'
  );
  await request(publicPath(), { status: 404 });
  const reused = await create(fields, successor, replacementClaim);
  await publication(reused.id, 'submit', successor);
  await publication(reused.id, 'approve', successor, { status: 409 });
  await publication(reused.id, 'reject', successor);
  const next = await create(
    { ...fields, version: '99.0.0' },
    successor,
    replacementClaim
  );
  await publication(next.id, 'submit', successor);
  await services.stopWorker();
  const replacementState = await request(`${claims}/${replacementClaim}`, {
    actor: successor,
  });
  await change(`${claims}/${replacementClaim}/release`, successor, {
    expectedRevision: replacementState.revision,
  });
  await publication(next.id, 'approve', successor, { status: 403 });
  await publication(next.id, 'submit', successor, { status: 403 });
  const deletionBody = {
      expectedRevision: (await draft(next.id, successor)).revision,
    },
    deletionKey = randomUUID();
  const deleted = await change(`${base}/${next.id}`, successor, deletionBody, {
    key: deletionKey,
    method: 'DELETE',
    status: 200,
  });
  assert.deepEqual(
    await change(`${base}/${next.id}`, successor, deletionBody, {
      key: deletionKey,
      method: 'DELETE',
      status: 200,
    }),
    deleted
  );
  await draft(next.id, successor, { status: 404 });
  console.log(
    'PASS release lifecycle: canonical revoke/release defeats stale projections, successor open/rebase preserves reviewed history, withdrawal/restart/old replay retains tombstones and version reservations'
  );

  const routes = [
    base,
    base.toUpperCase() + '/',
    base + '/unknown',
    `${base}/${id}`,
    sourcePath,
    base + '/open',
    `${base}/${id}/publication`,
    `${base}/${id}/rebase`,
    `${base}/${id}/submit`,
    `${base}/${id}/withdraw`,
    reviews,
    reviews.toUpperCase() + '/',
    `${reviews}/${id}`,
    `${reviews}/${id}/decision`,
    `${reviews}/${id}/unknown`,
    '/api/catalog/releases',
    '/API/CATALOG/RELEASES/',
    catalog,
    publicPath(),
    catalog + '/unknown/suffix',
  ];
  await stopBff();
  try {
    for (const at of origins) {
      for (const route of routes)
        await request(route, { at, actor: reviewer, status: [502, 504] });
      await request(publicPath(), { at, method: 'HEAD', status: [502, 504] });
      for (const method of ['POST', 'PUT', 'DELETE'])
        await change(
          `${base}/${id}`,
          owner,
          { expectedRevision: 1 },
          { at, method, status: [502, 504] }
        );
    }
  } finally {
    await restartBff();
  }
  for (const at of origins) {
    await request(base + '?ownerIdentityId=' + watcher.uid, {
      at,
      actor: owner,
      status: 400,
    });
    await request(`${base}/${id}/unknown`, {
      at,
      actor: owner,
      status: 404,
      cache: null,
    });
  }
  await services.stopEditorial();
  try {
    for (const at of origins) {
      await request(base, { at, actor: owner, status: 503 });
      await request(catalog, { at, status: 503 });
      await request(reviews, { at, actor: reviewer, status: 503 });
      await replay(approval, { at, status: 503 });
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
  await services.pauseMongo();
  try {
    await request(catalog, { status: 503 });
  } finally {
    await services.resumeMongo();
  }
  await services.sql.query(
    'RENAME TABLE release_publications TO release_publications_unavailable'
  );
  try {
    await request(catalog, { status: 503 });
    await state(id, owner, { status: 503 });
  } finally {
    await services.sql.query(
      'RENAME TABLE release_publications_unavailable TO release_publications'
    );
  }
  await request(base, { actor: owner });
  await request(publicPath(), { status: 404 });
  console.log(
    'PASS complete release route families: case/slash/unknown paths and methods require BFF; Editorial, policy, SQL and Mongo outages fail truthfully and recover'
  );
}

module.exports = { qualifyReleaseParity };
