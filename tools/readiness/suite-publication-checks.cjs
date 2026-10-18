const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function suitePublicationChecks({
  origin,
  headers,
  source,
  reader,
  projections,
  restart,
  applicationId,
  pass,
}) {
  const owner = { uid: 'SuitePublisher', roles: [] };
  const reviewer = { uid: 'SuiteReviewer', roles: ['editorial:reviewer'] };
  const request = async (
    method,
    path,
    body,
    actor = owner,
    key = randomUUID()
  ) => {
    const response = await fetch(origin() + '/api/' + path, {
      method,
      headers: {
        ...headers(actor.uid, actor.tenant ?? 'default', actor.roles),
        'idempotency-key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    return { status: response.status, value: await response.json() };
  };
  const change = async (id, action, body, actor = owner, key = randomUUID()) =>
    request(
      'POST',
      action === 'approve' || action === 'reject'
        ? `editorial/suite-reviews/${id}/decision`
        : `me/suites/${id}/${action}`,
      {
        ...body,
        ...(action === 'approve' || action === 'reject'
          ? { decision: action }
          : {}),
      },
      actor,
      key
    );
  const fields = {
    title: 'Approved collection',
    description: 'Reviewed public tools',
    applicationIds: [applicationId],
  };
  const created = await request('POST', 'me/suites', fields);
  assert.equal(created.status, 201);
  const id = created.value.id;
  const status = () => request('GET', `me/suites/${id}/publication`);
  const publicRead = () => request('GET', `catalog/suites/${id}`);
  const project = async () => {
    const {
      projectEditorialSnapshot,
    } = require('../../apps/services/editorial/src/app/application/editorial-materialization');
    const document = projectEditorialSnapshot(await reader.read('suite', id));
    await projections.publish(document);
    return document;
  };
  assert.equal((await publicRead()).status, 404);
  const submitted = await change(
    id,
    'submit',
    { expectedRevision: 1 },
    owner,
    'suite-submit'
  );
  assert.equal(submitted.status, 201);
  assert.equal(submitted.value.submittedRevision, 1);
  assert.deepEqual(
    (await change(id, 'submit', { expectedRevision: 1 }, owner, 'suite-submit'))
      .value,
    submitted.value
  );
  assert.equal(
    (await change(id, 'submit', { expectedRevision: 2 })).status,
    409
  );
  assert.equal((await publicRead()).status, 404);
  assert.equal((await request('GET', 'editorial/suite-reviews')).status, 403);
  assert.equal(
    (
      await request('GET', `editorial/suite-reviews/${id}`, undefined, {
        ...reviewer,
        tenant: 'other',
      })
    ).status,
    404
  );
  assert.equal(
    (
      await change(
        id,
        'approve',
        { expectedRevision: 2, submittedRevision: 1 },
        { ...owner, roles: ['admin'] }
      )
    ).status,
    403
  );
  assert.equal(
    (
      await request('PUT', `me/suites/${id}`, {
        ...fields,
        title: 'Later private edit',
        expectedRevision: 2,
      })
    ).status,
    200
  );
  const review = await request(
    'GET',
    `editorial/suite-reviews/${id}`,
    undefined,
    reviewer
  );
  assert.equal(review.value.latestSubmission.title, fields.title);
  assert.equal(review.value.revision, 3);
  assert.ok(
    (
      await request('GET', 'editorial/suite-reviews', undefined, reviewer)
    ).value.items.some((item) => item.id === id)
  );
  const approval = await change(
    id,
    'approve',
    { expectedRevision: 3, submittedRevision: 1 },
    reviewer,
    'first-approval'
  );
  assert.equal(approval.status, 201);
  assert.equal((await publicRead()).status, 503);
  await project();
  assert.equal((await publicRead()).value.title, fields.title);
  await restart();
  assert.equal((await publicRead()).value.title, fields.title);
  pass(
    'immutable submitted revision, reviewer authorization, public projection lag and process restart'
  );

  assert.equal(
    (await change(id, 'submit', { expectedRevision: 4 })).status,
    201
  );
  assert.equal((await publicRead()).value.title, fields.title);
  assert.equal(
    (
      await change(
        id,
        'reject',
        { expectedRevision: 5, submittedRevision: 4, reason: '' },
        reviewer
      )
    ).status,
    400
  );
  assert.equal(
    (
      await change(
        id,
        'reject',
        {
          expectedRevision: 5,
          submittedRevision: 4,
          reason: 'Explain the changes',
        },
        reviewer
      )
    ).status,
    201
  );
  assert.equal(
    (await status()).value.latestSubmission.reason,
    'Explain the changes'
  );
  assert.equal((await publicRead()).value.title, fields.title);
  assert.equal(
    (await change(id, 'submit', { expectedRevision: 6 })).status,
    201
  );
  await source.query(
    "CREATE TRIGGER fail_suite_publication_outbox BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected publication outbox failure'"
  );
  const replacementInput = { expectedRevision: 7, submittedRevision: 6 };
  assert.equal(
    (await change(id, 'approve', replacementInput, reviewer, 'replacement'))
      .status,
    503
  );
  assert.equal((await status()).value.revision, 7);
  assert.equal((await status()).value.latestSubmission.status, 'submitted');
  assert.equal((await publicRead()).value.title, fields.title);
  await source.query('DROP TRIGGER fail_suite_publication_outbox');
  const replacement = await change(
    id,
    'approve',
    replacementInput,
    reviewer,
    'replacement'
  );
  assert.equal(replacement.status, 201);
  assert.equal((await publicRead()).status, 503);
  const replaced = await project();
  assert.equal((await publicRead()).value.title, 'Later private edit');
  pass(
    'rejection preserves prior publication and outbox failure rolls back review, visibility, revision and receipt'
  );

  assert.equal(
    (await change(id, 'withdraw', { expectedRevision: 8 })).status,
    201
  );
  assert.equal((await publicRead()).status, 404);
  assert.deepEqual(
    (await change(id, 'approve', replacementInput, reviewer, 'replacement'))
      .value,
    replacement.value
  );
  assert.equal((await publicRead()).status, 404);
  await project();
  assert.equal(await projections.publish(replaced), 'superseded');
  assert.equal(
    (await change(id, 'submit', { expectedRevision: 9 })).status,
    201
  );
  const lastInput = { expectedRevision: 10, submittedRevision: 9 };
  const lastApproval = await change(
    id,
    'approve',
    lastInput,
    reviewer,
    'last-approval'
  );
  assert.equal(lastApproval.status, 201);
  const live = await project();
  assert.equal((await publicRead()).status, 200);
  assert.equal(
    (await request('DELETE', `me/suites/${id}`, { expectedRevision: 11 }))
      .status,
    200
  );
  assert.equal((await publicRead()).status, 200);
  assert.deepEqual(await project(), live);
  assert.equal(
    (await change(id, 'withdraw', { expectedRevision: 12 })).status,
    201
  );
  assert.equal((await publicRead()).status, 404);
  assert.deepEqual(
    (await change(id, 'approve', lastInput, reviewer, 'last-approval')).value,
    lastApproval.value
  );
  const tombstone = await project();
  assert.equal(tombstone.revision, 5);
  assert.equal(tombstone.content, null);
  assert.equal(await projections.publish(live), 'superseded');
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT COUNT(*) AS total FROM suite_submissions WHERE suiteId = ?',
          [id]
        )
      )[0].total
    ),
    0
  );
  pass(
    'private removal preserves approved publication; explicit withdrawal revokes visibility immediately and old receipts/events cannot resurrect it'
  );
  const racing = await request('POST', 'me/suites', {
    ...fields,
    title: 'Competing review',
  });
  const raceId = racing.value.id;
  await change(raceId, 'submit', { expectedRevision: 1 });
  const decisions = await Promise.all([
    change(
      raceId,
      'approve',
      { expectedRevision: 2, submittedRevision: 1 },
      reviewer
    ),
    change(
      raceId,
      'reject',
      {
        expectedRevision: 2,
        submittedRevision: 1,
        reason: 'Revise the collection',
      },
      { ...reviewer, uid: 'OtherReviewer' }
    ),
  ]);
  assert.deepEqual(decisions.map((item) => item.status).sort(), [201, 409]);
  assert.equal(
    (await request('DELETE', `me/suites/${raceId}`, { expectedRevision: 3 }))
      .status,
    200
  );
  const {
    SuitePublication1791676809000,
  } = require('../../apps/services/editorial/src/app/suites/suite-publication.migration');
  const migrationRunner = source.createQueryRunner();
  try {
    await new SuitePublication1791676809000().up(migrationRunner);
  } finally {
    await migrationRunner.release();
  }
  pass(
    'competing reviewer decisions serialize and publication migration reentry preserves existing rows'
  );
  await require('./suite-publication-snapshots-checks.cjs')({
    source,
    projections,
    pass,
  });
}
module.exports = { suitePublicationChecks };
