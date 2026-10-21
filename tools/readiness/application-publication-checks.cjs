const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

async function applicationPublicationChecks({
  root,
  source,
  origin,
  headers,
  restart,
  stopPolicy,
  reader,
  projections,
  output,
  browser,
  delivery,
  pass,
}) {
  const { projectEditorialSnapshot } = require(path.join(
    root,
    'apps/services/editorial/src/app/application/editorial-materialization'
  ));
  const { ApplicationPublication1791676811000 } = require(path.join(
    root,
    'apps/services/editorial/src/app/application-publication/application-publication.migration'
  ));
  const owner = 'PublicationAuthor';
  const reviewer = 'ApplicationReviewer';
  const fields = {
    name: 'Submitted Application',
    slug: 'submitted-application',
    website: 'https://example.test/' + 'a'.repeat(2027),
    description: 'An application submitted through the real publication API.',
  };
  assert.equal(fields.website.length, 2048);
  async function request(
    method,
    route,
    body,
    uid = owner,
    roles = [],
    key = randomUUID(),
    tenant = 'default'
  ) {
    const response = await fetch(origin() + '/api/' + route, {
      method,
      headers: {
        ...(uid
          ? headers(uid, tenant, roles)
          : { 'content-type': 'application/json' }),
        'idempotency-key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    return { status: response.status, json: await response.json() };
  }
  const countOutbox = async () =>
    Number(
      (await source.query('SELECT COUNT(*) AS total FROM editorial_outbox'))[0]
        .total
    );
  const created = await request('POST', 'me/application-drafts', fields);
  assert.equal(created.status, 201);
  const id = created.json.id;
  const base = 'me/application-drafts/' + id;
  const state = async () => (await request('GET', base + '/publication')).json;
  const decision = async (
    action,
    input,
    uid = reviewer,
    roles = ['editorial:reviewer'],
    key = randomUUID(),
    tenant = 'default'
  ) =>
    request(
      'POST',
      'editorial/application-reviews/' + id + '/decision',
      { decision: action, ...input },
      uid,
      roles,
      key,
      tenant
    );
  const publish = async () =>
    projections.publish(projectEditorialSnapshot(await reader.read('app', id)));
  const publicRead = (slug = fields.slug) =>
    request('GET', 'catalog/apps/' + slug, undefined, '');
  const initialOutbox = await countOutbox();
  assert.equal((await publicRead()).status, 404);
  const submitKey = randomUUID();
  const submitted = await request(
    'POST',
    base + '/submit',
    { expectedRevision: 1 },
    owner,
    [],
    submitKey
  );
  assert.equal(submitted.status, 201);
  assert.deepEqual(
    await request(
      'POST',
      base + '/submit',
      { expectedRevision: 1 },
      owner,
      [],
      submitKey
    ),
    submitted
  );
  assert.equal(await countOutbox(), initialOutbox);
  const current = await state();
  assert.equal(current.latestSubmission.submittedRevision, 1);
  assert.equal(current.latestSubmission.website, fields.website);
  assert.equal(
    (await request('POST', base + '/submit', { expectedRevision: 2 })).status,
    409
  );
  assert.equal(
    (await request('GET', base + '/publication', undefined, 'AnotherAuthor'))
      .status,
    404
  );
  assert.equal(
    (
      await decision(
        'approve',
        { expectedRevision: 2, submittedRevision: 1 },
        owner,
        ['admin']
      )
    ).status,
    403
  );
  assert.equal(
    (
      await decision(
        'approve',
        { expectedRevision: 2, submittedRevision: 1 },
        reviewer,
        []
      )
    ).status,
    403
  );
  assert.equal(
    (
      await decision(
        'approve',
        { expectedRevision: 2, submittedRevision: 1 },
        reviewer,
        ['editorial:reviewer'],
        undefined,
        'other'
      )
    ).status,
    404
  );
  pass(
    'immutable submission is private, idempotent, and review requires an independent authorized actor in the same tenant'
  );

  assert.equal(
    (
      await request('PUT', base, {
        ...fields,
        name: 'Later private draft',
        expectedRevision: 2,
      })
    ).status,
    200
  );
  const queue = await request(
    'GET',
    'editorial/application-reviews',
    undefined,
    reviewer,
    ['editorial:reviewer']
  );
  assert.equal(queue.status, 200);
  assert.equal(queue.json.items[0].latestSubmission.name, fields.name);
  const approvalKey = randomUUID();
  const approved = await decision(
    'approve',
    { expectedRevision: 3, submittedRevision: 1 },
    reviewer,
    ['editorial:reviewer'],
    approvalKey
  );
  assert.equal(approved.status, 201);
  assert.equal(approved.json.publicationRevision, 1);
  assert.equal((await publicRead()).status, 503);
  await publish();
  const publicApp = await publicRead();
  assert.equal(publicApp.status, 200);
  assert.equal(publicApp.json.name, fields.name);
  assert.equal(publicApp.json.website, fields.website);
  assert.equal((await request('GET', base)).json.name, 'Later private draft');
  await restart();
  assert.deepEqual(
    await decision(
      'approve',
      { expectedRevision: 3, submittedRevision: 1 },
      reviewer,
      ['editorial:reviewer'],
      approvalKey
    ),
    approved
  );
  assert.equal((await publicRead()).json.name, fields.name);
  pass(
    'approval publishes the immutable submitted version through the existing projection and preserves later private edits across restart'
  );

  await request('POST', base + '/submit', { expectedRevision: 4 });
  assert.equal(
    (
      await decision('reject', {
        expectedRevision: 5,
        submittedRevision: 4,
        reason: '',
      })
    ).status,
    400
  );
  assert.equal(
    (
      await decision('reject', {
        expectedRevision: 5,
        submittedRevision: 4,
        reason: 'More detail required',
      })
    ).status,
    201
  );
  assert.equal((await state()).latestSubmission.reason, 'More detail required');
  assert.equal((await publicRead()).json.name, fields.name);
  await request('POST', base + '/submit', { expectedRevision: 6 });
  const beforeFailure = await state();
  const beforeOutbox = await countOutbox();
  await source.query(
    "CREATE TRIGGER fail_application_publication BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected publication failure'"
  );
  const failedKey = randomUUID();
  try {
    assert.equal(
      (
        await decision(
          'approve',
          { expectedRevision: 7, submittedRevision: 6 },
          reviewer,
          ['editorial:reviewer'],
          failedKey
        )
      ).status,
      503
    );
    assert.deepEqual(await state(), beforeFailure);
    assert.equal(await countOutbox(), beforeOutbox);
    assert.equal((await publicRead()).json.name, fields.name);
    assert.equal(
      (await request('POST', base + '/withdraw', { expectedRevision: 7 }))
        .status,
      503
    );
    assert.equal(
      (await request('DELETE', base, { expectedRevision: 7 })).status,
      503
    );
    assert.deepEqual(await state(), beforeFailure);
  } finally {
    await source.query('DROP TRIGGER fail_application_publication');
  }
  assert.equal(
    (
      await decision(
        'approve',
        { expectedRevision: 7, submittedRevision: 6 },
        reviewer,
        ['editorial:reviewer'],
        failedKey
      )
    ).status,
    201
  );
  assert.equal((await publicRead()).status, 503);
  await publish();
  assert.equal((await publicRead()).json.name, 'Later private draft');
  pass(
    'rejection preserves approved content; outbox failure rolls back decision, public content, revisions, receipts and withdrawal/deletion'
  );

  await request('POST', base + '/submit', { expectedRevision: 8 });
  const direct = await request(
    'PUT',
    'apps/' + id,
    { name: 'Direct editorial update', expectedRevision: 2 },
    'CatalogModerator',
    ['editorial:moderator']
  );
  assert.equal(direct.status, 200);
  assert.equal(
    (await decision('approve', { expectedRevision: 9, submittedRevision: 8 }))
      .status,
    409
  );
  assert.equal((await state()).publishedSubmissionRevision, null);
  await publish();
  assert.equal((await publicRead()).json.name, 'Direct editorial update');
  assert.equal(
    (
      await decision('reject', {
        expectedRevision: 9,
        submittedRevision: 8,
        reason: 'Public version changed',
      })
    ).status,
    201
  );
  pass(
    'a changed canonical public revision cannot be silently overwritten by stale approval'
  );

  const oldProjection = projectEditorialSnapshot(await reader.read('app', id));
  const withdrawn = await request('POST', base + '/withdraw', {
    expectedRevision: 10,
  });
  assert.equal(withdrawn.status, 201);
  assert.equal((await publicRead()).status, 404);
  await publish();
  await projections.publish(oldProjection);
  assert.equal((await publicRead()).status, 404);
  assert.deepEqual(
    await decision(
      'approve',
      { expectedRevision: 3, submittedRevision: 1 },
      reviewer,
      ['editorial:reviewer'],
      approvalKey
    ),
    approved
  );
  assert.equal((await publicRead()).status, 404);
  await request('POST', base + '/submit', { expectedRevision: 11 });
  assert.equal(
    (await decision('approve', { expectedRevision: 12, submittedRevision: 11 }))
      .status,
    201
  );
  await publish();
  assert.equal((await publicRead()).status, 200);
  assert.equal(
    (await request('DELETE', base, { expectedRevision: 13 })).status,
    200
  );
  assert.equal((await publicRead()).status, 404);
  assert.equal(
    (
      await source.query(
        'SELECT * FROM application_submissions WHERE applicationId = ?',
        [id]
      )
    ).length,
    0
  );
  const [deleted] = await source.query(
    'SELECT name, website, description FROM app_records WHERE id = ?',
    [id]
  );
  assert.deepEqual(
    { ...deleted },
    { name: '', website: null, description: null }
  );
  await publish();
  await projections.publish(oldProjection);
  assert.equal((await publicRead()).status, 404);
  pass(
    'withdrawal/deletion revoke public access during projection lag, scrub content and prevent stale events or receipts from restoring visibility'
  );

  const rivalFields = { ...fields, name: 'Slug collision', slug: fields.slug };
  const rival = await request(
    'POST',
    'me/application-drafts',
    rivalFields,
    'Rival'
  );
  const rivalBase = 'me/application-drafts/' + rival.json.id;
  await request(
    'POST',
    rivalBase + '/submit',
    { expectedRevision: 1 },
    'Rival'
  );
  const collision = await request(
    'POST',
    'editorial/application-reviews/' + rival.json.id + '/decision',
    { decision: 'approve', expectedRevision: 2, submittedRevision: 1 },
    reviewer,
    ['editorial:reviewer']
  );
  assert.equal(collision.status, 409);
  assert.equal(
    (await request('GET', rivalBase + '/publication', undefined, 'Rival')).json
      .latestSubmission.status,
    'submitted'
  );
  const migrate = async () => {
    const runner = source.createQueryRunner();
    try {
      await new ApplicationPublication1791676811000().up(runner);
    } finally {
      await runner.release();
    }
  };
  await migrate();
  pass(
    'public slug collisions leave submissions pending and migration reentry preserves decisions and tombstones'
  );

  const racing = await request('POST', 'me/application-drafts', {
    ...fields,
    slug: 'racing-application',
  });
  const racingId = racing.json.id;
  const racingBase = 'me/application-drafts/' + racingId;
  const racingKey = randomUUID();
  const submissions = await Promise.all(
    [0, 1].map(() =>
      request(
        'POST',
        racingBase + '/submit',
        { expectedRevision: 1 },
        owner,
        [],
        racingKey
      )
    )
  );
  assert.equal(submissions[0].status, 201);
  assert.deepEqual(submissions[0], submissions[1]);
  const racingOutbox = await countOutbox();
  const decisions = await Promise.all(
    ['approve', 'reject'].map((decision, index) =>
      request(
        'POST',
        'editorial/application-reviews/' + racingId + '/decision',
        {
          decision,
          expectedRevision: 2,
          submittedRevision: 1,
          reason: decision === 'reject' ? 'Concurrent rejection' : '',
        },
        'RacingReviewer' + index,
        ['editorial:reviewer']
      )
    )
  );
  assert.deepEqual(decisions.map((item) => item.status).sort(), [201, 409]);
  const winner = decisions.find((item) => item.status === 201).json.action;
  const racingState = (await request('GET', racingBase + '/publication')).json;
  assert.equal(racingState.revision, 3);
  assert.equal(
    racingState.latestSubmission.status,
    winner === 'approve' ? 'approved' : 'rejected'
  );
  assert.equal(
    await countOutbox(),
    racingOutbox + (winner === 'approve' ? 1 : 0)
  );
  await migrate();
  pass(
    'concurrent identical submissions replay one receipt; competing reviewers commit exactly one decision and public intent'
  );

  const [storedCommand] = await source.query(
    'SELECT * FROM application_publication_commands WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
    ['default', owner, racingKey]
  );
  const storedReceipt =
    typeof storedCommand.receipt === 'string'
      ? JSON.parse(storedCommand.receipt)
      : storedCommand.receipt;
  for (const corrupted of [
    {},
    { ...storedReceipt, revision: 99 },
    { ...storedReceipt, publicationRevision: 999 },
  ]) {
    await source.query(
      'UPDATE application_publication_commands SET receipt = ? WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
      [JSON.stringify(corrupted), 'default', owner, racingKey]
    );
    try {
      await assert.rejects(migrate);
    } finally {
      await source.query(
        'UPDATE application_publication_commands SET receipt = ? WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
        [JSON.stringify(storedReceipt), 'default', owner, racingKey]
      );
    }
  }
  const [reviewed] = await source.query(
    'SELECT reviewerIdentityId FROM application_submissions WHERE applicationId = ?',
    [racingId]
  );
  for (const reviewerIdentityId of [null, owner]) {
    await source.query(
      'UPDATE application_submissions SET reviewerIdentityId = ? WHERE applicationId = ?',
      [reviewerIdentityId, racingId]
    );
    try {
      await assert.rejects(
        migrate,
        reviewerIdentityId === null
          ? /Anonymous Editorial review has no exact erasure timestamp/
          : /Invalid independent Editorial review attribution/
      );
    } finally {
      await source.query(
        'UPDATE application_submissions SET reviewerIdentityId = ? WHERE applicationId = ?',
        [reviewed.reviewerIdentityId, racingId]
      );
    }
  }
  await migrate();
  pass(
    'migration reentry rejects malformed receipts, impossible revisions and missing/self reviewers without discarding authoritative history'
  );

  if (delivery) await delivery();
  if (browser)
    await require('./application-publication-browser.cjs').applicationPublicationBrowser(
      { root, source, origin, headers, restart, reader, projections, output }
    );
  await stopPolicy();
  assert.equal(
    (
      await request(
        'POST',
        rivalBase + '/submit',
        { expectedRevision: 2 },
        'Rival'
      )
    ).status,
    503
  );
  pass('policy outage denies publication commands');
}
module.exports = { applicationPublicationChecks };
