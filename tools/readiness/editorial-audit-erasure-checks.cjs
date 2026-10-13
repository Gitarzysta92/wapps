const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const base = '../../apps/services/editorial/src/app/';
const { MysqlEditorialAuditErasure } = require(base +
  'account-erasure/mysql-editorial-audit-erasure');
const { MysqlApplicationOwnership } = require(base +
  'application-ownership/mysql-application-ownership');
const { editorialWorkspaceFamilies } = require(base +
  'account-erasure/editorial-workspace-erasure.tables');
const { hasApplicationAuthoringAuthority } = require(base +
  'application-publication/application-public-state');
const { MysqlEditorialAccountExportSource } = require(base +
  'account-export/mysql-editorial-account-export-source');

module.exports = async function qualifyAuditErasure({
  source,
  owner,
  successor,
  staff,
  ownership,
  json,
  restart,
  pass,
}) {
  assert.equal(source.options.database, 'suites');
  const worker = () => new MysqlEditorialAuditErasure(source);
  const input = { identityId: owner.identityId, revision: 11 };
  await assert.rejects(
    worker().advance(input),
    /Missing Editorial erasure request/
  );
  const reviewer = {
    ...owner,
    roles: ['editorial:reviewer', 'editorial:ownership-reviewer'],
  };
  const peer = { ...successor, identityId: owner.identityId.toLowerCase() };
  const reviews = [];
  async function review(kind, fields, actor, decision = 'approve') {
    const route = {
      application: 'application-drafts',
      suite: 'suites',
      article: 'articles',
      release: 'releases',
    }[kind];
    const draft = await json(201, 'POST', 'me/' + route, fields, actor);
    let state = await json(
      200,
      'GET',
      `me/${route}/${draft.id}/publication`,
      undefined,
      actor
    );
    const expectations = (state) => ({
      expectedRevision: state.revision,
      ...(['article', 'release'].includes(kind)
        ? { expectedPublicationRevision: state.publicationRevision }
        : {}),
    });
    await json(
      201,
      'POST',
      `me/${route}/${draft.id}/submit`,
      expectations(state),
      actor
    );
    state = await json(
      200,
      'GET',
      `me/${route}/${draft.id}/publication`,
      undefined,
      actor
    );
    await json(
      201,
      'POST',
      `editorial/${kind}-reviews/${draft.id}/decision`,
      {
        ...expectations(state),
        submittedRevision: state.latestSubmission.submittedRevision,
        decision,
        reason:
          decision === 'reject'
            ? 'The proposal needs a clearer explanation.'
            : '',
      },
      reviewer
    );
    reviews.push({ kind, id: draft.id, route, actor });
    return draft;
  }
  const appFields = (slug) => ({
    name: 'Audit history application',
    slug,
    website: 'https://audit.example.test',
    description:
      'Independent review history remains valid after reviewer erasure.',
  });
  const peerApp = await review(
    'application',
    appFields('audit-peer-app'),
    peer
  );
  await review('application', appFields('audit-rejected-app'), peer, 'reject');
  for (const decision of ['approve', 'reject']) {
    await review(
      'suite',
      {
        title: `Audit ${decision} collection`,
        description: "Retain another member's reviewed collection.",
        applicationIds: [peerApp.id],
      },
      peer,
      decision
    );
    await review(
      'article',
      {
        title: `Audit ${decision} article`,
        slug: `audit-${decision}-article`,
        excerpt: 'Reviewed history survives an erased reviewer.',
        byline: 'Peer author',
        category: 'Guides',
        tags: [],
        sections: [
          {
            heading: 'Original content',
            paragraphs: [
              'The original content and review reason must remain unchanged.',
            ],
          },
        ],
      },
      peer,
      decision
    );
  }
  const claimInput = (id) => ({
    applicationId: id,
    evidenceUrl: 'https://audit.example.test/team',
    notes: 'I control the official website domain for this application.',
  });
  async function claim(actor, appId, judge) {
    const [app] = await source.query(
      'SELECT website FROM app_records WHERE id=?',
      [appId]
    );
    const created = await ownership.create(
      actor,
      { ...claimInput(appId), evidenceUrl: app.website + '/team' },
      randomUUID()
    );
    const proof = await ownership.change(
      actor,
      created.id,
      'verify',
      { expectedRevision: created.revision },
      randomUUID()
    );
    return ownership.change(
      judge,
      created.id,
      'approve',
      { expectedRevision: proof.revision },
      randomUUID()
    );
  }
  const rejectedClaim = await ownership.create(
    successor,
    claimInput(peerApp.id),
    randomUUID()
  );
  await ownership.change(
    reviewer,
    rejectedClaim.id,
    'reject',
    {
      expectedRevision: rejectedClaim.revision,
      reason: 'The claimant is not the approved maintainer.',
    },
    randomUUID()
  );
  const pending = await ownership.create(
    owner,
    claimInput(peerApp.id),
    randomUUID()
  );
  const pendingCommand = {
    actor: owner,
    id: pending.id,
    key: randomUUID(),
    fingerprint: 'f'.repeat(64),
    action: 'verify',
    input: { expectedRevision: pending.revision },
    at: Date.now(),
  };
  const lease = randomBytes(32).toString('hex');
  const store = new MysqlApplicationOwnership(source);
  assert.ok((await store.reserveCheck(pendingCommand, lease)).lease);

  const peerGrant = await claim(peer, peerApp.id, reviewer);
  for (const decision of ['approve', 'reject'])
    await review(
      'release',
      {
        applicationId: peerApp.id,
        claimId: peerGrant.id,
        fields: {
          version: decision === 'approve' ? '1.0' : '2.0',
          channel: 'stable',
          type: 'major',
          releasedOn: new Date().toISOString().slice(0, 10),
          title: `Audit ${decision} release`,
          description:
            'Preserve the reviewed release and its independent decision.',
          changes: [
            { type: 'security', description: 'Retain review history.' },
          ],
        },
      },
      peer,
      decision
    );

  const transferred = await review(
    'application',
    appFields('audit-transferred-app'),
    peer
  );
  const oldPeerGrant = await claim(peer, transferred.id, reviewer);
  await ownership.change(
    staff,
    oldPeerGrant.id,
    'revoke',
    {
      expectedRevision: oldPeerGrant.revision,
      reason: 'Ownership is being transferred after independent review.',
    },
    randomUUID()
  );
  const formerGrant = await claim(owner, transferred.id, staff);
  await ownership.change(
    staff,
    formerGrant.id,
    'revoke',
    {
      expectedRevision: formerGrant.revision,
      reason: 'Former owner has handed over control.',
    },
    randomUUID()
  );
  const successorGrant = await claim(successor, transferred.id, staff);

  // Deleted application/suite drafts deliberately retain review history; erasure must still anonymize it.
  const deleted = reviews.find((value) => value.kind === 'suite');
  const deletedState = await json(
    200,
    'GET',
    `me/${deleted.route}/${deleted.id}`,
    undefined,
    peer
  );
  await json(
    200,
    'DELETE',
    `me/${deleted.route}/${deleted.id}`,
    { expectedRevision: deletedState.revision },
    peer
  );

  await require('./editorial-audit-migration-checks.cjs')({
    source,
    peerApp,
    peerGrant,
    pass,
  });
  const [receipt] = await source.query(
    'SELECT * FROM application_ownership_commands WHERE claimId=? AND actorIdentityId=? LIMIT 1',
    [peerGrant.id, owner.identityId]
  );
  const columns = Object.keys(receipt);
  for (let i = 0; i < 130; i++)
    await source.query(
      `INSERT INTO application_ownership_commands (${columns.join(
        ','
      )}) VALUES (${columns.map(() => '?').join(',')})`,
      columns.map((column) =>
        column === 'commandKey'
          ? randomUUID()
          : column === 'receipt'
          ? JSON.stringify(receipt[column])
          : receipt[column]
      )
    );
  // Valid SQL stress history represents successive revisions; transport/browser fixtures remain separate.
  const [outbox] = await source.query(
    'SELECT * FROM editorial_outbox WHERE resourceId=? ORDER BY revision DESC LIMIT 1',
    [transferred.id]
  );
  const outboxColumns = Object.keys(outbox).filter((column) => column !== 'id');
  for (let i = 1; i <= 130; i++)
    await source.query(
      `INSERT INTO editorial_outbox (${outboxColumns.join(
        ','
      )}) VALUES (${outboxColumns.map(() => '?').join(',')})`,
      outboxColumns.map((column) =>
        column === 'revision'
          ? Number(outbox.revision) + i
          : column === 'actorIdentityId'
          ? owner.identityId
          : outbox[column]
      )
    );
  await source.query(
    "UPDATE editorial_resource_states SET revision=? WHERE resourceKind='app' AND resourceId=?",
    [Number(outbox.revision) + 130, transferred.id]
  );
  const validate = async () => {
    const runner = source.createQueryRunner();
    try {
      for (const migration of source.migrations)
        if (
          /^(ApplicationOwnership|ApplicationPublication|SuitePublication|ArticleWorkspace|ReleaseWorkspace|EditorialAuditErasure)/.test(
            migration.constructor.name
          )
        )
          await migration.up(runner);
    } finally {
      await runner.release();
    }
  };
  await validate();
  pass(
    'real reviewed/approved/rejected peer content in all four families, ownership approvals/rejection/later revocation and successor grant, deleted peer history and pending DNS lease are prepared before the barrier'
  );

  return async function erase(input) {
    const noImages = {
      read: async () =>
        assert.fail('Peer audit fixtures contain no uploaded media'),
    };
    const capturePeer = async () => {
      const entries = [];
      for await (const row of new MysqlEditorialAccountExportSource(source, {
        applications: noImages,
        articles: noImages,
      }).capture(peer.identityId, new AbortController().signal))
        if (row.type === 'record') entries.push(row);
      return entries;
    };
    const exportBefore = await capturePeer();
    await assert.rejects(
      worker().advance({ ...input, revision: input.revision + 1 }),
      /exact erasure request/
    );
    const tables = [
      'app_records',
      'editorial_resource_states',
      'suite_publications',
      'article_publications',
      'release_publications',
      'editorial_erasure_resources',
    ];
    const snapshots = {};
    for (const table of tables)
      snapshots[table] = await source.query(`SELECT * FROM ${table}`);
    const historyBefore = await source.query(
      'SELECT * FROM application_ownership_history ORDER BY applicationId'
    );
    const decisionsBefore = await source.query(
      'SELECT * FROM application_ownership_decisions WHERE actorIdentityId=? ORDER BY claimId,revision',
      [owner.identityId]
    );
    const reviewBefore = {};
    for (const family of editorialWorkspaceFamilies)
      reviewBefore[family.kind] = await source.query(
        `SELECT * FROM ${family.submissions} WHERE reviewerIdentityId=? ORDER BY ${family.parent},submittedRevision`,
        [owner.identityId]
      );
    const outboxBefore = await source.query(
      'SELECT * FROM editorial_outbox ORDER BY id'
    );
    const peersBefore = await source.query(
      'SELECT * FROM application_ownership_grants WHERE claimantIdentityId<>? ORDER BY applicationId',
      [owner.identityId]
    );
    const ownClaims = await source.query(
      'SELECT * FROM application_ownership_claims WHERE claimantIdentityId=? ORDER BY id',
      [owner.identityId]
    );
    assert.ok(ownClaims.some((row) => row.status === 'revoked'));
    const ownedRevoked = ownClaims.find(
      (row) => row.id !== formerGrant.id && row.status === 'revoked'
    );
    assert.ok(ownedRevoked, 'canonical erasure terminated a real active owner');

    await source.query(
      "CREATE TRIGGER qualification_audit_delete_failure BEFORE DELETE ON application_ownership_claims FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected audit erasure failure'"
    );
    let failed = false;
    try {
      for (let i = 0; i < 10; i++) {
        try {
          await worker().advance(input);
        } catch (error) {
          assert.match(error.message, /Injected audit erasure failure/);
          failed = true;
          break;
        }
      }
    } finally {
      await source.query('DROP TRIGGER qualification_audit_delete_failure');
    }
    assert.ok(failed);
    assert.deepEqual(
      await source.query(
        'SELECT * FROM application_ownership_claims WHERE claimantIdentityId=? ORDER BY id',
        [owner.identityId]
      ),
      ownClaims
    );

    const [guard] = await source.query(
      'SELECT * FROM application_ownership_history WHERE applicationId=?',
      [ownClaims.find((row) => row.status === 'revoked').applicationId]
    );
    await source.query(
      'DELETE FROM application_ownership_history WHERE applicationId=?',
      [guard.applicationId]
    );
    try {
      let rejected = false;
      for (let i = 0; i < 12; i++) {
        try {
          await worker().advance(input);
        } catch (error) {
          assert.match(error.message, /permanent erased ownership authority/);
          rejected = true;
          break;
        }
      }
      assert.ok(rejected);
    } finally {
      await source.query(
        'INSERT INTO application_ownership_history (applicationId,tenantId,establishedAt) VALUES (?,?,?)',
        [guard.applicationId, guard.tenantId, guard.establishedAt]
      );
    }
    const count = async (table, column) =>
      Number(
        (
          await source.query(
            `SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`,
            [owner.identityId]
          )
        )[0].n
      );
    let calls = 0,
      crossedReceipts = false,
      crossedOutbox = false,
      concurrent = false;
    for (;;) {
      assert.ok(++calls < 70, 'bounded audit cleanup must converge');
      const receipts = await count(
        'application_ownership_commands',
        'actorIdentityId'
      );
      const events = await count('editorial_outbox', 'actorIdentityId');
      const result = await worker().advance(input);
      const receiptDelta =
        receipts -
        (await count('application_ownership_commands', 'actorIdentityId'));
      const eventDelta =
        events - (await count('editorial_outbox', 'actorIdentityId'));
      assert.ok(receiptDelta >= 0 && receiptDelta <= 128);
      assert.ok(eventDelta >= 0 && eventDelta <= 128);
      crossedReceipts ||= receiptDelta === 128;
      crossedOutbox ||= eventDelta === 128;
      if (calls === 3) {
        await restart();
        await validate();
      }
      if (crossedReceipts && crossedOutbox && !concurrent) {
        assert.ok(await count('editorial_outbox', 'actorIdentityId'));
        await Promise.all([worker().advance(input), worker().advance(input)]);
        concurrent = true;
      }
      if (result === 'drained') break;
    }
    assert.ok(crossedReceipts && crossedOutbox && concurrent);
    assert.deepEqual(
      await Promise.all([worker().advance(input), worker().advance(input)]),
      ['drained', 'drained']
    );
    for (const table of tables)
      assert.deepEqual(
        await source.query(`SELECT * FROM ${table}`),
        snapshots[table],
        table
      );
    assert.deepEqual(
      await source.query(
        'SELECT * FROM application_ownership_history ORDER BY applicationId'
      ),
      historyBefore
    );
    assert.deepEqual(
      await source.query(
        'SELECT * FROM application_ownership_grants WHERE claimantIdentityId<>? ORDER BY applicationId',
        [owner.identityId]
      ),
      peersBefore
    );
    for (const decision of decisionsBefore) {
      const [after] = await source.query(
        'SELECT * FROM application_ownership_decisions WHERE claimId=? AND revision=?',
        [decision.claimId, decision.revision]
      );
      assert.equal(after.actorIdentityId, null);
      assert.ok(Number(after.actorErasedAt) >= Number(decision.createdAt));
      assert.deepEqual(
        {
          ...after,
          actorIdentityId: decision.actorIdentityId,
          actorErasedAt: decision.actorErasedAt,
        },
        decision
      );
    }
    for (const family of editorialWorkspaceFamilies)
      for (const before of reviewBefore[family.kind]) {
        const [after] = await source.query(
          `SELECT * FROM ${family.submissions} WHERE ${family.parent}=? AND submittedRevision=?`,
          [before[family.parent], before.submittedRevision]
        );
        assert.equal(after.reviewerIdentityId, null);
        assert.ok(Number(after.reviewerErasedAt) >= Number(before.reviewedAt));
        assert.deepEqual(
          {
            ...after,
            reviewerIdentityId: before.reviewerIdentityId,
            reviewerErasedAt: before.reviewerErasedAt,
          },
          before
        );
      }
    const outboxAfter = await source.query(
      'SELECT * FROM editorial_outbox ORDER BY id'
    );
    assert.deepEqual(
      outboxAfter,
      outboxBefore.map((row) => ({
        ...row,
        actorIdentityId:
          row.actorIdentityId === owner.identityId ? null : row.actorIdentityId,
      }))
    );
    for (const [table, column] of [
      ['application_ownership_claims', 'claimantIdentityId'],
      ['application_ownership_grants', 'claimantIdentityId'],
      ['application_ownership_workspaces', 'claimantIdentityId'],
      ['application_ownership_commands', 'actorIdentityId'],
      ['application_ownership_checks', 'actorIdentityId'],
      ['editorial_commands', 'actorIdentityId'],
    ])
      assert.equal(await count(table, column), 0);
    await assert.rejects(
      store.finishCheck(pendingCommand, lease, true, Date.now()),
      /Ownership claim not found/
    );
    assert.equal(
      (
        await source.query(
          'SELECT id FROM application_ownership_claims WHERE id=?',
          [pending.id]
        )
      ).length,
      0
    );
    assert.equal(
      (
        await source.query(
          'SELECT commandKey FROM application_ownership_commands WHERE commandKey=?',
          [pendingCommand.key]
        )
      ).length,
      0
    );
    await source.query(
      'UPDATE identity_erasure_requests SET completedAt=requestedAt WHERE identityId=?',
      [owner.identityId]
    );
    await assert.rejects(worker().advance(input), /pending erasure request/);
    await source.query(
      'UPDATE identity_erasure_requests SET completedAt=NULL WHERE identityId=?',
      [owner.identityId]
    );
    await validate();
    assert.deepEqual(
      await capturePeer(),
      exportBefore,
      'peer export retains exact content and review decisions without staff identifiers'
    );
    pass(
      'audit erasure preserves peer decisions/reasons/times and exact canonical/outbox intent, anonymizes attribution, drains >128 receipts/events, survives rollback/restart, and rejects missing permanent authority or stale/completed requests'
    );

    const runner = source.createQueryRunner();
    await runner.startTransaction();
    try {
      const manager = runner.manager;
      // Model a later canonical transfer without a grant; the permanent history must still deny old unbound editing.
      await manager.query(
        "UPDATE editorial_resource_states SET ownerIdentityId=? WHERE resourceKind='app' AND resourceId=?",
        [successor.identityId, ownedRevoked.applicationId]
      );
      assert.equal(
        await hasApplicationAuthoringAuthority(
          manager,
          ownedRevoked.applicationId,
          {
            tenantId: successor.tenantId,
            ownerIdentityId: successor.identityId,
          },
          {
            tenantId: successor.tenantId,
            ownerIdentityId: successor.identityId,
          }
        ),
        false
      );
      const [state] = await manager.query(
        "SELECT * FROM editorial_resource_states WHERE resourceKind='app' AND resourceId=? FOR UPDATE",
        [transferred.id]
      );
      assert.equal(
        await hasApplicationAuthoringAuthority(
          manager,
          transferred.id,
          state,
          {
            tenantId: successor.tenantId,
            ownerIdentityId: successor.identityId,
          },
          successorGrant.id
        ),
        true
      );
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
    const reclaimed = await claim(successor, ownedRevoked.applicationId, staff);
    assert.ok(
      reclaimed.applicationRevision > 0,
      'fresh proof plus independent approval still permits ownership'
    );
    for (const value of reviews.filter((row) =>
      ['article', 'release'].includes(row.kind)
    )) {
      let state = await json(
        200,
        'GET',
        `me/${value.route}/${value.id}/publication`,
        undefined,
        peer
      );
      if (state.publicationRevision !== null) {
        await json(
          201,
          'POST',
          `me/${value.route}/${value.id}/withdraw`,
          {
            expectedRevision: state.revision,
            expectedPublicationRevision: state.publicationRevision,
          },
          peer
        );
        state = await json(
          200,
          'GET',
          `me/${value.route}/${value.id}/publication`,
          undefined,
          peer
        );
      }
      await json(
        200,
        'DELETE',
        `me/${value.route}/${value.id}`,
        { expectedRevision: state.revision },
        peer
      );
    }
    await validate();
    await restart();
    assert.equal(await worker().advance(input), 'drained');
    pass(
      'successor grant/editing survives former-owner cleanup, unbound authoring remains denied, new domain proof plus staff approval can reclaim ownership, and peer deletion removes anonymous review metadata normally'
    );
  };
};
