const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { request } = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');
const { profileParityContent } = require('./profile-parity-content.cjs');

async function until(read, accepts, label) {
  for (let attempt = 0; attempt < 160; attempt++) {
    const value = await read();
    if (accepts(value)) return value;
    await delay(200);
  }
  throw new Error(label);
}
function bodyRead(url, token, framing) {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          [framing]: framing === 'Content-Length' ? '2' : 'chunked',
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      }
    );
    req.on('error', reject);
    req.end('{}');
  });
}

async function qualifyFavoritesInboxes({
  call,
  origins,
  input,
  source,
  operator,
  services,
  ingressSecret,
  restartAccount,
  restartBff,
  stopBff,
  pausePolicy,
  resumePolicy,
}) {
  const [local, alpha] = origins;
  const users = [];
  for (const name of ['owner', 'peer']) {
    const user = await call('/auth/register', {
      at: local,
      body: {
        ...input,
        email: `inbox-${name}@example.test`,
        nickname: 'Inbox ' + name,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    user.publicId = (
      await call('/api/me/profile', { at: local, token: user.token })
    ).publicId;
    users.push(user);
  }
  const [owner, peer] = users;
  const own = (path, options = {}) =>
    call(path, { at: local, token: owner.token, ...options });
  const command = (path, body, key = randomUUID(), options = {}) =>
    own(path, {
      method: 'PUT',
      body,
      headers: { 'Idempotency-Key': key },
      ...options,
    });
  async function preferences(change, actor = owner) {
    const saved = await own('/api/me/preferences', { token: actor.token });
    change(saved.preferences);
    return command(
      '/api/me/preferences',
      { expectedRevision: saved.revision, preferences: saved.preferences },
      randomUUID(),
      { token: actor.token }
    );
  }
  await preferences((value) => {
    value.privacy.profileVisibility = 'public';
    for (const field of [
      'showFavorites',
      'showSuites',
      'showDiscussions',
      'showActivityHistory',
    ])
      value.privacy[field] = true;
  });
  const fixtures = [];
  for (const classification of ['general', 'mature', null])
    fixtures.push(
      await profileParityContent({
        call,
        at: local,
        owner,
        operator,
        services,
        ingressSecret,
        classification,
        checkLag: false,
        startWorker: fixtures.length === 0,
        saveFavorite: false,
      })
    );
  const targets = fixtures.flatMap((fixture) => [
    { kind: 'applications', id: fixture.application.id },
    { kind: 'suites', id: fixture.suite.id },
    { kind: 'articles', id: fixture.article.id },
    { kind: 'discussions', id: fixture.topic.id },
  ]);
  await command(
    '/api/me/favorites',
    {
      expectedRevision: (await own('/api/me/favorites')).revision,
      target: { ...targets[0], id: targets[0].id.toUpperCase() },
      saved: true,
    },
    randomUUID(),
    { status: 400 }
  );
  const changes = [];
  for (const target of targets) {
    const before = await own('/api/me/favorites');
    const body = { expectedRevision: before.revision, target, saved: true },
      key = randomUUID();
    const receipts = await Promise.all(
      origins.map((at) => command('/api/me/favorites', body, key, { at }))
    );
    assert.deepEqual(receipts[0], receipts[1]);
    changes.push({ body, key, receipt: receipts[0] });
  }
  const session = await call('/auth/signin', {
    at: alpha,
    body: { email: 'inbox-owner@example.test', password: input.password },
  });
  assert.equal(session.uid, owner.uid);
  assert.equal(
    (await own('/api/me/favorites', { at: alpha, token: session.token }))
      .favorites.length,
    12
  );
  assert.equal(
    (await own('/api/me/favorites', { token: peer.token })).favorites.length,
    0
  );
  const reads = [
    '/api/me/favorites',
    '/api/me/favorites/content',
    '/api/me/notifications',
    '/api/me/notifications/mentions',
    '/api/me/notifications/favorites',
  ];
  for (const at of origins) {
    for (const path of reads) {
      await own(path, { at, token: undefined, status: 401 });
      await own(path + '?identityId=' + peer.uid, { at, status: 400 });
      await own(path, { at, method: 'POST', body: {}, status: 404 });
      await own(path + '/unknown', { at, status: 404 });
      await own(path.toUpperCase() + '/', { at });
      for (const framing of ['Content-Length', 'Transfer-Encoding'])
        assert.equal(await bodyRead(at + path, owner.token, framing), 400);
    }
    const forged = await own('/api/me/favorites', {
      at,
      headers: {
        'X-User-Id': peer.uid,
        'X-Ingress-Auth': 'forged',
        'X-User-Claims': '{"roles":["admin"]}',
      },
    });
    assert.equal(forged.identityId, owner.uid);
    await command(
      '/api/me/favorites',
      { ...changes[0].body, saved: false },
      changes[0].key,
      { at, status: 409 }
    );
    await command(
      '/api/me/favorites',
      { ...changes[0].body, saved: false },
      randomUUID(),
      { at, status: 409 }
    );
  }
  console.log(
    'PASS favorites/inboxes: both complete gateway families, body/query/forged-context denial, four-kind concurrent replay, conflicts and independent sessions'
  );

  const profile = '/api/profiles/' + owner.publicId;
  const sections = [
    'favorites',
    'suites',
    'articles',
    'discussions',
    'activity',
  ];
  async function assertFiltered(token, count) {
    for (const at of origins) {
      if (token === owner.token || token === session.token) {
        const content = await own('/api/me/favorites/content', { at, token });
        assert.equal(
          content.items.filter((item) => item.status === 'available').length,
          count
        );
        for (const item of content.items.filter(
          (item) => item.status === 'unavailable'
        )) {
          assert.equal(item.slug, null);
          assert.equal(item.image, undefined);
          assert.equal(item.appSlug, undefined);
          assert.equal(item.classification, undefined);
        }
      }
      for (const section of sections) {
        const page = await own(profile + '/' + section, { at, token });
        assert.equal(page.sharing, 'visible');
        assert.ok(page.items.length > 0, section);
        if (count === 4)
          assert.ok(
            page.items.every((item) => item.classification === 'general'),
            section + ' leaks classification'
          );
        else
          assert.ok(
            page.items.some((item) => item.classification === 'mature'),
            section + ' lost mature content'
          );
      }
    }
  }
  await assertFiltered(owner.token, 4);
  await preferences((value) => {
    value.content.showMatureContent = true;
  });
  await assertFiltered(session.token, 12);
  await assertFiltered(peer.token, 4);
  await assertFiltered(undefined, 4);
  await preferences((value) => {
    value.content.showMatureContent = false;
  });
  await assertFiltered(session.token, 4);
  console.log(
    'PASS General/Mature/unclassified favorites and all five profile consumers: current viewer choices, nested metadata removal, anonymous defaults and independent session invalidation'
  );

  const inboxes = [
    '/api/me/notifications',
    '/api/me/notifications/mentions',
    '/api/me/notifications/favorites',
  ];
  async function inbox(path, token = owner.token, at = local) {
    const result = [];
    let cursor = null;
    for (let page = 0; page < 12; page++) {
      const value = await own(path + (cursor ? '?cursor=' + cursor : ''), {
        token,
        at,
      });
      result.push(...value.items);
      if (!value.next) return result;
      cursor = value.next;
    }
    throw new Error('Inbox exceeded bounded fixture pages');
  }
  async function reply(fixture, mentions = true) {
    const route =
      '/api/application-discussions/' +
      fixture.application.id +
      '/' +
      fixture.topic.id +
      '/replies';
    const key = randomUUID(),
      body = {
        displayName: 'Inbox peer',
        text: 'Notification qualification reply',
        ...(mentions ? { mentions: [owner.publicId] } : {}),
      };
    const first = await own(route, {
      token: peer.token,
      body,
      headers: { 'Idempotency-Key': key },
      status: 201,
    });
    assert.deepEqual(
      await own(route, {
        at: alpha,
        token: peer.token,
        body,
        headers: { 'Idempotency-Key': key },
        status: 201,
      }),
      first
    );
    return first;
  }
  async function settle(fixture, response, delivered) {
    await until(
      () =>
        source.query(
          'SELECT delivered FROM identity_reply_notifications WHERE identityId=? AND id=?',
          [owner.uid, response.id]
        ),
      (rows) => rows.length === 1 && rows[0].delivered === delivered,
      'Reply receipt did not settle'
    );
    await until(
      () =>
        source.query(
          'SELECT delivered FROM identity_mention_notifications WHERE identityId=? AND nodeId=?',
          [owner.uid, response.id]
        ),
      (rows) => rows.length === 1 && rows[0].delivered === delivered,
      'Mention receipt did not settle'
    );
    // Advance only the disposable test scheduler, keeping production delivery/receipts intact.
    await source.query(
      'UPDATE identity_favorite_watches SET availableAt=0 WHERE identityId=? AND targetId=? AND leaseToken IS NULL',
      [owner.uid, fixture.topic.id]
    );
    await until(
      () =>
        source.query(
          'SELECT delivered FROM identity_favorite_notifications WHERE identityId=? AND targetId=? ORDER BY version DESC LIMIT 1',
          [owner.uid, fixture.topic.id]
        ),
      (rows) => rows.length === 1 && rows[0].delivered === delivered,
      'Watch receipt did not settle'
    );
  }
  const replies = [];
  for (let i = 0; i < fixtures.length; i++) {
    const response = await reply(fixtures[i]);
    replies.push(response);
    await settle(fixtures[i], response, i === 0 ? 1 : 0);
  }
  // Re-expose source work after committed Account receipts to simulate a lost acknowledgement.
  for (const table of [
    'discussion_reply_notifications',
    'discussion_mention_notifications',
  ]) {
    await until(
      () =>
        source.query(
          `SELECT id FROM discussion.${table} WHERE recipientId=? AND deliveredAt IS NULL`,
          [owner.uid]
        ),
      (rows) => rows.length === 0,
      'Source acknowledgements did not settle'
    );
    await source.query(
      `UPDATE discussion.${table} SET deliveredAt=NULL,availableAt=createdAt WHERE recipientId=?`,
      [owner.uid]
    );
    await until(
      () =>
        source.query(
          `SELECT id FROM discussion.${table} WHERE recipientId=? AND deliveredAt IS NULL`,
          [owner.uid]
        ),
      (rows) => rows.length === 0,
      'Source acknowledgement replay did not settle'
    );
  }
  for (const path of inboxes) {
    const items = await inbox(path);
    assert.equal(items.length, 1, path);
    assert.equal(items[0].classification, 'general');
    for (const at of origins) {
      assert.deepEqual(
        (await inbox(path, session.token, at)).map(
          ({ readAt, ...item }) => item
        ),
        items.map(({ readAt, ...item }) => item)
      );
      assert.equal((await inbox(path, peer.token, at)).length, 0);
      const receipt = await command(
        path + '/read',
        { id: items[0].id },
        undefined,
        { at }
      );
      assert.deepEqual(
        await command(path + '/read', { id: items[0].id }, undefined, { at }),
        receipt
      );
      await command(path + '/read', { id: items[0].id }, undefined, {
        at,
        token: peer.token,
        status: 400,
      });
    }
  }
  await preferences((value) => {
    value.content.showMatureContent = true;
  });
  for (const path of inboxes)
    assert.equal(
      (await inbox(path)).length,
      1,
      'Suppressed receipt resurrected'
    );
  const matureReply = await reply(fixtures[1]);
  await settle(fixtures[1], matureReply, 1);
  for (const path of inboxes) assert.equal((await inbox(path)).length, 2, path);
  await preferences((value) => {
    value.content.showMatureContent = false;
  });
  for (const path of inboxes)
    assert.equal((await inbox(path, session.token, alpha)).length, 1, path);
  await preferences((value) => {
    value.notifications.inApp.enabled = false;
  });
  for (const path of inboxes)
    assert.deepEqual(await own(path, { at: alpha }), {
      enabled: false,
      items: [],
      next: null,
    });
  const disabledReply = await reply(fixtures[0]);
  await settle(fixtures[0], disabledReply, 0);
  await preferences((value) => {
    value.notifications.inApp.enabled = true;
  });
  for (const path of inboxes) assert.equal((await inbox(path)).length, 1, path);
  await restartAccount();
  await restartBff();
  for (const path of inboxes) {
    const items = await inbox(path, session.token, alpha);
    assert.equal(items.length, 1);
    assert.ok(items[0].readAt);
  }
  console.log(
    'PASS actual reply/mention/watch workers: durable delivered/suppressed receipts, exact-once visible replay, private persistent read state and current preference suppression'
  );

  const remove = async (target, options = {}) => {
    const saved = await own('/api/me/favorites');
    return command(
      '/api/me/favorites',
      { expectedRevision: saved.revision, target, saved: false },
      randomUUID(),
      options
    );
  };
  const before = await own('/api/me/favorites');
  const rollbackBody = {
      expectedRevision: before.revision,
      target: targets[0],
      saved: false,
    },
    rollbackKey = randomUUID();
  await source.query(
    "CREATE TRIGGER fail_member_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='member rollback'"
  );
  try {
    await command('/api/me/favorites', rollbackBody, rollbackKey, {
      at: alpha,
      status: 503,
    });
    assert.deepEqual(await own('/api/me/favorites'), before);
  } finally {
    await source.query('DROP TRIGGER fail_member_outbox');
  }
  await command('/api/me/favorites', rollbackBody, rollbackKey);
  await pausePolicy();
  try {
    for (const at of origins)
      await own('/api/me/favorites', { at, status: 503 });
  } finally {
    await resumePolicy();
  }
  await services.stopDiscussion();
  try {
    for (const at of origins) {
      await own('/api/me/favorites/content', { at, status: 503 });
      await own('/api/me/notifications', { at, status: 503 });
    }
    await remove(targets[3], { at: alpha });
    assert.deepEqual(
      await command('/api/me/favorites', changes[3].body, changes[3].key),
      changes[3].receipt
    );
    assert.ok(
      !(await own('/api/me/favorites')).favorites.some(
        (item) => item.id === targets[3].id
      )
    );
  } finally {
    await services.restartDiscussion();
  }
  await services.stopEditorial();
  try {
    for (const at of origins)
      await own('/api/me/favorites/content', { at, status: 503 });
    await remove(targets[1]);
  } finally {
    await services.restartEditorial();
  }
  const readd = {
    expectedRevision: (await own('/api/me/favorites')).revision,
    target: targets[3],
    saved: true,
  };
  await command('/api/me/favorites', readd);
  assert.equal(
    (await inbox(inboxes[2])).length,
    0,
    'Re-add exposed old generation notifications'
  );
  await source.query(
    'UPDATE identity_favorite_watches SET availableAt=0 WHERE identityId=? AND targetId=? AND leaseToken IS NULL',
    [owner.uid, targets[3].id]
  );
  await delay(1500);
  assert.equal(
    (await inbox(inboxes[2])).length,
    0,
    'Re-add baseline generated a historical notification'
  );
  const newReply = await reply(fixtures[0]);
  await settle(fixtures[0], newReply, 1);
  assert.equal((await inbox(inboxes[2])).length, 1);
  const pagedReplies = [];
  for (let index = 0; index < 11; index++)
    pagedReplies.push(await reply(fixtures[0], false));
  await until(
    () => inbox(inboxes[0]),
    (items) =>
      pagedReplies.every((reply) => items.some((item) => item.id === reply.id)),
    'Paginated replies did not arrive'
  );
  for (const at of origins) {
    const first = await own(inboxes[0], { at });
    assert.equal(first.items.length, 10);
    assert.ok(first.next);
    const next = await own(inboxes[0] + '?cursor=' + first.next, { at });
    assert.ok(next.items.length > 0);
    assert.equal(
      new Set([...first.items, ...next.items].map((item) => item.id)).size,
      first.items.length + next.items.length
    );
  }
  await stopBff();
  try {
    for (const at of origins)
      for (const path of reads)
        for (const variant of [
          path,
          path.toUpperCase() + '/',
          path + '/unknown',
        ])
          await own(variant, { at, status: 502 });
  } finally {
    await restartBff();
  }
  await fixtures[0].withdraw();
  for (const at of origins)
    for (const path of inboxes)
      assert.equal(
        (await inbox(path, owner.token, at)).length,
        0,
        'Withdrawn content leaked metadata'
      );
  console.log(
    'PASS favorites/inboxes rollback/retry, policy/source outages, outage removal, historical non-resurrection, re-add watch baseline, owner/BFF restart and withdrawn-parent privacy with retained projections'
  );
}
module.exports = { qualifyFavoritesInboxes };
