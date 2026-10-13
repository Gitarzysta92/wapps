const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function discussionPinsChecks(options) {
  const {
    application,
    discussion,
    accepted,
    waitThread,
    discussionSource: source,
    pass,
  } = options;
  const base = `application-discussions/${application.id}`;
  const member = { identityId: 'PinAuthor', tenantId: 'default', roles: [] };
  const admin = { ...member, identityId: 'PinModerator', roles: ['admin'] };
  const otherAdmin = { ...admin, identityId: 'OtherPinModerator' };
  const topics = [];
  const revisions = new Map();
  for (let i = 0; i < 13; i++) {
    const topic = accepted(
      await discussion(
        'POST',
        base,
        {
          title: `Pin ordering topic ${i}`,
          displayName: 'Public author',
          text: 'A durable conversation for pin ordering.',
          tags: [],
        },
        member
      ),
      201
    );
    topics.push(topic.id);
    revisions.set(topic.id, topic.revision);
    await waitThread(application.id, topic.id, topic.revision);
  }
  const id = topics[0];
  const pin = (
    target,
    pinned,
    user = admin,
    revision = revisions.get(target),
    key = randomUUID()
  ) =>
    discussion(
      'PUT',
      `${base}/${target}/pin`,
      { pinned, expectedRevision: revision },
      user,
      key
    );
  const read = (target = id, user = null) =>
    waitThread(application.id, target, revisions.get(target), user);
  async function change(target, pinned) {
    const receipt = accepted(await pin(target, pinned));
    revisions.set(target, receipt.revision);
    return read(target);
  }
  const payloadBefore = await source.query(
    'SELECT * FROM discussion_write_nodes WHERE nodeId = ?',
    [id]
  );
  const contentBefore = await source.query(
    'SELECT * FROM content_nodes WHERE id = ?',
    [id]
  );
  await options.stopWorker();
  const copies = await Promise.all(
    Array.from({ length: 4 }, () => pin(id, true, admin, 1, 'first-pin'))
  );
  const first = accepted(copies[0]);
  copies.forEach((result) => assert.deepEqual(accepted(result), first));
  revisions.set(id, first.revision);
  assert.equal(first.revision, 2);
  assert.deepEqual(
    await source.query(
      'SELECT * FROM discussion_write_nodes WHERE nodeId = ?',
      [id]
    ),
    payloadBefore
  );
  assert.deepEqual(
    await source.query('SELECT * FROM content_nodes WHERE id = ?', [id]),
    contentBefore
  );
  assert.equal(
    (await discussion('GET', `${base}/${id}`, undefined, null)).status,
    503
  );
  assert.equal((await pin(id, false, admin, 1, 'first-pin')).status, 409);
  assert.equal((await pin(id, true, null)).status, 401);
  assert.equal((await pin(id, true, member)).status, 403);
  assert.equal(
    (await pin(id, true, { ...admin, tenantId: 'other' })).status,
    404
  );
  for (const body of [
    { pinned: 1, expectedRevision: 2 },
    { pinned: true, expectedRevision: 2, actorIdentityId: admin.identityId },
    { pinned: true, expectedRevision: 2, tenantId: 'other' },
  ])
    assert.equal(
      (await discussion('PUT', `${base}/${id}/pin`, body, admin)).status,
      400
    );
  assert.equal(
    (
      await discussion(
        'PUT',
        `application-discussions/${randomUUID()}/${id}/pin`,
        { pinned: true, expectedRevision: 2 },
        admin
      )
    ).status,
    404
  );
  options.startWorker();
  assert.equal((await read()).pinned, true);
  assert.equal((await read(id, member)).canPin, false);
  assert.equal((await read(id, admin)).canPin, true);
  pass(
    'Discussion pinning: exact concurrent replay advances one revision/outbox without payload/timestamp changes; member, anonymous, foreign tenant and forged scope are denied; stale projections remain unavailable'
  );

  const last = topics.at(-1);
  const reply = accepted(
    await discussion(
      'POST',
      `${base}/${last}/replies`,
      {
        displayName: 'Public author',
        text: 'Replies cannot be pinned as topics.',
      },
      member
    ),
    201
  );
  revisions.set(last, reply.revision);
  assert.equal((await pin(reply.id, true, admin, reply.revision)).status, 403);
  const race = await Promise.all([
    pin(id, true, admin),
    pin(id, false, otherAdmin),
  ]);
  assert.deepEqual(race.map((result) => result.status).sort(), [200, 409]);
  revisions.set(
    id,
    accepted(race.find((result) => result.status === 200)).revision
  );
  await change(id, false);
  assert.deepEqual(accepted(await pin(id, true, admin, 1, 'first-pin')), first);
  assert.equal((await read()).pinned, false);
  await source.query(
    "CREATE TRIGGER reject_pin_outbox BEFORE INSERT ON discussion_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'pin outbox rollback'"
  );
  const priorRevision = revisions.get(id);
  try {
    assert.equal(
      (await pin(id, true, admin, priorRevision, 'rollback-pin')).status,
      503
    );
  } finally {
    await source.query('DROP TRIGGER reject_pin_outbox');
  }
  assert.equal((await read()).pinned, false);
  assert.equal(
    (
      await source.query(
        'SELECT * FROM discussion_commands WHERE commandKey = ?',
        ['rollback-pin']
      )
    ).length,
    0
  );
  revisions.set(
    id,
    accepted(await pin(id, true, admin, priorRevision, 'rollback-pin')).revision
  );
  await read();
  pass(
    'Discussion pinning: competing moderators conflict, replies cannot be pinned, historical receipts never repin removed choices, and failed outbox insertion rolls back state/revision/receipt before exact retry'
  );

  for (const target of topics.slice(1, 12)) await change(target, true);
  await read(last);
  const page = accepted(await discussion('GET', base, undefined, null));
  assert.equal(page.items.length, 10);
  assert.equal(
    page.items.every((topic) => topic.pinned),
    true
  );
  assert.match(page.next, /^1\./);
  const next = accepted(
    await discussion(
      'GET',
      `${base}?cursor=${encodeURIComponent(page.next)}`,
      undefined,
      null
    )
  );
  assert.equal(next.items.length, 3);
  assert.deepEqual(
    next.items.map((topic) => topic.pinned),
    [true, true, false]
  );
  assert.equal(next.next, null);
  const ordered = [...page.items, ...next.items].map((topic) => topic.id);
  assert.equal(new Set(ordered).size, 13);
  const expected = await source.query(
    'SELECT id FROM discussion_write_aggregates WHERE subjectId = ? ORDER BY pinned DESC, createdAt DESC, id',
    [application.id]
  );
  assert.deepEqual(
    ordered,
    expected.map((topic) => topic.id)
  );
  assert.equal(
    (await discussion('GET', `${base}?cursor=2.1.${id}`, undefined, null))
      .status,
    400
  );
  assert.equal(
    (await discussion('GET', `${base}?cursor=1.${id}`, undefined, null)).status,
    400
  );
  await options.restart();
  assert.equal((await read()).pinned, true);
  await options.stopWorker();
  await options.discussionDatabase
    .collection('discussion_generation_nodes')
    .deleteMany({ discussionId: id });
  await options.discussionDatabase
    .collection('discussion_generation_heads')
    .deleteOne({ _id: id });
  assert.equal(
    (await discussion('GET', `${base}/${id}`, undefined, null)).status,
    503
  );
  options.rebuild();
  options.startWorker();
  assert.equal((await read()).pinned, true);
  pass(
    'Discussion pinning: bounded pages cross pinned/unpinned groups with stable canonical ordering and no duplicates; pin state survives API restart and projection loss/rebuild'
  );

  await options.withdraw();
  assert.equal((await pin(id, false)).status, 404);
  assert.equal((await discussion('GET', base, undefined, null)).status, 404);
  await options.republish();
  assert.equal((await read()).pinned, true);
  const {
    DiscussionPins1791676826000,
  } = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/discussion-pins.migration');
  const migration = new DiscussionPins1791676826000(),
    runner = source.createQueryRunner();
  const snapshot = () =>
    source.query(
      'SELECT id, pinned, revision FROM discussion_write_aggregates ORDER BY id'
    );
  const before = await snapshot();
  try {
    await migration.up(runner);
    await source.query(
      'ALTER TABLE discussion_write_aggregates DROP CHECK ck_discussion_pinned'
    );
    try {
      await assert.rejects(migration.up(runner), /constraint is missing/);
    } finally {
      await source.query(
        'ALTER TABLE discussion_write_aggregates ADD CONSTRAINT ck_discussion_pinned CHECK (pinned IN (0, 1))'
      );
    }
    await source.query(
      'ALTER TABLE discussion_write_aggregates DROP INDEX idx_discussion_pinned_target, ADD INDEX idx_discussion_pinned_target (tenantId, subjectKind, subjectId, pinned, createdAt DESC, id)'
    );
    try {
      await assert.rejects(migration.up(runner), /pin index/);
    } finally {
      await source.query(
        'ALTER TABLE discussion_write_aggregates DROP INDEX idx_discussion_pinned_target, ADD INDEX idx_discussion_pinned_target (tenantId, subjectKind, subjectId, pinned DESC, createdAt DESC, id)'
      );
    }
    await assert.rejects(migration.down(runner), /data-preserving/);
  } finally {
    await runner.release();
  }
  await source.query('DELETE FROM migrations WHERE name = ?', [
    'DiscussionPins1791676826000',
  ]);
  await assert.rejects(options.restart(), /migrat|start|exit/i);
  options.migrate();
  await options.restart();
  assert.deepEqual(await snapshot(), before);
  for (const target of topics) {
    revisions.set(
      target,
      accepted(
        await discussion(
          'DELETE',
          `${base}/${target}`,
          { expectedRevision: revisions.get(target) },
          admin
        )
      ).revision
    );
  }
  assert.equal((await pin(id, true)).status, 403);
  assert.deepEqual(
    accepted(await discussion('GET', base, undefined, null)).items,
    []
  );
  pass(
    'Discussion pinning: withdrawal/deletion revoke retained pins; populated explicit migration preserves state and rejects lost history, missing constraints, wrong index direction and destructive rollback'
  );
  await require('./discussion-votes-checks.cjs').discussionVotesChecks({
    ...options,
    skipBrowser: true,
  });
  await require('./discussion-pins-browser.cjs').discussionPinsBrowser(options);
}

module.exports = { discussionPinsChecks };
