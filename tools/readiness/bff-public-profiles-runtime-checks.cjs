const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const sharp = require('sharp');
const execute = promisify(execFile);

async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE,
    project = process.env.WAPPS_BFF_COMPOSE_PROJECT,
    report = process.env.WAPPS_BFF_REPORT;
  const { staff } = JSON.parse(
    readFileSync(process.env.WAPPS_BFF_ACCOUNTS_FILE, 'utf8')
  );
  const fixture = JSON.parse(
    readFileSync(process.env.WAPPS_BFF_CONTENT_FILE, 'utf8')
  );
  assert.ok(compose && project && report && staff?.token && fixture.atlas?.id);
  const users = [],
    checks = [],
    erased = [],
    stopped = new Set();
  const cleanupErrors = [];
  let failure;
  let topic,
    topicRemoved = false;
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
      binary = false,
    } = {}
  ) {
    const response = await fetch(new URL(path, origin), {
      method,
      headers: {
        ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
        ...(body === undefined || Buffer.isBuffer(body)
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(40000),
    });
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      `${method} ${path}: HTTP ${response.status}, expected ${status}`
    );
    if (response.ok && path.startsWith('/api/'))
      assert.ok(response.headers.get('cache-control')?.includes('no-store'));
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      response,
      value: binary
        ? bytes
        : bytes[0] === 123
        ? JSON.parse(bytes.toString())
        : null,
    };
  }
  async function until(read, predicate, label) {
    let last;
    for (let i = 0; i < 60; i++) {
      try {
        const result = await read();
        if (predicate(result)) return result;
      } catch (error) {
        last = error;
      }
      await delay(500);
    }
    throw Error(label + (last ? ': ' + last.message : ''));
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
  const privateProfile = async (user = users[0]) =>
    (await call('/api/me/profile', { user })).value;
  const ready = () =>
    until(
      privateProfile,
      (value) => value?.identityId === users[0].uid,
      'Account did not recover'
    );
  async function preferences(change) {
    const before = (await call('/api/me/preferences')).value;
    change(before.preferences);
    return call('/api/me/preferences', {
      method: 'PUT',
      key: randomUUID(),
      body: {
        expectedRevision: before.revision,
        preferences: before.preferences,
      },
    });
  }
  async function directory(user = null) {
    const profiles = [];
    let after = null;
    for (let i = 0; i < 20; i++) {
      const page = (
        await call('/api/profiles' + (after ? '?after=' + after : ''), { user })
      ).value;
      assert.ok(page.profiles.every((item) => item.contactEmail === null));
      profiles.push(...page.profiles);
      if (!page.after) return profiles;
      assert.ok(after === null || page.after > after);
      after = page.after;
    }
    throw Error('Directory exceeded qualification bound');
  }
  const topicBase = '/api/application-discussions/' + fixture.atlas.id;
  try {
    for (const nickname of [
      'BFF Public Owner',
      'BFF Public Follower',
      'BFF Public Stranger',
    ]) {
      const password = randomUUID() + '!Aa1';
      const user = {
        email: 'bff-public-' + randomUUID() + '@wapps-review.test',
        password,
        nickname,
        registrationKey: randomUUID(),
      };
      users.push(user);
      persist();
      Object.assign(
        user,
        (
          await call('/auth/register', {
            user: null,
            method: 'POST',
            key: user.registrationKey,
            body: {
              email: user.email,
              password,
              passwordConfirmation: password,
              nickname,
            },
          })
        ).value
      );
      persist();
      user.publicId = (await privateProfile(user)).publicId;
      assert.ok(user.publicId);
      persist();
    }
    const [owner, follower, stranger] = users;
    const base = '/api/profiles/' + owner.publicId;
    const staffBefore = (await call('/api/me/profile', { user: staff })).value;
    await preferences((value) => {
      value.privacy.profileVisibility = 'public';
      for (const field of [
        'showFavorites',
        'showSuites',
        'showDiscussions',
        'showActivityHistory',
        'showBadges',
      ])
        value.privacy[field] = true;
    });
    assert.equal(
      (await call(base, { user: null })).value.profile.name,
      owner.nickname
    );
    assert.ok(
      (await directory()).some((profile) => profile.id === owner.publicId)
    );
    await call(base, { user: { token: 'invalid-session' }, status: 401 });
    const spoofed = (
      await call(base, {
        user: null,
        headers: {
          'X-User-Id': owner.uid,
          'X-Ingress-Auth': 'forged',
          'X-User-Claims': '{"roles":["admin"]}',
        },
      })
    ).value;
    assert.equal(spoofed.isOwner, false);
    assert.equal(spoofed.follow, null);
    for (const path of [
      '/api/me/profile-follows',
      '/api/me/profile-follows/outgoing',
      '/api/me/totals',
      '/api/me/badges',
      '/api/admin/profile-badges',
    ])
      await call(path, { user: null, status: 401 });
    pass(
      'public directory and profiles support trusted anonymous access; spoofed identity and invalid sessions cannot gain member access'
    );

    const source = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 20, g: 100, b: 150 },
      },
    })
      .png()
      .toBuffer();
    await call('/api/me/profile/avatar', {
      method: 'PUT',
      body: source,
      key: randomUUID(),
      headers: {
        'Content-Type': 'image/png',
        'If-Match': '"' + (await privateProfile()).revision + '"',
        'X-Avatar-Bytes': String(source.length),
        'X-Avatar-Sha256': createHash('sha256').update(source).digest('hex'),
      },
    });
    const photoId = (await privateProfile()).profile.avatarId;
    const photoPath = base + '/avatar/' + photoId;
    const photo = await call(photoPath, { user: null, binary: true });
    assert.equal(photo.response.headers.get('content-type'), 'image/webp');
    assert.equal(
      photo.response.headers.get('x-content-type-options'),
      'nosniff'
    );
    assert.ok(
      photo.response.headers.get('content-security-policy').includes('sandbox')
    );
    assert.equal((await sharp(photo.value).metadata()).format, 'webp');
    await call('/api/profiles/' + stranger.publicId + '/avatar/' + photoId, {
      user: null,
      status: 404,
    });
    pass(
      'public photo bytes are bounded normalized WebP and scoped to the current profile and audience'
    );

    const favorites = (await call('/api/me/favorites')).value;
    await call('/api/me/favorites', {
      method: 'PUT',
      key: randomUUID(),
      body: {
        expectedRevision: favorites.revision,
        target: { kind: 'applications', id: fixture.atlas.id },
        saved: true,
      },
    });
    topic = (
      await call(topicBase, {
        method: 'POST',
        key: randomUUID(),
        body: {
          title: 'BFF public profile test topic',
          tags: [],
          displayName: owner.nickname,
          text: 'Disposable local profile qualification.',
        },
        status: 201,
      })
    ).value;
    persist();
    await until(
      () => call(topicBase + '/' + topic.id).then((result) => result.value),
      (value) => value?.id === topic.id,
      'Topic did not materialize'
    );
    assert.equal(
      (await call(base + '/favorites', { user: null })).value.items[0].id,
      fixture.atlas.id
    );
    const discussions = await until(
      () =>
        call(base + '/discussions', { user: null }).then(
          (result) => result.value
        ),
      (value) => value?.items.some((item) => item.id === topic.id),
      'Shared topic unavailable'
    );
    assert.ok(discussions.items.some((item) => item.id === topic.id));
    for (const section of ['suites', 'articles', 'activity'])
      assert.equal(
        (await call(base + '/' + section, { user: null })).value.sharing,
        'visible'
      );
    const totals = (await call(base + '/totals', { user: null })).value;
    assert.equal(totals.favorites, 1);
    assert.equal(totals.discussions, 1);
    assert.deepEqual((await call('/api/me/totals')).value, totals);
    await preferences((value) => {
      for (const field of [
        'showFavorites',
        'showSuites',
        'showDiscussions',
        'showActivityHistory',
        'showBadges',
      ])
        value.privacy[field] = false;
    });
    for (const section of [
      'favorites',
      'suites',
      'articles',
      'discussions',
      'activity',
    ])
      assert.deepEqual(
        (await call(base + '/' + section, { user: null })).value,
        { sharing: 'hidden', items: [], after: null }
      );
    assert.deepEqual((await call(base + '/totals', { user: null })).value, {
      favorites: null,
      suites: null,
      articles: null,
      discussions: null,
    });
    assert.deepEqual((await call(base + '/badges', { user: null })).value, {
      sharing: 'hidden',
      items: [],
    });
    pass(
      'shared content and totals use canonical records; sharing changes hide data explicitly without invented zero totals'
    );

    await preferences((value) => {
      value.privacy.profileVisibility = 'followers';
      value.privacy.showBadges = true;
    });
    assert.equal((await call(base, { user: null })).value.access, 'followers');
    assert.equal((await call(base, { user: follower })).value.profile, null);
    await call(photoPath, { user: follower, status: 404 });
    assert.ok(
      !(await directory()).some((profile) => profile.id === owner.publicId)
    );
    const command = {
        ownerId: owner.publicId,
        requesterId: follower.publicId,
        expectedRevision: 0,
        action: 'request',
      },
      key = randomUUID();
    const pending = (
      await call('/api/me/profile-follows', {
        user: follower,
        method: 'PUT',
        key,
        body: command,
      })
    ).value;
    assert.equal(pending.status, 'pending');
    assert.deepEqual(
      (
        await call('/api/me/profile-follows', {
          user: follower,
          method: 'PUT',
          key,
          body: command,
        })
      ).value,
      pending
    );
    await call('/api/me/profile-follows', {
      user: follower,
      method: 'PUT',
      key: randomUUID(),
      body: command,
      status: 409,
    });
    await call('/api/me/profile-follows', {
      user: stranger,
      method: 'PUT',
      key: randomUUID(),
      body: {
        ...command,
        expectedRevision: pending.revision,
        action: 'approve',
      },
      status: [403, 404],
    });
    assert.equal(
      (await call('/api/me/profile-follows')).value.followers[0].requesterId,
      follower.publicId
    );
    assert.equal(
      (await call('/api/me/profile-follows/outgoing', { user: follower })).value
        .following[0].ownerId,
      owner.publicId
    );
    const approval = {
        ...command,
        expectedRevision: pending.revision,
        action: 'approve',
      },
      approvalKey = randomUUID();
    const approved = (
      await call('/api/me/profile-follows', {
        method: 'PUT',
        key: approvalKey,
        body: approval,
      })
    ).value;
    assert.equal(approved.status, 'approved');
    assert.equal(
      (await call(base, { user: follower })).value.profile.id,
      owner.publicId
    );
    assert.deepEqual(
      (await call(photoPath, { user: follower, binary: true })).value,
      photo.value
    );
    await call(photoPath, { user: stranger, status: 404 });
    pass(
      'follow request and independent owner approval preserve keys/revisions and grant only the approved viewer access to profile/photo'
    );

    const badgePath = '/api/admin/profile-badges/' + owner.publicId;
    await call('/api/admin/profile-badges', { user: owner, status: 403 });
    assert.deepEqual(
      (await call('/api/admin/profile-badges', { user: staff })).value.kinds,
      ['verified', 'premium']
    );
    const badgeCommand = {
        expectedRevision: 0,
        kind: 'verified',
        action: 'award',
        reason: 'Disposable local BFF qualification',
      },
      badgeKey = randomUUID();
    await call(badgePath, {
      user: stranger,
      method: 'PUT',
      key: randomUUID(),
      body: badgeCommand,
      status: 403,
    });
    const award = (
      await call(badgePath, {
        user: staff,
        method: 'PUT',
        key: badgeKey,
        body: badgeCommand,
      })
    ).value;
    assert.equal(award.reason, badgeCommand.reason);
    assert.deepEqual(
      (
        await call(badgePath, {
          user: staff,
          method: 'PUT',
          key: badgeKey,
          body: badgeCommand,
        })
      ).value,
      award
    );
    await call(badgePath, {
      user: staff,
      method: 'PUT',
      key: randomUUID(),
      body: badgeCommand,
      status: 409,
    });
    assert.equal(
      (await call(base + '/badges', { user: follower })).value.items[0].kind,
      'verified'
    );
    assert.equal(
      (await call('/api/me/badges')).value.items[0].kind,
      'verified'
    );
    assert.equal(
      (await call(badgePath, { user: staff })).value.events[0].reason,
      badgeCommand.reason
    );
    pass(
      'staff-only badge award, reasons and audit history pass through BFF with exact replay and stale-command conflicts'
    );

    const paths = [
      '/api/profiles',
      base,
      photoPath,
      ...[
        'favorites',
        'suites',
        'articles',
        'discussions',
        'activity',
        'totals',
        'badges',
      ].map((section) => base + '/' + section),
      '/api/me/profile-follows',
      '/api/me/profile-follows/outgoing',
      '/api/me/totals',
      '/api/me/badges',
      '/api/admin/profile-badges',
      badgePath,
    ];
    await service('stop', 'catalog-bff');
    for (const path of paths) {
      await call(path, { status: [502, 504] });
      await call(
        path
          .split('/')
          .map((part) =>
            [
              'profiles',
              'profile-follows',
              'profile-badges',
              'totals',
              'badges',
              'outgoing',
              'avatar',
            ].includes(part)
              ? part.toUpperCase()
              : part
          )
          .join('/') + '/',
        { status: [502, 504] }
      );
    }
    await call('/api/me/profile-follows', {
      method: 'PUT',
      key: randomUUID(),
      body: approval,
      status: [502, 504],
    });
    await call(badgePath, {
      user: staff,
      method: 'PUT',
      key: badgeKey,
      body: badgeCommand,
      status: [502, 504],
    });
    await call('/api/me/articles', { status: [502, 503, 504] });
    await service('start', 'catalog-bff');
    await ready();
    await service('stop', 'account-management');
    const failure = await call(base, { user: null, status: 503 });
    assert.equal(failure.response.headers.get('retry-after'), '2');
    await call('/api/me/profile-follows', {
      method: 'PUT',
      key: approvalKey,
      body: approval,
      status: 503,
    });
    await service('start', 'account-management');
    await ready();
    assert.equal(
      (await call(base, { user: follower })).value.follow.status,
      'approved'
    );
    assert.deepEqual(
      (await call(photoPath, { user: follower, binary: true })).value,
      photo.value
    );
    assert.deepEqual(
      (
        await call('/api/me/profile-follows', {
          method: 'PUT',
          key: approvalKey,
          body: approval,
        })
      ).value,
      approved
    );
    assert.equal(
      (await call('/api/me/badges')).value.items[0].kind,
      'verified'
    );
    pass(
      'all public/private profile routes and commands require BFF; Account outage fails explicitly and restarts preserve photo/follow/badge state'
    );

    await call('/api/me/profile-follows', {
      method: 'PUT',
      key: randomUUID(),
      body: {
        ...command,
        expectedRevision: approved.revision,
        action: 'remove',
      },
    });
    assert.deepEqual(
      (
        await call('/api/me/profile-follows', {
          method: 'PUT',
          key: approvalKey,
          body: approval,
        })
      ).value,
      approved
    );
    assert.equal((await call(base, { user: follower })).value.profile, null);
    await call(photoPath, { user: follower, status: 404 });
    await call(badgePath, {
      user: staff,
      method: 'PUT',
      key: randomUUID(),
      body: {
        ...badgeCommand,
        expectedRevision: award.revision,
        action: 'revoke',
        reason: 'Qualification complete; revoke test award',
      },
    });
    assert.deepEqual(
      (
        await call(badgePath, {
          user: staff,
          method: 'PUT',
          key: badgeKey,
          body: badgeCommand,
        })
      ).value,
      award
    );
    assert.deepEqual((await call('/api/me/badges')).value.items, []);
    await preferences((value) => {
      value.privacy.profileVisibility = 'private';
    });
    for (const path of [
      base,
      photoPath,
      ...[
        'favorites',
        'suites',
        'articles',
        'discussions',
        'activity',
        'totals',
        'badges',
      ].map((section) => base + '/' + section),
    ])
      await call(path, { user: follower, status: 404 });
    assert.equal((await call(base)).value.isOwner, true);
    assert.deepEqual(
      (await call('/api/me/profile', { user: staff })).value,
      staffBefore
    );
    pass(
      'follow removal, private visibility and badge revocation take effect immediately; historical retries cannot restore access or badges'
    );
  } catch (error) {
    failure = error;
  } finally {
    for (const name of [...stopped]) {
      try {
        await service('start', name);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (topic) {
      try {
        const current = await until(
          () => call(topicBase + '/' + topic.id).then((result) => result.value),
          (value) => value?.id === topic.id,
          'Cleanup topic unavailable'
        );
        await call(topicBase + '/' + topic.id, {
          method: 'DELETE',
          key: randomUUID(),
          body: { expectedRevision: current.revision },
        });
        topicRemoved = true;
        persist();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    for (const user of [...users].reverse()) {
      if (!user.uid) continue;
      try {
        await call('/api/me', { user, method: 'DELETE', status: 202 });
        erased.push(user.uid);
        persist();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }
  if (failure || cleanupErrors.length)
    throw new AggregateError(
      [...(failure ? [failure] : []), ...cleanupErrors],
      cleanupErrors.length
        ? 'Qualification cleanup incomplete; use retained recovery records'
        : 'Profile qualification failed'
    );
  pass(
    'temporary topic removed and erasure accepted only for the three new accounts; existing staff profile preserved'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
