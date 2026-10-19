const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const base = '../../apps/services/editorial/src/app/';
const { ApplicationOwnership } = require(base +
  'application-ownership/application-ownership');
const { MysqlApplicationOwnership } = require(base +
  'application-ownership/mysql-application-ownership');
const { EditorialCommands } = require(base + 'application/editorial-commands');
const { MysqlEditorialWrites } = require(base +
  'infrastructure/mysql-editorial-writes');
const { ReleaseWorkspace1791676817000 } = require(base +
  'releases/release-workspace.migration');
const { projectEditorialSnapshot } = require(base +
  'application/editorial-materialization');
const { MysqlEditorialProjectionRecovery } = require(base +
  'infrastructure/mysql-editorial-projection-recovery');
const { reconcileEditorialProjections } = require(base +
  'application/editorial-projection-recovery');

async function releasePublicationChecks({
  source,
  policy,
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
  const owner = { identityId: 'ReleaseOwner', tenantId: 'default', roles: [] };
  const reviewer = {
    identityId: 'ReleaseReviewer',
    tenantId: 'default',
    roles: ['editorial:reviewer'],
  };
  const staff = {
    identityId: 'OwnershipReviewer',
    tenantId: 'default',
    roles: ['editorial:ownership-reviewer'],
  };
  const publisher = {
    identityId: 'Publisher',
    tenantId: 'default',
    roles: ['editorial:publisher'],
  };
  const editorial = new EditorialCommands(
    new MysqlEditorialWrites(source, 'default'),
    policy,
    { generate: randomUUID }
  );
  const application = await editorial.create(
    'app',
    {
      name: 'Release application',
      slug: 'release-application',
      website: 'https://release.example.test',
      description: 'An application with independently reviewed release notes.',
    },
    publisher,
    randomUUID()
  );
  const ownership = new ApplicationOwnership(
    new MysqlApplicationOwnership(source),
    { matches: async () => true },
    policy,
    { id: randomUUID, token: () => randomBytes(32).toString('hex') }
  );
  async function grant(actor) {
    const claim = await ownership.create(
      actor,
      {
        applicationId: application.id,
        evidenceUrl: 'https://release.example.test/team',
        notes: 'I maintain this application and control its official website.',
      },
      randomUUID()
    );
    const proof = await ownership.change(
      actor,
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
  const approvedGrant = await grant(owner);
  const claimId = approvedGrant.id;
  const fields = {
    version: '2026.10+stable',
    channel: 'stable',
    type: 'major',
    releasedOn: new Date().toISOString().slice(0, 10),
    title: 'Reviewed release',
    description:
      'Release content that remains frozen throughout independent review.',
    changes: [
      {
        type: 'security',
        description: 'Enforce current application authority.',
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
      `me/releases/${id}/publication`,
      undefined,
      actor
    );
  const draft = (id, actor = owner) =>
    expectRequest(200, 'GET', `me/releases/${id}`, undefined, actor);
  const readPublic = () =>
    request(
      'GET',
      `catalog/releases/release-application/${encodeURIComponent(
        fields.version
      )}`,
      undefined,
      null
    );
  const countOutbox = async () =>
    Number(
      (await source.query('SELECT COUNT(*) AS total FROM editorial_outbox'))[0]
        .total
    );
  async function publish(id) {
    return projections.publish(
      projectEditorialSnapshot(await reader.read('release', id))
    );
  }
  async function submit(id, actor = owner, key) {
    const current = await status(id, actor);
    return expectRequest(
      201,
      'POST',
      `me/releases/${id}/submit`,
      {
        expectedRevision: current.revision,
        expectedPublicationRevision: current.publicationRevision,
      },
      actor,
      key
    );
  }
  async function decide(id, decision = 'approve', expected = 201, key) {
    const current = await expectRequest(
      200,
      'GET',
      `editorial/release-reviews/${id}`,
      undefined,
      reviewer
    );
    return expectRequest(
      expected,
      'POST',
      `editorial/release-reviews/${id}/decision`,
      {
        decision,
        expectedRevision: current.revision,
        expectedPublicationRevision: current.publicationRevision,
        submittedRevision: current.latestSubmission.submittedRevision,
        reason:
          decision === 'reject' ? 'Resubmit against current publication.' : '',
      },
      reviewer,
      key
    );
  }
  async function open(actor = owner, pinnedClaim = claimId) {
    const current = await expectRequest(
      200,
      'GET',
      `me/releases/source/${application.id}?releaseId=${releaseId}`,
      undefined,
      actor
    );
    return expectRequest(
      201,
      'POST',
      'me/releases/open',
      {
        applicationId: application.id,
        claimId: pinnedClaim,
        releaseId,
        expectedPublicationRevision: current.release.revision,
      },
      actor
    );
  }

  assert.equal(
    (await request('GET', 'me/releases', undefined, null)).status,
    401
  );
  const sourceView = await expectRequest(
    200,
    'GET',
    `me/releases/source/${application.id}`
  );
  assert.equal(sourceView.claimId, claimId);
  const input = { applicationId: application.id, claimId, fields };
  const createKey = randomUUID(),
    outboxBefore = await countOutbox();
  await source.query(
    "CREATE TRIGGER fail_release_receipt BEFORE INSERT ON release_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected release receipt failure'"
  );
  try {
    await expectRequest(503, 'POST', 'me/releases', input, owner, createKey);
    assert.equal(
      (await source.query('SELECT * FROM release_drafts')).length,
      0
    );
    assert.equal(await countOutbox(), outboxBefore);
  } finally {
    await source.query('DROP TRIGGER fail_release_receipt');
  }
  const created = await expectRequest(
    201,
    'POST',
    'me/releases',
    input,
    owner,
    createKey
  );
  assert.deepEqual(
    await expectRequest(201, 'POST', 'me/releases', input, owner, createKey),
    created
  );
  await expectRequest(
    409,
    'POST',
    'me/releases',
    { ...input, fields: { ...fields, title: 'Changed' } },
    owner,
    createKey
  );
  for (const actor of [
    { ...owner, identityId: 'releaseowner' },
    { ...owner, tenantId: 'other' },
  ])
    await expectRequest(
      404,
      'GET',
      `me/releases/${created.id}`,
      undefined,
      actor
    );
  const saved = await draft(created.id),
    releaseId = saved.target.releaseId;
  assert.notEqual(created.id, releaseId);
  assert.equal(await countOutbox(), outboxBefore);
  assert.equal((await readPublic()).status, 404);
  await expectRequest(400, 'PUT', `me/releases/${created.id}`, {
    fields,
    expectedRevision: 1,
    ownerIdentityId: 'forged',
  });
  pass(
    'release drafts are durable, private, tenant/case scoped and replayable without publication intent'
  );

  await submit(created.id);
  await expectRequest(200, 'PUT', `me/releases/${created.id}`, {
    expectedRevision: 2,
    fields: { ...fields, title: 'Unreviewed private edits' },
  });
  const reviewView = await expectRequest(
    200,
    'GET',
    `editorial/release-reviews/${created.id}`,
    undefined,
    reviewer
  );
  assert.equal(reviewView.latestSubmission.title, fields.title);
  for (const actor of [
    { ...owner, roles: ['admin'] },
    { ...reviewer, roles: [] },
    { ...reviewer, roles: ['editorial:ownership-reviewer'] },
  ])
    await expectRequest(
      403,
      'GET',
      `editorial/release-reviews/${created.id}`,
      undefined,
      actor
    );
  const approvalInput = {
    decision: 'approve',
    expectedRevision: 3,
    expectedPublicationRevision: null,
    submittedRevision: 1,
    reason: '',
  };
  await expectRequest(
    409,
    'POST',
    `editorial/release-reviews/${created.id}/decision`,
    { ...approvalInput, expectedRevision: 2 },
    reviewer
  );
  const approveKey = randomUUID();
  await source.query(
    "CREATE TRIGGER fail_release_outbox BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected release intent failure'"
  );
  try {
    await expectRequest(
      503,
      'POST',
      `editorial/release-reviews/${created.id}/decision`,
      approvalInput,
      reviewer,
      approveKey
    );
    assert.equal(
      (await status(created.id)).latestSubmission.status,
      'submitted'
    );
    assert.equal(
      (await source.query('SELECT * FROM release_publications')).length,
      0
    );
    assert.equal((await draft(created.id)).revision, 3);
    assert.equal(await countOutbox(), outboxBefore);
  } finally {
    await source.query('DROP TRIGGER fail_release_outbox');
  }
  const approved = await expectRequest(
    201,
    'POST',
    `editorial/release-reviews/${created.id}/decision`,
    approvalInput,
    reviewer,
    approveKey
  );
  assert.deepEqual(
    await expectRequest(
      201,
      'POST',
      `editorial/release-reviews/${created.id}/decision`,
      approvalInput,
      reviewer,
      approveKey
    ),
    approved
  );
  assert.equal(approved.publicationRevision, 1);
  assert.equal(await countOutbox(), outboxBefore + 1);
  assert.equal((await readPublic()).status, 503);
  await publish(releaseId);
  assert.equal((await readPublic()).json.title, fields.title);
  pass(
    'independent review freezes saved notes; failed outbox rolls back content, decision, revisions and receipt; approval replay has one effect'
  );

  const original = await projections.find('release', releaseId);
  await restart();
  assert.equal((await draft(created.id)).title, 'Unreviewed private edits');
  assert.equal((await readPublic()).json.title, fields.title);
  await expectRequest(200, 'DELETE', `me/releases/${created.id}`, {
    expectedRevision: 4,
  });
  assert.equal((await readPublic()).status, 200);
  assert.deepEqual(await reader.read('release', releaseId), {
    kind: 'release',
    resourceId: releaseId,
    tenantId: 'default',
    revision: 1,
    deletedAt: null,
    content: {
      ...fields,
      applicationId: application.id,
      publishedAt: original.content.publishedAt,
    },
  });
  assert.deepEqual(
    await expectRequest(
      201,
      'POST',
      `editorial/release-reviews/${created.id}/decision`,
      approvalInput,
      reviewer,
      approveKey
    ),
    approved
  );
  await collection.deleteOne({ _id: `release:${releaseId}` });
  assert.equal((await readPublic()).status, 503);
  const recovery = await reconcileEditorialProjections(
    new MysqlEditorialProjectionRecovery(source),
    reader,
    projections,
    { apply: true }
  );
  assert.equal(recovery.failed, 0);
  assert.equal(recovery.conflicts, 0);
  assert.ok(recovery.queued > 0);
  await publish(releaseId);
  assert.equal((await readPublic()).status, 200);
  pass(
    'API restart and draft deletion preserve reviewed canonical content; projection loss rebuilds from authority without private submissions'
  );

  const duplicate = await expectRequest(201, 'POST', 'me/releases', input);
  await submit(duplicate.id);
  await decide(duplicate.id, 'approve', 409);
  await decide(duplicate.id, 'reject');
  assert.equal((await readPublic()).json.title, fields.title);
  const first = await open(),
    second = await open();
  await expectRequest(409, 'PUT', `me/releases/${first.id}`, {
    expectedRevision: 1,
    fields: { ...fields, version: 'renamed-url' },
  });
  await submit(first.id);
  await submit(second.id);
  const beforeDecisions = await Promise.all([
    status(first.id),
    status(second.id),
  ]);
  const decisions = await Promise.all(
    [first, second].map((item, index) =>
      request(
        'POST',
        `editorial/release-reviews/${item.id}/decision`,
        {
          decision: 'approve',
          expectedRevision: beforeDecisions[index].revision,
          expectedPublicationRevision:
            beforeDecisions[index].publicationRevision,
          submittedRevision:
            beforeDecisions[index].latestSubmission.submittedRevision,
          reason: '',
        },
        reviewer
      )
    )
  );
  // Both requests load the same public revision; exactly one can replace it.
  assert.deepEqual(decisions.map((result) => result.status).sort(), [201, 409]);
  const firstState = await status(first.id),
    winner = firstState.latestSubmission.status === 'approved' ? first : second;
  const loser = winner.id === first.id ? second : first;
  assert.equal((await status(loser.id)).latestSubmission.status, 'submitted');
  await decide(loser.id, 'approve', 409);
  const stale = await draft(loser.id),
    current = await status(loser.id);
  await expectRequest(201, 'POST', `me/releases/${loser.id}/rebase`, {
    expectedRevision: stale.revision,
    expectedPublicationRevision: current.publicationRevision,
    fields: { ...fields, title: 'Explicitly merged notes' },
  });
  assert.equal((await status(loser.id)).latestSubmission.status, 'cancelled');
  await submit(loser.id);
  await decide(loser.id);
  await publish(releaseId);
  assert.equal((await readPublic()).json.title, 'Explicitly merged notes');
  pass(
    'canonical version uniqueness, immutable version URLs, competing drafts and explicit rebase prevent lost publication updates'
  );

  const revokedDraft = await open();
  await submit(revokedDraft.id);
  const grantState = await ownership.read(owner, claimId);
  await ownership.change(
    staff,
    claimId,
    'revoke',
    { expectedRevision: grantState.revision, reason: 'Ownership transferred.' },
    randomUUID()
  );
  await decide(revokedDraft.id, 'approve', 403);
  assert.equal((await readPublic()).status, 200);
  await expectRequest(200, 'PUT', `me/releases/${revokedDraft.id}`, {
    expectedRevision: 2,
    fields: { ...fields, title: 'Former owner private work' },
  });
  await expectRequest(403, 'POST', 'me/releases', input);
  const newOwner = { ...owner, identityId: 'Successor' },
    successorGrant = await grant(newOwner);
  const successor = await open(newOwner, successorGrant.id);
  await expectRequest(
    404,
    'GET',
    `me/releases/${revokedDraft.id}`,
    undefined,
    newOwner
  );
  await expectRequest(403, 'POST', `me/releases/${revokedDraft.id}/rebase`, {
    expectedRevision: 3,
    expectedPublicationRevision: (
      await status(revokedDraft.id)
    ).publicationRevision,
    fields,
  });
  const successorState = await status(successor.id, newOwner);
  await expectRequest(
    201,
    'POST',
    `me/releases/${successor.id}/withdraw`,
    {
      expectedRevision: successorState.revision,
      expectedPublicationRevision: successorState.publicationRevision,
    },
    newOwner
  );
  assert.equal((await readPublic()).status, 404);
  await publish(releaseId);
  assert.equal((await projections.find('release', releaseId)).content, null);
  assert.equal(await projections.publish(original), 'superseded');
  await expectRequest(200, 'DELETE', `me/releases/${revokedDraft.id}`, {
    expectedRevision: 3,
  });
  pass(
    'revoked grants cannot approve or rebase; successors use separate drafts and can withdraw immediately while old events cannot resurrect content'
  );

  await submit(successor.id, newOwner);
  await decide(successor.id);
  await publish(releaseId);
  assert.equal((await readPublic()).status, 200);
  assert.equal(
    (await status(successor.id, newOwner)).application.id,
    application.id
  );
  await source.query('UPDATE app_records SET isSuspended = 1 WHERE id = ?', [
    application.id,
  ]);
  assert.equal((await readPublic()).status, 404);
  assert.equal((await status(successor.id, newOwner)).application, null);
  await source.query('UPDATE app_records SET isSuspended = 0 WHERE id = ?', [
    application.id,
  ]);
  assert.equal((await readPublic()).status, 200);
  await source.query(
    "UPDATE editorial_resource_states SET deletedAt = ? WHERE resourceKind = 'app' AND resourceId = ?",
    [Date.now(), application.id]
  );
  assert.equal((await readPublic()).status, 404);
  assert.equal((await status(successor.id, newOwner)).application, null);
  await source.query(
    "UPDATE editorial_resource_states SET deletedAt = NULL WHERE resourceKind = 'app' AND resourceId = ?",
    [application.id]
  );
  pass(
    'current parent suspension and withdrawal hide release content despite an unchanged previously public projection'
  );

  if (broker) {
    await require('./release-publication-delivery.cjs').releasePublicationDelivery(
      {
        source,
        reader,
        projections,
        collection,
        ...broker,
        id: releaseId,
        pass,
        withdraw: async () => {
          const current = await status(successor.id, newOwner);
          await expectRequest(
            201,
            'POST',
            `me/releases/${successor.id}/withdraw`,
            {
              expectedRevision: current.revision,
              expectedPublicationRevision: current.publicationRevision,
            },
            newOwner
          );
          assert.equal((await readPublic()).status, 404);
        },
      }
    );
    await submit(successor.id, newOwner);
    await decide(successor.id);
    await publish(releaseId);
  }
  const migration = new ReleaseWorkspace1791676817000(),
    runner = source.createQueryRunner();
  try {
    await migration.up(runner);
    await assert.rejects(migration.down(), /data-preserving/);
    await source.query(
      'UPDATE release_submissions SET reviewerIdentityId = ? WHERE draftId = ? AND status = ?',
      [newOwner.identityId, successor.id, 'approved']
    );
    try {
      await assert.rejects(
        migration.up(runner),
        /Invalid independent Editorial review attribution/
      );
    } finally {
      await source.query(
        'UPDATE release_submissions SET reviewerIdentityId = ? WHERE draftId = ? AND status = ?',
        [reviewer.identityId, successor.id, 'approved']
      );
    }
    await source.query(
      'RENAME TABLE release_commands TO release_commands_missing'
    );
    try {
      await assert.rejects(migration.up(runner), /Missing completed/);
    } finally {
      await source.query(
        'RENAME TABLE release_commands_missing TO release_commands'
      );
    }
    await migration.up(runner);
  } finally {
    await runner.release();
  }
  await restart();
  assert.equal((await readPublic()).status, 200);
  pass(
    'additive migration reentry validates populated history, rejects forged reviewer authority and refuses silently recreating a lost completed table'
  );
  let workspace = await expectRequest(
    200,
    'GET',
    'me/releases',
    undefined,
    newOwner
  );
  for (let n = workspace.length; n < 99; n++)
    await expectRequest(
      201,
      'POST',
      'me/releases',
      {
        ...input,
        claimId: successorGrant.id,
        fields: { ...fields, version: `capacity-${n}` },
      },
      newOwner
    );
  const lastSlots = await Promise.all(
    [100, 101].map((n) =>
      request(
        'POST',
        'me/releases',
        {
          ...input,
          claimId: successorGrant.id,
          fields: { ...fields, version: `capacity-${n}` },
        },
        newOwner
      )
    )
  );
  assert.deepEqual(lastSlots.map((result) => result.status).sort(), [201, 409]);
  workspace = await expectRequest(
    200,
    'GET',
    'me/releases',
    undefined,
    newOwner
  );
  assert.equal(workspace.length, 100);
  const editing = workspace.find((item) => item.id !== successor.id);
  const competing = await Promise.all(
    ['First', 'Second'].map((title) =>
      request(
        'PUT',
        `me/releases/${editing.id}`,
        {
          expectedRevision: editing.revision,
          fields: { ...fields, title },
        },
        newOwner
      )
    )
  );
  assert.deepEqual(competing.map((result) => result.status).sort(), [200, 409]);
  pass(
    'capacity and draft revision locks serialize competing writers without exceeding 100 drafts or losing an accepted edit'
  );
  if (qualifyBrowser) await qualifyBrowser();
  await stopPolicy();
  const commandsBefore = Number(
    (await source.query('SELECT COUNT(*) AS total FROM release_commands'))[0]
      .total
  );
  await expectRequest(
    503,
    'POST',
    'me/releases',
    { ...input, claimId: successorGrant.id },
    newOwner
  );
  await expectRequest(
    503,
    'GET',
    'editorial/release-reviews',
    undefined,
    reviewer
  );
  assert.equal(
    Number(
      (await source.query('SELECT COUNT(*) AS total FROM release_commands'))[0]
        .total
    ),
    commandsBefore
  );
  pass(
    'policy outage fails closed before reads or writes without creating receipts'
  );
}
module.exports = { releasePublicationChecks };
