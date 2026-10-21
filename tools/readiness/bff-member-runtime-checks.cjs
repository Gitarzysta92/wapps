const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const execute = promisify(execFile);

async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE;
  const project = process.env.WAPPS_BFF_COMPOSE_PROJECT;
  const report = process.env.WAPPS_BFF_REPORT;
  const fixture = JSON.parse(
    readFileSync(process.env.WAPPS_BFF_CONTENT_FILE, 'utf8')
  );
  assert.ok(
    compose &&
      project &&
      report &&
      fixture.atlas?.id &&
      fixture.article?.id &&
      fixture.suite?.id
  );
  const users = [],
    checks = [],
    stopped = new Set();
  let topic,
    topicRemoved = false;
  const erased = [];
  const persist = () => {
    writeFileSync(report + '.accounts.json', JSON.stringify(users, null, 2), {
      mode: 0o600,
    });
    writeFileSync(
      report,
      JSON.stringify(
        {
          checks,
          disposableIdentities: users.map((user) => user.uid),
          topicId: topic?.id,
          topicRemoved,
          erased,
        },
        null,
        2
      ),
      { mode: 0o600 }
    );
  };
  const pass = (name) => {
    checks.push(name);
    persist();
    console.log('PASS ' + name);
  };
  async function call(
    path,
    {
      user = users[0],
      method = 'GET',
      body,
      key,
      headers = {},
      status = 200,
    } = {}
  ) {
    const response = await fetch(new URL(path, origin), {
      method,
      headers: {
        ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(25000),
    });
    const raw = await response.text();
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      method + ' ' + path + ': HTTP ' + response.status + ', expected ' + status
    );
    if (response.ok && path.startsWith('/api/me'))
      assert.ok(response.headers.get('cache-control')?.includes('no-store'));
    return { response, value: raw.startsWith('{') ? JSON.parse(raw) : null };
  }
  async function until(read, predicate, label, attempts = 80) {
    let last;
    for (let i = 0; i < attempts; i++) {
      try {
        const value = await read();
        if (predicate(value)) return value;
      } catch (error) {
        last = error;
      }
      await delay(500);
    }
    throw new Error(label + (last ? ': ' + last.message : ''));
  }
  async function service(action, name) {
    if (action === 'stop') stopped.add(name);
    await execute(
      'docker',
      ['compose', '-f', compose, '-p', project, action, name],
      { timeout: 45000, maxBuffer: 65536 }
    );
    if (action === 'start') stopped.delete(name);
  }
  const favorites = async () => (await call('/api/me/favorites')).value;
  const content = async () => (await call('/api/me/favorites/content')).value;
  const ready = () =>
    until(
      favorites,
      (value) => value?.identityId === users[0].uid,
      'Account did not recover'
    );
  const base = '/api/application-discussions/' + fixture.atlas.id;
  const thread = () =>
    call(base + '/' + topic.id).then((result) => result.value);
  async function save(target, saved = true) {
    const before = await favorites();
    const body = { expectedRevision: before.revision, target, saved },
      key = randomUUID();
    const receipt = (
      await call('/api/me/favorites', { method: 'PUT', body, key })
    ).value;
    assert.equal(receipt.revision, before.revision + 1);
    return { body, key, receipt };
  }
  async function preferences(change) {
    const current = (await call('/api/me/preferences')).value;
    change(current.preferences);
    await call('/api/me/preferences', {
      method: 'PUT',
      key: randomUUID(),
      body: {
        expectedRevision: current.revision,
        preferences: current.preferences,
      },
    });
  }
  async function allInbox(path) {
    const items = [];
    let cursor = null;
    for (let i = 0; i < 5; i++) {
      const page = (await call(path + (cursor ? '?cursor=' + cursor : '')))
        .value;
      items.push(...page.items);
      if (!page.next) return items;
      cursor = page.next;
    }
    throw new Error('Unexpected inbox size');
  }
  try {
    for (const nickname of ['BFF inbox owner', 'BFF inbox peer']) {
      const credentials = {
        email: 'bff-member-' + randomUUID() + '@wapps-review.test',
        password: randomUUID() + '!Aa1',
        nickname,
      };
      const user = { ...credentials, registrationKey: randomUUID() };
      users.push(user);
      persist();
      Object.assign(
        user,
        (
          await call('/auth/register', {
            user: null,
            method: 'POST',
            body: {
              ...credentials,
              passwordConfirmation: credentials.password,
            },
            key: user.registrationKey,
          })
        ).value
      );
      persist();
      assert.ok(user.uid && user.token);
    }
    const owner = users[0],
      peer = users[1];
    const peerBefore = (await call('/api/me/favorites', { user: peer })).value;
    await call('/api/me/favorites', { user: null, status: 401 });
    await call('/api/me/favorites/content?identityId=' + peer.uid, {
      status: 400,
    });
    assert.equal(
      (
        await call('/api/me/favorites', {
          headers: { 'X-User-Id': peer.uid, 'X-Ingress-Auth': 'spoof' },
        })
      ).value.identityId,
      owner.uid
    );
    await preferences((value) => {
      value.privacy.profileVisibility = 'public';
    });
    const profile = (await call('/api/me/profile')).value;
    topic = (
      await call(base, {
        method: 'POST',
        key: randomUUID(),
        body: {
          title: 'BFF integration test topic',
          tags: [],
          displayName: 'BFF inbox owner',
          text: 'Disposable local BFF workflow test.',
        },
        status: 201,
      })
    ).value;
    persist();
    await until(
      thread,
      (value) => value?.id === topic.id,
      'Topic did not materialize'
    );
    const targets = [
      { kind: 'applications', id: fixture.atlas.id },
      { kind: 'suites', id: fixture.suite.id },
      { kind: 'articles', id: fixture.article.id },
      { kind: 'discussions', id: topic.id },
    ];
    let first;
    for (const target of targets) {
      const result = await save(target);
      if (!first) first = result;
    }
    const savedAt = Date.now();
    assert.deepEqual(
      (
        await call('/api/me/favorites', {
          method: 'PUT',
          body: first.body,
          key: first.key,
        })
      ).value,
      first.receipt
    );
    await call('/api/me/favorites', {
      method: 'PUT',
      body: first.body,
      key: randomUUID(),
      status: 409,
    });
    await call('/api/me/favorites', {
      method: 'PUT',
      body: { ...first.body, saved: false },
      key: first.key,
      status: 409,
    });
    const resolved = await content();
    assert.equal(resolved.items.length, 4);
    assert.ok(resolved.items.every((item) => item.status === 'available'));
    const discussion = resolved.items.find(
      (item) => item.kind === 'discussions'
    );
    assert.equal(
      discussion.appSlug,
      (await call('/api/catalog/app-selection?ids=' + fixture.atlas.id)).value
        .items[0].slug
    );
    assert.equal(discussion.classification, 'general');
    assert.deepEqual(
      (await call('/api/me/favorites', { user: peer })).value,
      peerBefore
    );
    pass(
      'all four favorite kinds resolve through BFF; commands preserve replay/conflict/isolation and trusted identity'
    );

    const variants = [
      '/api/me/favorites',
      '/api/me/Favorites/',
      '/api/me/favorites/content',
      '/api/me/Favorites/Content/',
      '/api/me/notifications',
      '/api/me/Notifications/',
      '/api/me/notifications/mentions',
      '/api/me/Notifications/Mentions/',
      '/api/me/notifications/favorites',
      '/api/me/Notifications/Favorites/',
    ];
    await service('stop', 'catalog-bff');
    for (const path of variants) await call(path, { status: [502, 504] });
    for (const path of [
      '/api/me/notifications/read',
      '/api/me/notifications/mentions/read',
      '/api/me/notifications/favorites/read',
    ])
      await call(path, {
        method: 'PUT',
        body: { id: topic.id },
        status: [502, 504],
      });
    await call('/api/me/articles', { status: [502, 503, 504] });
    await service('start', 'catalog-bff');
    await ready();
    assert.deepEqual(await content(), resolved);
    pass(
      'all favorite/inbox route forms and mark-read commands require BFF; state survives BFF restart'
    );

    const pending = {
        expectedRevision: (await favorites()).revision,
        target: targets[0],
        saved: true,
      },
      pendingKey = randomUUID();
    await service('stop', 'account-management');
    const unavailable = await call('/api/me/favorites', {
      method: 'PUT',
      body: pending,
      key: pendingKey,
      status: 503,
    });
    assert.equal(unavailable.response.headers.get('retry-after'), '2');
    await call('/api/me/favorites/content', { status: 503 });
    await call('/api/me/notifications/mentions', { status: 503 });
    await service('start', 'account-management');
    await ready();
    const confirmed = (
      await call('/api/me/favorites', {
        method: 'PUT',
        body: pending,
        key: pendingKey,
      })
    ).value;
    assert.deepEqual(
      (
        await call('/api/me/favorites', {
          method: 'PUT',
          body: pending,
          key: pendingKey,
        })
      ).value,
      confirmed
    );
    pass(
      'Account outage fails explicitly; restart preserves SQL favorites and exact caller retry'
    );

    // Watches observe their first canonical baseline before later updates can notify.
    await delay(Math.max(0, 35000 - (Date.now() - savedAt)));
    const replyIds = [];
    for (let i = 0; i < 11; i++) {
      const body = {
        displayName: 'BFF inbox peer',
        text: 'Disposable reply ' + (i + 1),
        ...(i === 0 ? { mentions: [profile.publicId] } : {}),
      };
      const key = randomUUID();
      const reply = (
        await call(base + '/' + topic.id + '/replies', {
          user: peer,
          method: 'POST',
          key,
          body,
          status: 201,
        })
      ).value;
      replyIds.push(reply.id);
      if (i === 0)
        assert.deepEqual(
          (
            await call(base + '/' + topic.id + '/replies', {
              user: peer,
              method: 'POST',
              key,
              body,
              status: 201,
            })
          ).value,
          reply
        );
    }
    await until(
      thread,
      (value) => value?.replyCount === 11,
      'Replies did not materialize'
    );
    const replyPath = '/api/me/notifications',
      mentionPath = replyPath + '/mentions',
      updatePath = replyPath + '/favorites';
    const replies = await until(
      () => allInbox(replyPath),
      (items) => replyIds.every((id) => items.some((item) => item.id === id)),
      'Reply delivery failed'
    );
    assert.equal(replies.length, 11);
    const firstPage = (await call(replyPath)).value;
    assert.equal(firstPage.items.length, 10);
    assert.ok(firstPage.next);
    const mentions = await until(
      () => allInbox(mentionPath),
      (items) => items.some((item) => item.nodeId === replyIds[0]),
      'Mention delivery failed'
    );
    const updates = await until(
      () => allInbox(updatePath),
      (items) => items.some((item) => item.target.id === topic.id),
      'Favorite update delivery failed'
    );
    const selected = [
      [replyPath, replies[0]],
      [mentionPath, mentions[0]],
      [updatePath, updates.find((item) => item.target.id === topic.id)],
    ];
    const readReceipts = [];
    for (const [path, item] of selected) {
      assert.equal(item.readAt, null);
      const read = (
        await call(path + '/read', { method: 'PUT', body: { id: item.id } })
      ).value;
      assert.deepEqual(
        (await call(path + '/read', { method: 'PUT', body: { id: item.id } }))
          .value,
        read
      );
      assert.ok(read.readAt >= item.at);
      readReceipts.push([path, read]);
      await call(path + '/read', {
        user: peer,
        method: 'PUT',
        body: { id: item.id },
        status: [400, 403, 404],
      });
      assert.equal((await call(path, { user: peer })).value.items.length, 0);
      await call(path + '?identityId=' + peer.uid, { status: 400 });
      await call(path + '/read', {
        method: 'PUT',
        body: { id: item.id, identityId: peer.uid },
        status: 400,
      });
    }
    pass(
      'real reply, mention and favorite-update delivery, pagination and durable mark-read retries remain private to the recipient'
    );

    await service('stop', 'account-management');
    await service('start', 'account-management');
    await ready();
    for (const [path, read] of readReceipts)
      assert.equal(
        (await allInbox(path)).find((item) => item.id === read.id)?.readAt,
        read.readAt
      );
    await preferences((value) => {
      value.notifications.inApp.enabled = false;
    });
    for (const path of [replyPath, mentionPath, updatePath])
      assert.deepEqual((await call(path)).value, {
        enabled: false,
        items: [],
        next: null,
      });
    await preferences((value) => {
      value.notifications.inApp.enabled = true;
    });
    pass(
      'read receipts survive Account restart; saved notification opt-out returns explicit disabled inboxes'
    );

    await service('stop', 'discussion');
    await call('/api/me/favorites/content', { status: 503 });
    await save(targets[3], false);
    assert.equal((await content()).items.length, 3);
    await service('start', 'discussion');
    await until(
      thread,
      (value) => value?.id === topic.id,
      'Discussion did not recover'
    );
    await service('stop', 'editorial');
    await call('/api/me/favorites/content', { status: 503 });
    await save(targets[0], false);
    assert.deepEqual(
      (
        await call('/api/me/favorites', {
          method: 'PUT',
          body: first.body,
          key: first.key,
        })
      ).value,
      first.receipt
    );
    assert.ok(
      !(await favorites()).favorites.some(
        (item) => item.kind === 'applications' && item.id === targets[0].id
      )
    );
    await service('start', 'editorial');
    await until(
      content,
      (value) => value?.items.length === 2,
      'Editorial metadata did not recover'
    );
    pass(
      'metadata dependency failures do not prevent removals; historical add retries cannot resurrect removed favorites'
    );
  } finally {
    for (const name of [...stopped]) await service('start', name);
    if (topic && users[0]?.token) {
      const current = await until(
        thread,
        (value) => value?.id === topic.id,
        'Cleanup topic read failed'
      );
      await call(base + '/' + topic.id, {
        method: 'DELETE',
        key: randomUUID(),
        body: { expectedRevision: current.revision },
      });
      topicRemoved = true;
      persist();
    }
    for (const user of [...users].reverse()) {
      if (!user.uid) continue;
      await call('/api/me', { user, method: 'DELETE', status: 202 });
      erased.push(user.uid);
      persist();
    }
  }
  pass(
    'disposable topic removed and only the newly created accounts erased; existing review data unchanged'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
