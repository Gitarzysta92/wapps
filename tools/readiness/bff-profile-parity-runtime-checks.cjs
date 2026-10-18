const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { request } = require('node:http');
const sharp = require('sharp');
const { profileParityContent } = require('./profile-parity-content.cjs');

function readWithBody(url, token, framing) {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          [framing]: framing === 'Content-Length' ? '2' : 'chunked',
        },
        signal: AbortSignal.timeout(20000),
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

async function qualifyPublicProfiles({
  call,
  origins,
  input,
  source,
  operator,
  scoped,
  services,
  ingressSecret,
  credentials,
  subjectFor,
  restartAccount,
  restartBff,
  stopBff,
  pausePolicy,
  resumePolicy,
}) {
  const [local, alpha] = origins;
  const users = [];
  for (const name of [
    'owner',
    'follower',
    'stranger',
    'badge-manager',
    'identity-admin',
  ]) {
    const member = await call('/auth/register', {
      at: local,
      headers: { 'Idempotency-Key': 'profiles-' + name },
      body: {
        ...input,
        email: `profiles-${name}@example.test`,
        nickname: 'Profile ' + name,
      },
    });
    member.publicId = (
      await call('/api/me/profile', { at: local, token: member.token })
    ).publicId;
    if (['badge-manager', 'identity-admin'].includes(name)) {
      await credentials.setOperatorClaims(await subjectFor(member.uid), {
        roles: [
          name === 'identity-admin'
            ? 'identity:admin'
            : 'identity:badge-manager',
        ],
      });
      Object.assign(
        member,
        await call('/auth/signin', {
          at: local,
          body: {
            email: `profiles-${name}@example.test`,
            password: input.password,
          },
        })
      );
    }
    users.push(member);
  }
  const [owner, follower, stranger, manager, identityAdmin] = users;
  // The Identity administrator role intentionally does not imply global badge authority.
  const run = (path, options = {}) => call(path, { at: local, ...options });
  const own = (path, options = {}) =>
    run(path, { token: owner.token, ...options });
  const command = (path, actor, body, key = randomUUID(), options = {}) =>
    run(path, {
      token: actor.token,
      method: 'PUT',
      body,
      headers: { 'Idempotency-Key': key },
      ...options,
    });
  const preferences = async (change) => {
    const current = await own('/api/me/preferences');
    change(current.preferences.privacy);
    await command('/api/me/preferences', owner, {
      expectedRevision: current.revision,
      preferences: current.preferences,
    });
  };
  const sharing = [
    'showFavorites',
    'showSuites',
    'showDiscussions',
    'showActivityHistory',
    'showBadges',
  ];
  const initial = await own('/api/me/profile');
  await command('/api/me/profile', owner, {
    expectedRevision: initial.revision,
    name: 'Profile Owner',
    bio: 'Shared content qualification',
    location: 'Warsaw',
    socialLinks: {},
    contactEmail: 'public-contact@example.test',
  });
  await preferences((privacy) => {
    privacy.profileVisibility = 'public';
    privacy.showEmail = true;
    for (const field of sharing) privacy[field] = true;
  });
  const base = '/api/profiles/' + owner.publicId,
    badges = '/api/admin/profile-badges/' + owner.publicId;
  const image = await sharp({
    create: { width: 40, height: 32, channels: 3, background: '#24778a' },
  })
    .png()
    .toBuffer();
  const upload = await fetch(local + '/api/me/profile/avatar', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${owner.token}`,
      'Content-Type': 'image/png',
      'Idempotency-Key': randomUUID(),
      'If-Match': `"${(await own('/api/me/profile')).revision}"`,
      'X-Avatar-Bytes': String(image.length),
      'X-Avatar-Sha256': createHash('sha256').update(image).digest('hex'),
    },
    body: image,
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(upload.status, 200, await upload.text());
  const avatarId = (await own('/api/me/profile')).profile.avatarId;
  const photo = base + '/avatar/' + avatarId;
  async function photoRead(at, token, status = 200, route = photo) {
    const response = await fetch(at + route, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, status, route);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (status === 200) {
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('vary'), 'Authorization');
      assert.equal(response.headers.get('content-type'), 'image/webp');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.match(response.headers.get('content-security-policy'), /sandbox/);
      assert.equal((await sharp(bytes).metadata()).format, 'webp');
    }
    return bytes;
  }
  const content = await profileParityContent({
    call,
    at: local,
    owner,
    operator,
    services,
    ingressSecret,
  });
  const sections = [
    'favorites',
    'suites',
    'articles',
    'discussions',
    'activity',
  ];
  const paths = [
    '/api/profiles',
    base,
    photo,
    ...[...sections, 'totals', 'badges'].map((section) => base + '/' + section),
    '/api/me/profile-follows',
    '/api/me/profile-follows/outgoing',
    '/api/me/totals',
    '/api/me/badges',
    '/api/admin/profile-badges',
    badges,
  ];
  const privatePaths = paths.filter(
    (path) => !path.startsWith('/api/profiles')
  );
  const variants = (path) => [
    path,
    path + '/',
    path
      .split('/')
      .map((part) => (/^[0-9a-f-]{36}$/.test(part) ? part : part.toUpperCase()))
      .join('/') + '/',
  ];
  const unknown = [
    '/api/profiles/unknown/nested',
    base + '/unknown',
    photo + '/nested',
    '/api/me/profile-follows/unknown',
    '/api/me/totals/unknown',
    '/api/me/badges/unknown',
    '/api/admin/profile-badges/unknown/nested',
  ];
  const directory = async (at) => {
    const all = [];
    let after = null;
    for (let page = 0; page < 20; page++) {
      const result = await run(
        '/api/profiles' + (after ? '?after=' + after : ''),
        { at }
      );
      assert(result.profiles.every((item) => item.contactEmail === null));
      all.push(...result.profiles);
      if (result.after === null) return all;
      assert(result.after > (after ?? ''));
      after = result.after;
    }
    throw new Error('Directory pagination exceeded bound');
  };
  for (const at of origins) {
    assert((await directory(at)).some((item) => item.id === owner.publicId));
    const view = await run(base, { at });
    assert.equal(view.profile.contactEmail, 'public-contact@example.test');
    assert.equal(view.isOwner, false);
    assert(!JSON.stringify(view).includes('profiles-owner@example.test'));
    const spoofed = await run(base, {
      at,
      headers: {
        'X-User-Id': owner.uid,
        'X-Ingress-Auth': ingressSecret,
        'X-User-Claims': '{"roles":["admin"]}',
      },
    });
    assert.deepEqual(spoofed, view);
    await run(base, { at, token: 'invalid', status: 401 });
    for (const path of privatePaths) await run(path, { at, status: 401 });
    for (const path of paths) {
      for (const variant of variants(path)) {
        if (path === photo) await photoRead(at, undefined, 200, variant);
        else
          await run(variant, {
            at,
            token: path.startsWith('/api/admin/')
              ? operator.token
              : owner.token,
          });
      }
      await run(path + '?unexpected=value', {
        at,
        token: operator.token,
        status: 400,
      });
      for (const framing of ['Content-Length', 'Transfer-Encoding'])
        assert.equal(
          await readWithBody(at + path, operator.token, framing),
          400,
          path
        );
      await run(path, {
        at,
        token: operator.token,
        method: 'POST',
        body: {},
        status: 404,
      });
    }
    for (const path of unknown)
      for (const variant of variants(path))
        await run(variant, { at, token: operator.token, status: 404 });
    for (const path of [
      '/api/profiles/not-a-uuid',
      '/api/profiles/' + owner.publicId.toUpperCase(),
      base + '/avatar/invalid',
      '/api/admin/profile-badges/not-a-uuid',
    ])
      await run(path, { at, token: operator.token, status: 400 });
    for (const path of [
      '/api/profiles',
      ...sections.map((section) => base + '/' + section),
      '/api/me/profile-follows',
      '/api/me/profile-follows/outgoing',
      badges,
    ]) {
      await run(path + '?after=invalid', {
        at,
        token: operator.token,
        status: 400,
      });
      await run(path + '?after=a&after=b', {
        at,
        token: operator.token,
        status: 400,
      });
    }
    await photoRead(
      at,
      undefined,
      404,
      `/api/profiles/${stranger.publicId}/avatar/${avatarId}`
    );
    for (const [section, id] of Object.entries(content.ids)) {
      const result = await run(base + '/' + section, { at });
      assert.equal(result.sharing, 'visible');
      assert(
        result.items.some((item) => item.id === id),
        section + ': ' + JSON.stringify(result)
      );
    }
    assert((await run(base + '/activity', { at })).items.length >= 4);
    assert.deepEqual(await run(base + '/totals', { at }), {
      favorites: 1,
      suites: 1,
      articles: 1,
      discussions: 1,
    });
    assert.deepEqual(
      await own('/api/me/totals', { at }),
      await run(base + '/totals', { at })
    );
  }
  console.log(
    'PASS profiles on both gateways: all explicit routes, case/slash variants, trusted anonymous access, input/body/method rejection, contacts, scoped WebP, and nonempty real Editorial/Community content after truthful projection lag'
  );

  for (const [field, hidden] of [
    ['showFavorites', ['favorites']],
    ['showSuites', ['suites']],
    ['showDiscussions', ['discussions']],
    ['showActivityHistory', ['articles', 'activity']],
    ['showBadges', ['badges']],
  ]) {
    await preferences((privacy) => {
      privacy[field] = false;
    });
    for (const at of origins) {
      for (const section of [...sections, 'badges'])
        assert.equal(
          (await run(base + '/' + section, { at })).sharing,
          hidden.includes(section) ? 'hidden' : 'visible',
          `${field}: ${section}`
        );
      const totals = await run(base + '/totals', { at });
      for (const section of ['favorites', 'suites', 'articles', 'discussions'])
        assert.equal(
          totals[section],
          hidden.includes(section) ? null : 1,
          `${field}: ${section} total`
        );
    }
    await preferences((privacy) => {
      privacy[field] = true;
    });
  }
  await preferences((privacy) => {
    privacy.showEmail = false;
    for (const field of sharing) privacy[field] = false;
  });
  for (const at of origins) {
    assert.equal((await run(base, { at })).profile.contactEmail, null);
    for (const section of sections)
      assert.deepEqual(await run(base + '/' + section, { at }), {
        sharing: 'hidden',
        items: [],
        after: null,
      });
    assert.deepEqual(await run(base + '/totals', { at }), {
      favorites: null,
      suites: null,
      articles: null,
      discussions: null,
    });
    assert.deepEqual(await run(base + '/badges', { at }), {
      sharing: 'hidden',
      items: [],
    });
  }
  await preferences((privacy) => {
    privacy.profileVisibility = 'followers';
    privacy.showEmail = true;
    for (const field of sharing) privacy[field] = true;
  });
  for (const at of origins) {
    assert.equal((await run(base, { at })).access, 'followers');
    assert.equal(
      (await run(base, { at, token: follower.token })).profile,
      null
    );
    assert(!(await directory(at)).some((item) => item.id === owner.publicId));
    await photoRead(at, follower.token, 404);
  }
  const durable = async () => {
    const counts = await source.query(`SELECT
      (SELECT COUNT(*) FROM identity_profile_follow_commands) AS follows,
      (SELECT COUNT(*) FROM identity_profile_badge_events) AS badges,
      (SELECT COUNT(*) FROM identity_events_outbox) AS events`);
    const revisions = await source.query(
      'SELECT id, revision FROM identities ORDER BY id'
    );
    const follows = await source.query(
      'SELECT * FROM identity_profile_follows ORDER BY ownerId, requesterId'
    );
    const badges = await source.query(
      'SELECT * FROM identity_profile_badges ORDER BY ownerId, kind'
    );
    return { counts, revisions, follows, badges };
  };
  const rollback = async (work) => {
    const before = await durable();
    await source.query(
      "CREATE TRIGGER fail_profile_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'profile qualification rollback'"
    );
    try {
      await work();
      assert.deepEqual(await durable(), before);
    } finally {
      await source.query('DROP TRIGGER fail_profile_outbox');
    }
  };
  const followPath = '/api/me/profile-follows';
  const follow = {
    ownerId: owner.publicId,
    requesterId: follower.publicId,
    expectedRevision: 0,
    action: 'request',
  };
  const followKey = randomUUID();
  await rollback(() =>
    command(followPath, follower, follow, followKey, { status: 503 })
  );
  const requested = await Promise.all(
    origins.map((at) =>
      command(followPath, follower, follow, followKey, { at })
    )
  );
  assert.deepEqual(requested[0], requested[1]);
  assert.equal(requested[0].status, 'pending');
  for (const at of origins) {
    await command(followPath, follower, follow, randomUUID(), {
      at,
      status: 409,
    });
    await command(
      followPath,
      follower,
      { ...follow, action: 'cancel' },
      followKey,
      { at, status: 409 }
    );
    await command(followPath, stranger, follow, randomUUID(), {
      at,
      status: 403,
    });
    assert.equal(
      (await own(followPath, { at })).followers[0].requesterId,
      follower.publicId
    );
    assert.equal(
      (await run(followPath + '/outgoing', { at, token: follower.token }))
        .following[0].ownerId,
      owner.publicId
    );
  }
  const approval = { ...follow, expectedRevision: 1, action: 'approve' },
    approvalKey = randomUUID();
  await command(followPath, follower, approval, randomUUID(), { status: 403 });
  const approved = await command(followPath, owner, approval, approvalKey, {
    at: alpha,
  });
  assert.equal(approved.status, 'approved');
  for (const at of origins) {
    assert.deepEqual(
      await command(followPath, owner, approval, approvalKey, { at }),
      approved
    );
    assert.equal(
      (await run(base, { at, token: follower.token })).profile.contactEmail,
      'public-contact@example.test'
    );
    await photoRead(at, follower.token);
    await photoRead(at, stranger.token, 404);
    for (const section of sections)
      assert.equal(
        (await run(base + '/' + section, { at, token: follower.token }))
          .sharing,
        'visible'
      );
  }

  const award = {
      expectedRevision: 0,
      kind: 'verified',
      action: 'award',
      reason: 'Evidence reviewed by global staff',
    },
    awardKey = randomUUID();
  for (const at of origins) {
    for (const actor of [owner, stranger, scoped, identityAdmin]) {
      await run('/api/admin/profile-badges', {
        at,
        token: actor.token,
        status: 403,
      });
      await run(badges, { at, token: actor.token, status: 403 });
      await command(badges, actor, award, randomUUID(), { at, status: 403 });
    }
    assert.deepEqual(
      (await run('/api/admin/profile-badges', { at, token: manager.token }))
        .kinds,
      ['verified', 'premium']
    );
    for (const [path, body, actor] of [
      [followPath, follow, follower],
      [badges, award, manager],
    ]) {
      await run(path, {
        at,
        token: actor.token,
        method: 'PUT',
        body,
        status: 400,
      });
      await command(path, actor, { ...body, extra: true }, randomUUID(), {
        at,
        status: 400,
      });
      await command(path, actor, { padding: 'x'.repeat(65536) }, randomUUID(), {
        at,
        status: 413,
      });
    }
  }
  await rollback(() =>
    command(badges, manager, award, awardKey, { at: alpha, status: 503 })
  );
  const awarded = await Promise.all(
    origins.map((at) => command(badges, manager, award, awardKey, { at }))
  );
  assert.deepEqual(awarded[0], awarded[1]);
  assert.equal(awarded[0].actorId, manager.publicId);
  for (const at of origins) {
    await command(badges, operator, award, randomUUID(), { at, status: 409 });
    await command(
      badges,
      manager,
      { ...award, reason: 'Changed intent' },
      awardKey,
      { at, status: 409 }
    );
    assert.equal(
      (await run(base + '/badges', { at, token: follower.token })).items[0]
        .kind,
      'verified'
    );
    assert.equal(
      (await own('/api/me/badges', { at })).items[0].kind,
      'verified'
    );
    const history = await run(badges, { at, token: operator.token });
    assert.equal(history.events[0].reason, award.reason);
    assert.deepEqual(
      (await run(badges + '?after=1', { at, token: operator.token })).events,
      []
    );
  }
  console.log(
    'PASS follows and global badge commands on both gateways: real OPA denial, independent owner approval, SQL/outbox rollback, concurrent exact receipts, key conflicts, stale revisions and durable audit history'
  );

  await restartAccount();
  await restartBff();
  await services.restartEditorial();
  await services.restartDiscussion();
  for (const at of origins) {
    assert.deepEqual(
      await command(followPath, owner, approval, approvalKey, { at }),
      approved
    );
    assert.deepEqual(
      await command(badges, manager, award, awardKey, { at }),
      awarded[0]
    );
    assert.equal(
      (await run(base, { at, token: follower.token })).profile.id,
      owner.publicId
    );
    await photoRead(at, follower.token);
    assert.equal(
      (await run(base + '/suites', { at, token: follower.token })).items[0].id,
      content.ids.suites
    );
  }
  await pausePolicy();
  try {
    for (const at of origins) {
      await run(base, { at, token: follower.token, status: 503 });
      await run(badges, { at, token: operator.token, status: 503 });
      await command(badges, manager, award, awardKey, { at, status: 503 });
    }
  } finally {
    await resumePolicy();
  }
  await services.stopEditorial();
  try {
    for (const at of origins)
      for (const section of ['suites', 'articles', 'activity', 'totals'])
        await run(base + '/' + section, {
          at,
          token: follower.token,
          status: 503,
        });
  } finally {
    await services.restartEditorial();
  }
  await services.stopDiscussion();
  try {
    for (const at of origins)
      for (const section of ['discussions', 'activity', 'totals'])
        await run(base + '/' + section, {
          at,
          token: follower.token,
          status: 503,
        });
  } finally {
    await services.restartDiscussion();
  }
  await stopBff();
  try {
    for (const at of origins) {
      for (const path of [...paths, ...unknown])
        for (const variant of variants(path))
          await run(variant, { at, token: operator.token, status: 502 });
      await command(followPath, owner, approval, approvalKey, {
        at,
        status: 502,
      });
      await command(badges, manager, award, awardKey, { at, status: 502 });
    }
  } finally {
    await restartBff();
  }
  console.log(
    'PASS independent process restart persistence and fail-closed policy/source outages; every profile/follow/badge family and malformed suffix fails with BFF stopped on both gateways'
  );

  await command(
    followPath,
    owner,
    { ...follow, expectedRevision: 2, action: 'remove' },
    randomUUID(),
    { at: alpha }
  );
  await command(badges, operator, {
    ...award,
    expectedRevision: 1,
    action: 'revoke',
    reason: 'Evidence withdrawn',
  });
  for (const at of origins) {
    assert.deepEqual(
      await command(followPath, owner, approval, approvalKey, { at }),
      approved
    );
    assert.deepEqual(
      await command(badges, manager, award, awardKey, { at }),
      awarded[0]
    );
    assert.equal(
      (await run(base, { at, token: follower.token })).profile,
      null
    );
    await photoRead(at, follower.token, 404);
    for (const section of [...sections, 'totals', 'badges'])
      await run(base + '/' + section, {
        at,
        token: follower.token,
        status: 404,
      });
    assert.deepEqual((await own('/api/me/badges', { at })).items, []);
    assert.deepEqual((await own(followPath, { at })).followers, []);
  }
  const again = await command(followPath, follower, {
    ...follow,
    expectedRevision: 3,
  });
  assert.equal(again.status, 'pending');
  await command(
    followPath,
    follower,
    { ...follow, expectedRevision: 4, action: 'cancel' },
    randomUUID(),
    { at: alpha }
  );
  assert.deepEqual(
    (await run(followPath + '/outgoing', { token: follower.token })).following,
    []
  );
  await preferences((privacy) => {
    privacy.profileVisibility = 'private';
  });
  for (const at of origins) {
    for (const path of [
      base,
      ...sections.map((section) => base + '/' + section),
      base + '/totals',
      base + '/badges',
    ])
      await run(path, { at, token: follower.token, status: 404 });
    await photoRead(at, follower.token, 404);
    assert.equal((await own(base, { at })).isOwner, true);
  }
  await preferences((privacy) => {
    privacy.profileVisibility = 'public';
  });
  await content.withdraw();
  for (const at of origins) {
    for (const section of sections)
      assert.deepEqual((await run(base + '/' + section, { at })).items, []);
    assert.deepEqual(await run(base + '/totals', { at }), {
      favorites: 0,
      suites: 0,
      articles: 0,
      discussions: 0,
    });
  }
  console.log(
    'PASS sharing switches, private/follower access, immediate follow and badge revocation, non-resurrecting historical replay, requester cancellation and source withdrawal against retained projections'
  );
}

module.exports = { qualifyPublicProfiles };
