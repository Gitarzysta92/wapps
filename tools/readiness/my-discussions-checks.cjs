const assert = require('node:assert/strict');

async function myDiscussionsChecks(options) {
  const {
    discussion,
    accepted,
    actor,
    other,
    moderator,
    applicationId,
    rootId,
    content,
    waitThread,
    restart,
    withdraw,
    republish,
    source,
    pass,
  } = options;
  const base = `application-discussions/${applicationId}`;
  const mine = async (user = actor, cursor = '') =>
    accepted(
      await discussion(
        'GET',
        'me/discussions' +
          (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
        undefined,
        user
      )
    );
  assert.equal(
    (await discussion('GET', 'me/discussions', undefined, null)).status,
    401
  );
  for (const query of [
    'identityId=CommentBob',
    'tenantId=other',
    'cursor=invalid',
  ])
    assert.equal(
      (await discussion('GET', 'me/discussions?' + query)).status,
      400
    );
  for (const user of [
    other,
    moderator,
    { ...actor, identityId: actor.identityId.toLowerCase() },
    { ...actor, tenantId: 'other' },
  ])
    assert.deepEqual(await mine(user), { items: [], next: null });
  const first = await mine();
  assert.equal(first.items.length, 10);
  const second = await mine(actor, first.next);
  assert.equal(second.items.length, 2);
  assert.equal(second.next, null);
  assert.equal(
    new Set([...first.items, ...second.items].map((item) => item.id)).size,
    12
  );
  assert.ok(
    first.items.every(
      (item) =>
        item.participation === 'author' && item.applicationId === applicationId
    )
  );
  assert.ok(!JSON.stringify(first).includes(actor.identityId));
  const response = await fetch(options.origin() + '/api/me/discussions', {
    headers: options.headers(actor),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const forged = await fetch(options.origin() + '/api/me/discussions', {
    headers: { 'x-user-id': actor.identityId },
  });
  assert.equal(forged.status, 401);
  pass(
    'My Discussions: authenticated self-only reads, tenant/case/admin isolation, no-store and distinct canonical keyset pages'
  );

  const replies = [];
  for (let index = 0; index < 2; index++) {
    const receipt = accepted(
      await discussion(
        'POST',
        `${base}/${rootId}/replies`,
        { displayName: 'Public Bob', text: `Participation reply ${index}` },
        other
      ),
      201
    );
    replies.push(receipt);
    await waitThread(applicationId, rootId, receipt.revision);
  }
  assert.equal((await mine(other)).items.length, 1);
  assert.equal((await mine(other)).items[0].participation, 'participant');
  let revision = replies[1].revision;
  for (const [index, reply] of replies.entries()) {
    const receipt = accepted(
      await discussion(
        'DELETE',
        `${base}/${reply.id}`,
        { expectedRevision: revision },
        other
      )
    );
    revision = receipt.revision;
    await waitThread(applicationId, rootId, revision);
    assert.equal((await mine(other)).items.length, index === 0 ? 1 : 0);
  }
  const own = accepted(
    await discussion(
      'POST',
      base,
      { ...content, title: 'Temporary member topic' },
      other
    ),
    201
  );
  await waitThread(applicationId, own.id, 1);
  assert.equal((await mine(other)).items[0].participation, 'author');
  await source.query(
    "UPDATE discussion_write_aggregates SET subjectKind = 'article' WHERE id = ?",
    [own.id]
  );
  assert.equal(
    (await mine(other)).items.length,
    0,
    'Article bindings never enter application participation'
  );
  await source.query(
    'UPDATE discussion_write_aggregates SET subjectKind = NULL WHERE id = ?',
    [own.id]
  );
  assert.equal(
    (await mine(other)).items.length,
    0,
    'Generic bindings never enter application participation'
  );
  await source.query(
    "UPDATE discussion_write_aggregates SET subjectKind = 'application' WHERE id = ?",
    [own.id]
  );
  accepted(
    await discussion(
      'DELETE',
      `${base}/${own.id}`,
      { expectedRevision: 1 },
      other
    )
  );
  assert.equal(
    (await mine(other)).items.length,
    0,
    'Root removal revokes membership even before projection catches up'
  );
  pass(
    'My Discussions: duplicate replies collapse; last-live-contribution deletion and root removal revoke membership; generic/article bindings stay isolated'
  );

  await options.stopWorker();
  const current = accepted(
    await discussion('GET', `${base}/${rootId}`, undefined, actor)
  );
  const edit = accepted(
    await discussion(
      'PUT',
      `${base}/${rootId}`,
      {
        content: { ...content, title: 'Updated account topic' },
        expectedRevision: current.revision,
      },
      actor
    )
  );
  assert.equal(
    (
      await discussion(
        'GET',
        'me/discussions?cursor=' + encodeURIComponent(first.next)
      )
    ).status,
    503
  );
  options.startWorker();
  await waitThread(applicationId, rootId, edit.revision);
  const beforeRestart = await mine();
  await restart();
  assert.deepEqual(await mine(), beforeRestart);
  const expectedTopics = await Promise.all(
    [...first.items, ...second.items].map(async ({ id }) =>
      accepted(await discussion('GET', `${base}/${id}`, undefined, actor))
    )
  );
  await options.stopWorker();
  await options.dropProjections();
  assert.equal((await discussion('GET', 'me/discussions')).status, 503);
  await options.rebuild();
  options.startWorker();
  // Each page requires all its generations; one rebuilt root is not a barrier.
  await Promise.all(
    expectedTopics.map((topic) =>
      waitThread(applicationId, topic.id, topic.revision)
    )
  );
  assert.deepEqual(await mine(), beforeRestart);
  pass(
    'My Discussions: stale/missing generations fail truthfully; account listings survive API restart and full projection rebuild'
  );

  await withdraw();
  const hidden = await mine();
  assert.deepEqual(hidden, { items: [], next: first.next });
  assert.deepEqual(await mine(actor, hidden.next), { items: [], next: null });
  await republish();
  assert.deepEqual(await mine(), beforeRestart);
  pass(
    'My Discussions: withdrawn parents leave bounded empty pages with continuation; republishing restores eligible conversations'
  );

  const {
    DiscussionParticipation1791676824000,
  } = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/discussion-participation.migration');
  const migration = new DiscussionParticipation1791676824000(),
    runner = source.createQueryRunner();
  try {
    await migration.up(runner);
    await source.query(
      'ALTER TABLE discussion_write_nodes DROP INDEX idx_discussion_participant, ADD INDEX idx_discussion_participant (discussionId, ownerIdentityId, nodeId)'
    );
    await assert.rejects(
      () => migration.up(runner),
      /Incompatible discussion participant index/
    );
    await source.query(
      'ALTER TABLE discussion_write_nodes DROP INDEX idx_discussion_participant'
    );
    await assert.rejects(
      () => migration.up(runner),
      /Completed discussion participant index is missing/
    );
    await source.query('DELETE FROM migrations WHERE name = ?', [
      'DiscussionParticipation1791676824000',
    ]);
    await assert.rejects(restart, /--migrate/i);
    await options.migrate();
    await restart();
    await migration.up(runner);
    assert.deepEqual(await mine(), beforeRestart);
    await assert.rejects(() => migration.down(), /reviewed forward migration/);
  } finally {
    await runner.release();
  }
  pass(
    'My Discussions: populated explicit migration creates ordered participant index, rejects corruption/lost completed schema, and preserves records on upgrade'
  );
}

module.exports = { myDiscussionsChecks };
