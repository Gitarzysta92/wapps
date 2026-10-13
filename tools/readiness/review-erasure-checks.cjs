const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const root =
  '../../sdk/features/discussion/applications/management/service/src/app/reviews/';
const {
  ApplicationReviews,
} = require(`${root}application/application-reviews`);
const { MysqlReviews } = require(`${root}infrastructure/mysql-reviews`);
const {
  MysqlReviewErasure,
} = require(`${root}infrastructure/mysql-review-erasure`);
const {
  ReviewErasure1791840008000,
} = require(`${root}infrastructure/review-erasure.migration`);
const {
  MemberReviews1791676827000,
} = require(`${root}infrastructure/member-reviews.migration`);
const {
  MysqlAccountErasureParticipant,
} = require('../../sdk/features/identity/packages/infrastructure/mysql/src');

module.exports = async function reviewErasureChecks({ source }) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const repository = new MysqlReviews(source);
  const service = (
    tenant = 'default',
    targets = { visible: async () => true }
  ) =>
    new ApplicationReviews(
      repository,
      targets,
      { evaluate: async () => ({ ok: true, value: true }) },
      {
        next: randomUUID,
        fingerprint: (value) =>
          createHash('sha256').update(value).digest('hex'),
      },
      tenant,
      () => 10000
    );
  const reviews = service();
  const cleanup = new MysqlReviewErasure(source, () => 20000);
  const participant = new MysqlAccountErasureParticipant('discussion', source);
  const actor = (identityId, roles = []) => ({
    identityId,
    tenantId: 'default',
    roles,
  });
  const owner = actor('ReviewErasureAuthor'),
    peer = actor('ReviewErasurePeer'),
    admin = actor('ReviewErasureAdmin', ['admin']);
  const row = async (id) =>
    (await source.query('SELECT * FROM member_reviews WHERE id=?', [id]))[0];
  const content = {
    displayName: 'Identifying author',
    rating: 4,
    text: 'Retained public review',
  };
  const publish = async (user, app, body = content) => {
    const [current] = await source.query(
      'SELECT revision FROM member_reviews WHERE tenantId=? AND applicationId=? AND ownerId=?',
      [user.tenantId, app, user.identityId]
    );
    return service(user.tenantId).change(
      app,
      null,
      'publish',
      { expectedRevision: Number(current?.revision ?? 0), content: body },
      user,
      randomUUID()
    );
  };
  const change = async (user, app, id, type, body) =>
    service(user.tenantId).change(
      app,
      id,
      type,
      { expectedRevision: Number((await row(id)).revision), ...body },
      user,
      randomUUID()
    );
  const drain = async (request, limit = 80) => {
    for (let step = 0; step < limit; step++)
      if ((await new MysqlReviewErasure(source).advance(request)) === 'drained')
        return;
    throw new Error(
      'Review cleanup did not drain within its qualification bound'
    );
  };

  const app = randomUUID(),
    hiddenApp = randomUUID(),
    withdrawnApp = randomUUID(),
    peerApp = randomUUID();
  const publicReview = await publish(owner, app);
  for (let index = 0; index < 129; index++)
    await publish(owner, app, {
      ...content,
      text: `Earlier revision ${index}`,
    });
  await publish(owner, app);
  await change(peer, app, publicReview.id, 'helpful', { helpful: true });
  await change(peer, app, publicReview.id, 'report', {
    reason: 'Historical report',
  });
  const hidden = await publish(owner, hiddenApp, {
    ...content,
    text: 'Private hidden text',
  });
  await change(admin, hiddenApp, hidden.id, 'moderate', {
    hidden: true,
    reason: 'Private moderation',
  });
  const withdrawn = await publish(owner, withdrawnApp, {
    ...content,
    text: 'Private withdrawn text',
  });
  await change(owner, withdrawnApp, withdrawn.id, 'withdraw', {});
  const foreign = await publish(
    { ...owner, tenantId: 'other-tenant' },
    randomUUID(),
    { ...content, text: 'Another tenant retained text' }
  );
  const peerReview = await publish(peer, peerApp, {
    ...content,
    displayName: 'Peer',
    rating: 2,
  });
  await change(owner, peerApp, peerReview.id, 'helpful', { helpful: true });
  await change(owner, peerApp, peerReview.id, 'report', {
    reason: 'Erased reporter reason',
  });
  const peerBefore = await row(peerReview.id);
  const request = { identityId: owner.identityId, revision: 9 };
  await assert.rejects(
    cleanup.advance(request),
    /Missing Discussion erasure request/
  );
  await participant.request(request);
  await assert.rejects(
    change(admin, hiddenApp, hidden.id, 'moderate', {
      hidden: false,
      reason: 'Cannot restore pending erasure',
    }),
    /erasure prevents/
  );
  const before = await source.query(
    'SELECT * FROM member_reviews WHERE ownerId=? ORDER BY id',
    [owner.identityId]
  );
  const versionsBefore = Number(
    (await source.query('SELECT COUNT(*) n FROM review_versions'))[0].n
  );
  await source.query(
    'UPDATE member_reviews SET updatedAt=createdAt-1 WHERE id=?',
    [before[0].id]
  );
  try {
    await assert.rejects(
      cleanup.advance(request),
      /Invalid review erasure chronology/
    );
  } finally {
    await source.query('UPDATE member_reviews SET updatedAt=? WHERE id=?', [
      before[0].updatedAt,
      before[0].id,
    ]);
  }
  const failing = new MysqlReviewErasure({
    transaction: (isolation, work) =>
      source.transaction(isolation, (tx) =>
        work({
          queryRunner: tx.queryRunner,
          query: (sql, values) => {
            if (sql.startsWith('INSERT INTO review_erasure_targets'))
              throw new Error('Cleanup journal unavailable');
            return tx.query(sql, values);
          },
        })
      ),
  });
  await assert.rejects(failing.advance(request), /journal unavailable/);
  assert.deepEqual(
    await source.query(
      'SELECT * FROM member_reviews WHERE ownerId=? ORDER BY id',
      [owner.identityId]
    ),
    before
  );
  assert.equal(
    Number((await source.query('SELECT COUNT(*) n FROM review_versions'))[0].n),
    versionsBefore
  );
  for (let step = 0; step < 4; step++)
    assert.equal(await cleanup.advance(request), 'pending');
  const anonymous = await reviews.read(app, publicReview.id, null);
  assert.equal(anonymous.mine, false);
  assert.deepEqual(anonymous.content, {
    ...content,
    displayName: 'Deleted account',
  });
  assert.equal(anonymous.helpfulCount, 1);
  assert.equal((await reviews.summary(app, null)).average, 4);
  assert.equal((await reviews.page(app, null, null)).mine, null);
  assert.equal(
    (await reviews.reports(app, publicReview.id, admin, null)).items.length,
    0
  );
  assert.equal(
    (await reviews.read(app, publicReview.id, admin)).openReports,
    0
  );
  assert.ok(
    Number(
      (
        await source.query(
          'SELECT COUNT(*) n FROM review_versions WHERE reviewId=?',
          [publicReview.id]
        )
      )[0].n
    ) > 128
  );
  for (const [appId, id] of [
    [hiddenApp, hidden.id],
    [withdrawnApp, withdrawn.id],
  ]) {
    assert.equal((await row(id)).contentRevision, null);
    assert.ok((await row(id)).erasedAt);
    await assert.rejects(reviews.read(appId, id, admin), /not found/);
    await assert.rejects(
      change(admin, appId, id, 'moderate', {
        hidden: false,
        reason: 'Cannot restore erased content',
      }),
      /not found/
    );
    assert.equal(
      (await reviews.page(appId, admin, null, true)).items.length,
      0
    );
  }
  const newer = actor('NewAnonymousReviewer');
  await change(newer, app, publicReview.id, 'report', {
    reason: 'New report about anonymous content',
  });
  await change(admin, app, publicReview.id, 'moderate', {
    hidden: false,
    reason: 'Independent later decision',
  });
  assert.equal((await row(publicReview.id)).ownerId, null);
  const retainedRevision = Number((await row(publicReview.id)).contentRevision);
  let previous = Number(
    (
      await source.query(
        'SELECT COUNT(*) n FROM review_versions WHERE reviewId=? AND revision<?',
        [publicReview.id, retainedRevision]
      )
    )[0].n
  );
  let sawBoundedHistory = false;
  for (let step = 0; step < 80; step++) {
    const result = await cleanup.advance(request);
    const next = Number(
      (
        await source.query(
          'SELECT COUNT(*) n FROM review_versions WHERE reviewId=? AND revision<?',
          [publicReview.id, retainedRevision]
        )
      )[0].n
    );
    assert.ok(previous - next <= 128);
    if (previous - next === 128) sawBoundedHistory = true;
    previous = next;
    if (result === 'drained') break;
    assert.ok(step < 79);
  }
  assert.ok(sawBoundedHistory);
  assert.equal(await cleanup.advance(request), 'drained');
  assert.equal(
    (
      await source.query('SELECT * FROM review_versions WHERE reviewId=?', [
        publicReview.id,
      ])
    ).length,
    1
  );
  assert.equal(
    (
      await source.query(
        'SELECT * FROM review_versions WHERE reviewId IN (?,?)',
        [hidden.id, withdrawn.id]
      )
    ).length,
    0
  );
  assert.equal((await row(foreign.id)).ownerId, null);
  const reports = await reviews.reports(app, publicReview.id, admin, null);
  assert.equal(reports.items.length, 1);
  assert.equal(reports.items[0].reason, 'New report about anonymous content');
  assert.equal(reports.items[0].content.displayName, 'Deleted account');
  const peerAfter = await reviews.read(peerApp, peerReview.id, peer);
  assert.equal(peerAfter.helpfulCount, 0);
  assert.equal(
    (await reviews.read(peerApp, peerReview.id, admin)).openReports,
    0
  );
  assert.equal(peerAfter.revision, Number(peerBefore.revision) + 1);
  for (const table of [
    'review_helpful',
    'review_reports',
    'review_commands',
    'review_events',
  ])
    assert.equal(
      (
        await source.query(`SELECT 1 FROM ${table} WHERE actorId=? LIMIT 1`, [
          owner.identityId,
        ])
      ).length,
      0
    );
  assert.equal((await participant.request(request)).state, 'pending');
  await assert.rejects(publish(owner, app), /erasure prevents/);
  console.log(
    'PASS: canonical review erasure is atomic; public IDs/text/rating/helpful marks survive anonymously; historical reports hide immediately; private tombstones cannot be restored; 131 old versions drain in 128-row batches while newer reports and moderation survive'
  );

  const staff = actor('ErasedReviewModerator', ['admin']),
    second = actor('RetainedReviewModerator', ['admin']);
  const provenanceApp = randomUUID();
  const provenance = await publish(peer, provenanceApp);
  await change(actor('FirstReporter'), provenanceApp, provenance.id, 'report', {
    reason: 'First report',
  });
  await change(staff, provenanceApp, provenance.id, 'moderate', {
    hidden: false,
    reason: 'Same timestamp and reason',
  });
  const firstResolution = Number((await row(provenance.id)).revision);
  await publish(peer, provenanceApp, {
    ...content,
    text: 'New version to report',
  });
  await change(
    actor('SecondReporter'),
    provenanceApp,
    provenance.id,
    'report',
    { reason: 'Second report' }
  );
  await change(second, provenanceApp, provenance.id, 'moderate', {
    hidden: false,
    reason: 'Same timestamp and reason',
  });
  const secondResolution = Number((await row(provenance.id)).revision);
  const runner = source.createQueryRunner();
  await runner.connect();
  const migration = new ReviewErasure1791840008000();
  try {
    const [history] = await source.query(
      'SELECT * FROM migrations WHERE name=?',
      [migration.constructor.name]
    );
    await source.query(
      'ALTER TABLE review_reports DROP CHECK ck_review_resolution_revision'
    );
    await source.query(
      'UPDATE review_reports SET resolutionRevision=NULL WHERE reviewId=?',
      [provenance.id]
    );
    await source.query('DELETE FROM migrations WHERE name=?', [
      migration.constructor.name,
    ]);
    try {
      await migration.up(runner);
    } finally {
      await source.query(
        'INSERT INTO migrations (id,timestamp,name) VALUES (?,?,?)',
        [history.id, history.timestamp, history.name]
      );
    }
    const resolved = await source.query(
      'SELECT reason,resolutionRevision FROM review_reports WHERE reviewId=? ORDER BY resolutionRevision',
      [provenance.id]
    );
    assert.deepEqual(
      resolved.map((item) => Number(item.resolutionRevision)),
      [firstResolution, secondResolution]
    );
    await new MemberReviews1791676827000().up(runner);
    await migration.up(runner);
    await source.query(
      'RENAME TABLE review_erasure_targets TO saved_review_erasure_targets'
    );
    try {
      await assert.rejects(
        migration.up(runner),
        /Applied.*targets are missing/
      );
    } finally {
      await source.query(
        'RENAME TABLE saved_review_erasure_targets TO review_erasure_targets'
      );
    }
    await assert.rejects(migration.down(), /data-preserving rollback/);
  } finally {
    await runner.release();
  }
  const staffRequest = { identityId: staff.identityId, revision: 4 };
  await participant.request(staffRequest);
  await drain(staffRequest);
  const resolved = await source.query(
    'SELECT resolutionRevision,resolutionReason FROM review_reports WHERE reviewId=? ORDER BY resolutionRevision',
    [provenance.id]
  );
  assert.equal(resolved[0].resolutionReason, null);
  assert.equal(resolved[1].resolutionReason, 'Same timestamp and reason');
  assert.equal(
    (await row(provenance.id)).moderationReason,
    'Same timestamp and reason'
  );
  console.log(
    'PASS: legacy resolution provenance follows event revision order despite identical timestamps/reasons; erased moderator history clears without removing later staff reasons or decisions; new and old migration re-entry validate surviving authority'
  );

  const latestStaff = actor('ErasedLatestModerator', ['admin']),
    latestApp = randomUUID();
  const latest = await publish(peer, latestApp);
  await change(latestStaff, latestApp, latest.id, 'moderate', {
    hidden: true,
    reason: 'Private latest moderator reason',
  });
  const latestRequest = { identityId: latestStaff.identityId, revision: 2 };
  await participant.request(latestRequest);
  await cleanup.advance(latestRequest);
  const failedAudit = new MysqlReviewErasure({
    transaction: (isolation, work) =>
      source.transaction(isolation, (tx) =>
        work({
          queryRunner: tx.queryRunner,
          query: (sql, values) => {
            if (sql.startsWith('DELETE FROM review_events'))
              throw new Error('Audit cleanup interrupted');
            return tx.query(sql, values);
          },
        })
      ),
  });
  const beforeAudit = await row(latest.id);
  await assert.rejects(
    failedAudit.advance(latestRequest),
    /Audit cleanup interrupted/
  );
  assert.deepEqual(await row(latest.id), beforeAudit);
  await drain(latestRequest);
  assert.equal((await row(latest.id)).hidden, 1);
  assert.equal((await row(latest.id)).moderationReason, null);

  const racing = actor('InFlightReviewErasure'),
    racingApp = randomUUID();
  const race = await publish(racing, racingApp);
  const raceRequest = { identityId: racing.identityId, revision: 1 };
  await participant.request(raceRequest);
  let checks = 0;
  const raceReader = service('default', {
    visible: async () => {
      if (++checks === 2) await cleanup.advance(raceRequest);
      return true;
    },
  });
  await assert.rejects(
    raceReader.read(racingApp, race.id, null),
    /changed while loading/
  );
  assert.equal(
    (await reviews.read(racingApp, race.id, null)).content.displayName,
    'Deleted account'
  );
  await Promise.all([
    cleanup.advance(raceRequest),
    new MysqlReviewErasure(source).advance(raceRequest),
  ]);
  await drain(raceRequest);
  console.log(
    'PASS: latest moderator reason removal rolls back on audit failure and retains hidden state after retry; in-flight public reads reject pre-erasure snapshots; duplicate cleanup instances converge'
  );
};
