const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { request } = require('node:http');
const sharp = require('sharp');

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

// Only invoked with the disposable local-auth qualifier's stores and processes.
async function qualifyAccountSettings({
  call,
  origins,
  input,
  source,
  identities,
  ingressSecret,
  restartAccount,
  restartBff,
  stopBff,
  pausePolicy,
  resumePolicy,
}) {
  const fixtures = [];
  const paths = ['/api/me', '/api/me/profile', '/api/me/preferences'];
  const unknownPaths = [
    '/api/me/unknown',
    '/api/me/profile/unknown',
    '/api/me/preferences/unknown',
    '/api/me/profile/avatar/invalid/nested',
  ];
  const variants = (path) => [path, path + '/', path.toUpperCase() + '/'];
  const photo = await sharp({
    create: { width: 64, height: 48, channels: 4, background: '#126b83' },
  })
    .png()
    .toBuffer();
  const photoHeaders = {
    'Content-Type': 'image/png',
    'X-Avatar-Bytes': String(photo.length),
    'X-Avatar-Sha256': createHash('sha256').update(photo).digest('hex'),
  };
  const counts = async (uid) => {
    const [row] = await source.query(
      `SELECT
      (SELECT COUNT(*) FROM identity_account_commands WHERE identityId = ?) AS commands,
      (SELECT COUNT(*) FROM identity_events_outbox WHERE identityId = ?) AS events`,
      [uid, uid]
    );
    return { commands: Number(row.commands), events: Number(row.events) };
  };
  const upload = async (at, token, revision, key, status = 200) => {
    const response = await fetch(at + '/api/me/profile/avatar', {
      method: 'PUT',
      headers: {
        ...photoHeaders,
        Authorization: `Bearer ${token}`,
        'If-Match': `"${revision}"`,
        'Idempotency-Key': key,
      },
      body: photo,
      signal: AbortSignal.timeout(20000),
    });
    const value = await response.json();
    assert.equal(response.status, status, JSON.stringify(value));
    assert.match(response.headers.get('cache-control'), /no-store/);
    return value;
  };
  const readPhoto = async (at, token, avatarId) => {
    const response = await fetch(at + '/api/me/profile/avatar/' + avatarId, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const bytes = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 64);
    assert.equal(metadata.height, 48);
    return bytes;
  };

  for (const [index, at] of origins.entries()) {
    const email = `settings-${index}@example.test`;
    const member = await call('/auth/register', {
      at,
      body: { ...input, email },
      headers: { 'Idempotency-Key': `settings-${index}` },
    });
    const other = await call('/auth/register', {
      at,
      body: { ...input, email: `settings-other-${index}@example.test` },
      headers: { 'Idempotency-Key': `settings-other-${index}` },
    });
    const session = await call('/auth/signin', {
      at,
      body: { email, password: input.password },
    });
    assert.equal(session.uid, member.uid);
    const run = (path, options = {}) =>
      call(path, { at, token: member.token, ...options });
    const initialProfile = await run('/api/me/profile');
    const initialPreferences = await run('/api/me/preferences');
    const otherProfile = await run('/api/me/profile', { token: other.token });
    const otherPreferences = await run('/api/me/preferences', {
      token: other.token,
    });
    assert.equal(initialProfile.revision, initialPreferences.revision);
    const forged = {
      'X-User-Id': other.uid,
      'X-User-Email': 'other@example.test',
      'X-User-Claims': JSON.stringify({
        roles: ['admin'],
        tenantId: 'foreign',
      }),
      'X-Ingress-Auth': ingressSecret,
    };
    for (const path of paths) {
      for (const variant of variants(path)) {
        const response = await fetch(at + variant, {
          headers: { Authorization: `Bearer ${member.token}` },
          signal: AbortSignal.timeout(20000),
        });
        assert.equal(response.status, 200, variant);
        assert.match(response.headers.get('cache-control'), /no-store/);
        assert.equal((await response.json()).identityId, member.uid);
      }
      assert.equal(
        (await run(path, { headers: forged })).identityId,
        member.uid
      );
      await run(path, { token: undefined, headers: forged, status: 401 });
      await run(path, { token: 'invalid', status: 401 });
      for (const selector of ['identityId', 'tenantId'])
        await run(path + `?${selector}=${other.uid}`, { status: 400 });
      for (const framing of ['Content-Length', 'Transfer-Encoding'])
        assert.equal(await readWithBody(at + path, member.token, framing), 400);
      await run(path, { method: 'PATCH', body: {}, status: 404 });
    }
    for (const path of unknownPaths)
      for (const variant of variants(path)) await run(variant, { status: 404 });
    for (const id of ['invalid', '%2F', '%252F'])
      await run('/api/me/profile/avatar/' + id, { status: 400 });
    for (const path of ['/api/me/profile', '/api/me/preferences']) {
      await run(path, { method: 'PUT', body: {}, status: 400 });
      await run(path, {
        method: 'PUT',
        body: { padding: 'x'.repeat(65536) },
        headers: { 'Idempotency-Key': 'too-large' },
        status: 413,
      });
    }

    const profileChange = {
      expectedRevision: initialProfile.revision,
      name: `Settings Member ${index}`,
      bio: 'Durable private profile',
      location: 'Warsaw',
      contactEmail: `contact-${index}@example.test`,
      socialLinks: { github: `member${index}` },
    };
    const preferenceChange = {
      expectedRevision: initialPreferences.revision,
      preferences: structuredClone(initialPreferences.preferences),
    };
    preferenceChange.preferences.display.theme = 'dark';
    for (const [path, body] of [
      ['/api/me/profile', profileChange],
      ['/api/me/preferences', preferenceChange],
    ]) {
      await run(path, {
        method: 'PUT',
        body: { ...body, identityId: other.uid },
        headers: { 'Idempotency-Key': 'forged-target' },
        status: 400,
      });
    }
    console.log(
      `PASS account settings gateway ${index}: canonical/case/slash reads, private responses, forged context, selectors, malformed paths, GET bodies, methods and size limits`
    );

    const startCounts = await counts(member.uid);
    for (const [path, body] of [
      ['/api/me/profile', profileChange],
      ['/api/me/preferences', preferenceChange],
    ]) {
      await source.query(
        "CREATE TRIGGER fail_settings_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'settings qualification rollback'"
      );
      try {
        await run(path, {
          method: 'PUT',
          body,
          headers: { 'Idempotency-Key': 'settings-first' },
          status: 503,
        });
        assert.deepEqual(await run('/api/me/profile'), initialProfile);
        assert.deepEqual(await run('/api/me/preferences'), initialPreferences);
        assert.deepEqual(await counts(member.uid), startCounts);
      } finally {
        await source.query('DROP TRIGGER fail_settings_outbox');
      }
    }
    const putProfile = (options = {}) =>
      run('/api/me/profile', {
        method: 'PUT',
        body: profileChange,
        headers: { 'Idempotency-Key': 'settings-first' },
        ...options,
      });
    const receipts = await Promise.all([
      putProfile(),
      putProfile({ token: session.token }),
    ]);
    assert.deepEqual(
      receipts,
      Array(2).fill({
        identityId: member.uid,
        revision: profileChange.expectedRevision + 1,
      })
    );
    assert.deepEqual(await counts(member.uid), {
      commands: startCounts.commands + 1,
      events: startCounts.events + 1,
    });
    await putProfile({
      body: { ...profileChange, name: 'Different intent' },
      status: 409,
    });
    const putPreferences = (body, key, status = 200) =>
      run('/api/me/preferences', {
        method: 'PUT',
        body,
        headers: { 'Idempotency-Key': key },
        status,
      });
    await putPreferences(preferenceChange, 'stale-preferences', 409);
    await putPreferences(preferenceChange, 'settings-first', 409);
    preferenceChange.expectedRevision = receipts[0].revision;
    const preferenceReceipt = await putPreferences(
      preferenceChange,
      'settings-preferences'
    );
    assert.equal(preferenceReceipt.revision, receipts[0].revision + 1);
    const savedPreferences = await run('/api/me/preferences');
    assert.equal(savedPreferences.preferences.display.theme, 'dark');
    assert.deepEqual(await putProfile(), receipts[0]);
    assert.deepEqual(await run('/api/me/preferences'), savedPreferences);
    const competing = await Promise.all(
      ['a', 'b'].map((key) =>
        fetch(at + '/api/me/preferences', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${member.token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `competing-${key}`,
          },
          body: JSON.stringify({
            ...preferenceChange,
            expectedRevision: preferenceReceipt.revision,
          }),
          signal: AbortSignal.timeout(20000),
        })
      )
    );
    assert.deepEqual(
      competing.map((response) => response.status).sort(),
      [200, 409]
    );
    await Promise.all(competing.map((response) => response.arrayBuffer()));
    assert.deepEqual(await counts(member.uid), {
      commands: startCounts.commands + 3,
      events: startCounts.events + 3,
    });
    assert.deepEqual(
      await putPreferences(preferenceChange, 'settings-preferences'),
      preferenceReceipt
    );
    console.log(
      `PASS account settings gateway ${index}: real SQL outbox rollback, concurrent and historical receipts, shared profile/preferences revision conflicts and independent sessions`
    );

    const beforePhoto = await run('/api/me/profile');
    for (const [headers, body, expected] of [
      [{ ...photoHeaders, 'Content-Type': 'text/plain' }, photo, 415],
      [{ ...photoHeaders, 'X-Avatar-Sha256': '0'.repeat(64) }, photo, 400],
      [
        { ...photoHeaders, 'X-Avatar-Bytes': String(2 * 1024 * 1024 + 1) },
        Buffer.alloc(2 * 1024 * 1024 + 1),
        413,
      ],
    ]) {
      const response = await fetch(at + '/api/me/profile/avatar', {
        method: 'PUT',
        headers: {
          ...headers,
          Authorization: `Bearer ${member.token}`,
          'If-Match': `"${beforePhoto.revision}"`,
          'Idempotency-Key': 'invalid-photo',
        },
        body,
        signal: AbortSignal.timeout(20000),
      });
      await response.arrayBuffer();
      assert.equal(response.status, expected);
    }
    assert.deepEqual(await run('/api/me/profile'), beforePhoto);
    const photoReceipt = await upload(
      at,
      member.token,
      beforePhoto.revision,
      'settings-photo'
    );
    assert.equal(photoReceipt.revision, beforePhoto.revision + 1);
    assert.deepEqual(
      await upload(at, member.token, beforePhoto.revision, 'settings-photo'),
      photoReceipt
    );
    const savedProfile = await run('/api/me/profile');
    assert(savedProfile.profile.avatarId);
    const bytes = await readPhoto(
      at,
      session.token,
      savedProfile.profile.avatarId
    );
    await run('/api/me/profile/avatar/' + savedProfile.profile.avatarId, {
      token: other.token,
      status: 403,
    });
    await run(
      '/api/me/profile/avatar/' +
        savedProfile.profile.avatarId +
        '?identityId=' +
        member.uid,
      { token: other.token, status: 400 }
    );
    assert.equal(
      await readWithBody(
        at + '/api/me/profile/avatar/' + savedProfile.profile.avatarId,
        member.token,
        'Content-Length'
      ),
      400
    );
    const [stored] = await source.query(
      'SELECT id, payload FROM identity_profile_avatars WHERE identityId = ?',
      [member.uid]
    );
    assert.equal(stored.id, savedProfile.profile.avatarId);
    assert.deepEqual(stored.payload, bytes);
    assert.deepEqual(
      await run('/api/me/profile', { token: other.token }),
      otherProfile
    );
    assert.deepEqual(
      await run('/api/me/preferences', { token: other.token }),
      otherPreferences
    );
    fixtures.push({
      at,
      member,
      session,
      run,
      profile: savedProfile,
      preferences: await run('/api/me/preferences'),
      bytes,
    });
  }

  await restartAccount();
  await restartBff();
  for (const fixture of fixtures) {
    const { at, member, session, run, profile, preferences, bytes } = fixture;
    assert.deepEqual(
      await run('/api/me/profile', { token: session.token }),
      profile
    );
    assert.deepEqual(
      await run('/api/me/preferences', { token: session.token }),
      preferences
    );
    assert.deepEqual(
      await readPhoto(at, member.token, profile.profile.avatarId),
      bytes
    );
  }
  console.log(
    'PASS account settings: profile, preferences and real PNG-to-WebP SQL avatars survive independent Account/BFF process restarts'
  );

  await pausePolicy();
  try {
    for (const { run, profile, preferences } of fixtures) {
      await run('/api/me/profile', { status: 503 });
      await run('/api/me/preferences', { status: 503 });
      await run('/api/me/profile/avatar/' + profile.profile.avatarId, {
        status: 503,
      });
      await run('/api/me/preferences', {
        method: 'PUT',
        body: {
          expectedRevision: preferences.revision,
          preferences: preferences.preferences,
        },
        headers: { 'Idempotency-Key': 'policy-outage' },
        status: 503,
      });
    }
  } finally {
    await resumePolicy();
  }
  // Leave real Identity available for ingress validation; only BFF's owner binding fails.
  await restartBff({ ACCOUNT_MANAGEMENT_URL: 'http://127.0.0.1:1' });
  try {
    for (const { at, member, run, profile, preferences } of fixtures) {
      for (const path of [
        ...paths,
        '/api/me/profile/avatar/' + profile.profile.avatarId,
      ])
        await run(path, { status: 503 });
      await run('/api/me/profile', {
        method: 'PUT',
        body: {
          expectedRevision: profile.revision,
          ...profile.profile,
          avatarUri: undefined,
          avatarId: undefined,
        },
        headers: { 'Idempotency-Key': 'owner-outage-profile' },
        status: 503,
      });
      await run('/api/me/preferences', {
        method: 'PUT',
        body: {
          expectedRevision: preferences.revision,
          preferences: preferences.preferences,
        },
        headers: { 'Idempotency-Key': 'owner-outage-preferences' },
        status: 503,
      });
      await upload(
        at,
        member.token,
        profile.revision,
        'owner-outage-photo',
        503
      );
      await run('/api/me/profile/avatar', {
        method: 'DELETE',
        headers: {
          'If-Match': `"${profile.revision}"`,
          'Idempotency-Key': 'owner-outage-remove',
        },
        status: 503,
      });
      await run('/api/me', { method: 'DELETE', status: 503 });
    }
  } finally {
    await restartBff();
  }
  for (const { run, profile, preferences } of fixtures) {
    assert.deepEqual(await run('/api/me/profile'), profile);
    assert.deepEqual(await run('/api/me/preferences'), preferences);
  }
  console.log(
    'PASS account settings: real OPA outage and unavailable BFF Account binding fail closed for both gateways without changing saved state'
  );

  await stopBff();
  try {
    for (const { run, profile } of fixtures) {
      for (const path of [
        ...paths,
        ...unknownPaths,
        '/api/me/profile/avatar/' + profile.profile.avatarId,
      ])
        for (const variant of variants(path))
          await run(variant, { status: 502 });
      for (const [path, method] of [
        ['/api/me', 'DELETE'],
        ['/api/me/profile', 'PUT'],
        ['/api/me/preferences', 'PUT'],
        ['/api/me/profile/avatar', 'PUT'],
        ['/api/me/profile/avatar', 'DELETE'],
      ])
        await run(path, { method, status: 502 });
    }
  } finally {
    await restartBff();
  }
  console.log(
    'PASS account settings: both gateways require BFF for reads, writes, photos, deletion, case/slash variants and unknown suffixes; no direct Account fallback'
  );

  for (const { run, profile, member } of fixtures) {
    assert.deepEqual(await run('/api/me/profile'), profile);
    const remove = () =>
      run('/api/me/profile/avatar', {
        method: 'DELETE',
        headers: {
          'If-Match': `"${profile.revision}"`,
          'Idempotency-Key': 'settings-remove',
        },
      });
    const removed = await remove();
    assert.deepEqual(await remove(), removed);
    assert.equal(removed.revision, profile.revision + 1);
    assert.equal((await run('/api/me/profile')).profile.avatarId, null);
    await run('/api/me/profile/avatar/' + profile.profile.avatarId, {
      status: 403,
    });
    assert.equal(
      (
        await source.query(
          'SELECT id FROM identity_profile_avatars WHERE identityId = ?',
          [member.uid]
        )
      ).length,
      0
    );
    const accepted = await run('/api/me', { method: 'DELETE', status: 202 });
    assert.deepEqual(accepted, {
      identityId: member.uid,
      revision: removed.revision + 1,
      status: 'accepted',
      cleanup: 'pending',
    });
    assert.equal((await identities.find(member.uid)).isDeleted, true);
    for (const path of paths) await run(path, { status: 401 });
  }
  console.log(
    'PASS account settings: avatar removal/replay deletes SQL bytes; self-deletion accepts durable canonical tombstones, reports pending cleanup and revokes application access'
  );
}

module.exports = { qualifyAccountSettings };
