const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function discussionVotesChecks(options) {
  const {
    application,
    discussion,
    accepted,
    waitThread,
    discussionSource: source,
    pass,
  } = options;
  const base = `application-discussions/${application.id}`;
  const alice = { identityId: 'VoteAlice', tenantId: 'default', roles: [] };
  const bob = { ...alice, identityId: 'VoteBob' },
    carol = { ...alice, identityId: 'VoteCarol' };
  const topic = accepted(
    await discussion(
      'POST',
      base,
      {
        title: 'A community vote',
        displayName: 'Public Alice',
        text: 'Vote on this real conversation.',
        tags: [],
      },
      alice
    ),
    201
  );
  const reply = accepted(
    await discussion(
      'POST',
      `${base}/${topic.id}/replies`,
      {
        displayName: 'Public Alice',
        text: 'A reply also has independent votes.',
      },
      alice
    ),
    201
  );
  let revision = reply.revision;
  const vote = (
    id,
    value,
    user,
    expectedRevision = revision,
    key = randomUUID()
  ) =>
    discussion(
      'PUT',
      `${base}/${id}/vote`,
      { value, expectedRevision },
      user,
      key
    );
  const read = (user = null) =>
    waitThread(application.id, topic.id, revision, user);
  const state = (thread, id = topic.id) =>
    thread.comments.find((post) => post.id === id).votes;
  assert.deepEqual(state(await read()), { upvotes: 0, downvotes: 0, mine: 0 });
  await options.stopWorker();
  const results = await Promise.all(
    Array.from({ length: 4 }, () => vote(topic.id, 1, alice, 2, 'first-vote'))
  );
  const receipt = accepted(results[0]);
  for (const result of results) assert.deepEqual(accepted(result), receipt);
  revision = receipt.revision;
  assert.equal(revision, 3);
  assert.equal(
    (
      await source.query('SELECT * FROM discussion_votes WHERE nodeId = ?', [
        topic.id,
      ])
    ).length,
    1
  );
  assert.equal(
    (await discussion('GET', `${base}/${topic.id}`, undefined, alice)).status,
    503
  );
  assert.equal((await vote(topic.id, -1, alice, 2, 'first-vote')).status, 409);
  assert.equal((await vote(topic.id, 1, null)).status, 401);
  assert.equal(
    (await vote(topic.id, 1, { ...bob, tenantId: 'other', roles: ['admin'] }))
      .status,
    404
  );
  for (const body of [
    { value: 2, expectedRevision: revision },
    { value: 1, expectedRevision: revision, actorIdentityId: bob.identityId },
    { value: 1, expectedRevision: revision, tenantId: 'other' },
  ])
    assert.equal(
      (await discussion('PUT', `${base}/${topic.id}/vote`, body, alice)).status,
      400
    );
  assert.equal(
    (
      await discussion(
        'PUT',
        `application-discussions/${randomUUID()}/${topic.id}/vote`,
        { value: 1, expectedRevision: revision },
        alice
      )
    ).status,
    404
  );
  assert.equal(
    (
      await discussion(
        'POST',
        `discussions/comments/${topic.id}/like`,
        undefined,
        { ...alice, roles: ['admin'] }
      )
    ).status,
    404
  );
  options.startWorker();
  assert.deepEqual(state(await read(alice)), {
    upvotes: 1,
    downvotes: 0,
    mine: 1,
  });
  pass(
    'Discussion voting: exact concurrent replay commits once with one outbox revision; pending generation stays unavailable; anonymous, injected actor/tenant, cross-tenant and generic-route bypasses fail'
  );

  const racing = await Promise.all([
    vote(topic.id, -1, bob),
    vote(topic.id, 1, carol),
  ]);
  assert.deepEqual(racing.map((result) => result.status).sort(), [200, 409]);
  revision = accepted(racing.find((result) => result.status === 200)).revision;
  const loser = racing[0].status === 409 ? bob : carol;
  revision = accepted(
    await vote(topic.id, loser === bob ? -1 : 1, loser)
  ).revision;
  const lower = { ...alice, identityId: alice.identityId.toLowerCase() };
  revision = accepted(await vote(topic.id, 1, lower)).revision;
  assert.deepEqual(state(await read()), { upvotes: 3, downvotes: 1, mine: 0 });
  assert.deepEqual(state(await read(bob)), {
    upvotes: 3,
    downvotes: 1,
    mine: -1,
  });
  assert.deepEqual(state(await read(lower)), {
    upvotes: 3,
    downvotes: 1,
    mine: 1,
  });
  revision = accepted(await vote(topic.id, 0, alice)).revision;
  assert.deepEqual(
    accepted(await vote(topic.id, 1, alice, 2, 'first-vote')),
    receipt
  );
  assert.deepEqual(state(await read(alice)), {
    upvotes: 2,
    downvotes: 1,
    mine: 0,
  });
  pass(
    'Discussion voting: independent desired choices conflict on stale thread revisions, actor IDs are case-sensitive, switching/removal keep counts consistent, and old receipts never resurrect removed votes'
  );

  const snapshot = () =>
    source.query(
      'SELECT * FROM discussion_votes ORDER BY nodeId, actorIdentityId'
    );
  const before = await snapshot();
  const priorRevision = revision;
  await source.query(
    "CREATE TRIGGER reject_vote_outbox BEFORE INSERT ON discussion_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'vote outbox rollback'"
  );
  try {
    assert.equal(
      (await vote(topic.id, -1, carol, priorRevision, 'rolled-back-vote'))
        .status,
      503
    );
  } finally {
    await source.query('DROP TRIGGER reject_vote_outbox');
  }
  assert.deepEqual(await snapshot(), before);
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT revision FROM discussion_write_aggregates WHERE id = ?',
          [topic.id]
        )
      )[0].revision
    ),
    priorRevision
  );
  assert.equal(
    (
      await source.query(
        'SELECT * FROM discussion_commands WHERE commandKey = ?',
        ['rolled-back-vote']
      )
    ).length,
    0
  );
  revision = accepted(
    await vote(topic.id, -1, carol, priorRevision, 'rolled-back-vote')
  ).revision;
  revision = accepted(await vote(reply.id, 1, bob)).revision;
  let current = await read(bob);
  assert.deepEqual(state(current), { upvotes: 1, downvotes: 2, mine: -1 });
  assert.deepEqual(state(current, reply.id), {
    upvotes: 1,
    downvotes: 0,
    mine: 1,
  });
  await options.restart();
  assert.deepEqual(state(await read(bob), reply.id), state(current, reply.id));
  await options.stopWorker();
  await options.discussionDatabase
    .collection('discussion_generation_nodes')
    .deleteMany({ discussionId: topic.id });
  await options.discussionDatabase
    .collection('discussion_generation_heads')
    .deleteOne({ _id: topic.id });
  assert.equal(
    (await discussion('GET', `${base}/${topic.id}`, undefined, bob)).status,
    503
  );
  options.rebuild();
  options.startWorker();
  assert.deepEqual(state(await read(bob), reply.id), state(current, reply.id));
  pass(
    'Discussion voting: failed outbox insertion rolls back vote/revision/receipt; exact retry recovers; counts and own choice survive API restart and projection loss/rebuild without duplicate effects'
  );

  await options.withdraw();
  assert.equal(
    (await discussion('GET', `${base}/${topic.id}`, undefined, bob)).status,
    404
  );
  assert.equal((await vote(topic.id, 1, bob)).status, 404);
  await options.republish();
  await read();
  revision = accepted(
    await discussion(
      'DELETE',
      `${base}/${reply.id}`,
      { expectedRevision: revision },
      alice
    )
  ).revision;
  current = await read(bob);
  assert.equal(state(current, reply.id), null);
  assert.equal((await vote(reply.id, 0, bob)).status, 403);
  revision = accepted(
    await discussion(
      'DELETE',
      `${base}/${topic.id}`,
      { expectedRevision: revision },
      alice
    )
  ).revision;
  assert.equal(
    (await discussion('GET', `${base}/${topic.id}`, undefined, null)).status,
    404
  );
  assert.equal((await vote(topic.id, 1, alice)).status, 403);
  pass(
    'Discussion voting: current parent withdrawal revokes reads/writes, republication restores the same topic, and removed posts expose neither totals nor member choices and reject further voting'
  );

  const {
    DiscussionVotes1791676825000,
  } = require('../../apps/services/community/src/app/discussions/infrastructure/discussion-votes.migration');
  const migration = new DiscussionVotes1791676825000(),
    runner = source.createQueryRunner();
  try {
    await migration.up(runner);
    await source.query(
      'ALTER TABLE discussion_votes DROP CHECK ck_discussion_vote_value'
    );
    try {
      await assert.rejects(migration.up(runner), /value constraint/);
    } finally {
      await source.query(
        'ALTER TABLE discussion_votes ADD CONSTRAINT ck_discussion_vote_value CHECK (value IN (-1, 1))'
      );
    }
    await source.query(
      'ALTER TABLE discussion_votes DROP PRIMARY KEY, ADD PRIMARY KEY (actorIdentityId, nodeId)'
    );
    try {
      await assert.rejects(migration.up(runner), /identity key/);
    } finally {
      await source.query(
        'ALTER TABLE discussion_votes DROP PRIMARY KEY, ADD PRIMARY KEY (nodeId, actorIdentityId)'
      );
    }
    await assert.rejects(migration.down(runner), /data-preserving/);
  } finally {
    await runner.release();
  }
  const saved = await snapshot();
  await source.query('DELETE FROM migrations WHERE name = ?', [
    'DiscussionVotes1791676825000',
  ]);
  await assert.rejects(options.restart(), /migrat|start|exit/i);
  options.migrate();
  await options.restart();
  assert.deepEqual(await snapshot(), saved);
  pass(
    'Discussion voting: populated explicit migration preserves vote history, refuses missing migration startup, wrong key order, missing value constraint and destructive rollback'
  );
  if (!options.skipBrowser)
    await require('./discussion-votes-browser.cjs').discussionVotesBrowser(
      options
    );
}

module.exports = { discussionVotesChecks };
