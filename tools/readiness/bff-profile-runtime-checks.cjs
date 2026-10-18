const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const sharp = require('sharp');

const execute = promisify(execFile);
async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  const other = JSON.parse(
    readFileSync(process.env.WAPPS_BFF_ACCOUNTS_FILE, 'utf8')
  ).staff;
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE;
  const project = process.env.WAPPS_BFF_COMPOSE_PROJECT;
  const report = process.env.WAPPS_BFF_REPORT;
  assert.ok(other?.token && compose && project && report);
  const checks = [];
  const stopped = new Set();
  let erased = false;
  const pass = (name) => {
    checks.push(name);
    console.log('PASS ' + name);
  };
  const persist = () =>
    writeFileSync(
      report,
      JSON.stringify(
        { checks, disposableIdentity: actor?.uid, erased },
        null,
        2
      ),
      { mode: 0o600 }
    );
  async function service(action, name) {
    if (action === 'stop') stopped.add(name);
    await execute(
      'docker',
      ['compose', '-f', compose, '-p', project, action, name],
      { timeout: 45000, maxBuffer: 65536 }
    );
    if (action === 'start') stopped.delete(name);
  }
  async function call(
    route = '/api/me/profile',
    {
      user = actor,
      method = 'GET',
      body,
      headers = {},
      status = 200,
      binary = false,
    } = {}
  ) {
    const response = await fetch(new URL(route, origin), {
      method,
      headers: {
        ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
        ...(body === undefined || Buffer.isBuffer(body)
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(25000),
    });
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      method +
        ' ' +
        route +
        ': HTTP ' +
        response.status +
        ', expected ' +
        status
    );
    if (response.ok && route.startsWith('/api/me'))
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
  async function ready() {
    let last;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        return (await call()).value;
      } catch (error) {
        last = error;
        await delay(500);
      }
    }
    throw last;
  }
  const image = (color, format) =>
    sharp({
      create: { width: 800, height: 600, channels: 3, background: color },
    })
      .toFormat(format)
      .withMetadata()
      .toBuffer();
  const uploadHeaders = (
    bytes,
    revision,
    key = randomUUID(),
    type = 'image/png'
  ) => ({
    'Content-Type': type,
    'Idempotency-Key': key,
    'If-Match': `"${revision}"`,
    'X-Avatar-Bytes': String(bytes.length),
    'X-Avatar-Sha256': createHash('sha256').update(bytes).digest('hex'),
  });
  const otherBefore = (await call('/api/me/profile', { user: other })).value;
  const credentials = {
    email: `bff-profile-${randomUUID()}@wapps-review.test`,
    password: randomUUID() + '!Aa1',
    nickname: 'BFF Profile Check',
  };
  const registrationKey = randomUUID();
  writeFileSync(
    report + '.account.json',
    JSON.stringify({ ...credentials, registrationKey }, null, 2),
    { mode: 0o600 }
  );
  const actor = (
    await call('/auth/register', {
      user: null,
      method: 'POST',
      body: { ...credentials, passwordConfirmation: credentials.password },
      headers: { 'Idempotency-Key': registrationKey },
    })
  ).value;
  assert.ok(actor?.uid && actor?.token && actor.uid !== other.uid);
  writeFileSync(
    report + '.account.json',
    JSON.stringify({ ...credentials, ...actor, registrationKey }, null, 2),
    { mode: 0o600 }
  );
  persist();
  try {
    const initial = await ready();
    const me = (await call('/api/me')).value;
    assert.equal(me.identityId, actor.uid);
    assert.equal(me.account.email, credentials.email);
    assert.equal(initial.identityId, actor.uid);
    await call('/api/me', { user: null, status: 401 });
    await call('/api/me/profile', { user: null, status: 401 });
    assert.equal(
      (
        await call('/api/me', {
          headers: {
            'X-User-Id': other.uid,
            'X-User-Email': 'spoofed@example.test',
            'X-Ingress-Auth': 'forged',
          },
        })
      ).value.identityId,
      actor.uid
    );
    assert.equal(
      (
        await call('/api/me', {
          headers: { 'X-User-Email': 'spoofed@example.test' },
        })
      ).value.account.email,
      credentials.email
    );
    pass(
      'authenticated account/profile reads preserve canonical identity and verified email'
    );

    const update = {
      expectedRevision: initial.revision,
      name: 'BFF Profile Checked',
      bio: 'Saved through the BFF',
      location: 'Warsaw',
      contactEmail: 'contact@example.test',
      socialLinks: { github: 'bff-check', website: 'https://example.test' },
    };
    const textKey = randomUUID();
    const textReceipt = (
      await call('/api/me/profile', {
        method: 'PUT',
        body: update,
        headers: { 'Idempotency-Key': textKey },
      })
    ).value;
    assert.equal(textReceipt.revision, initial.revision + 1);
    assert.deepEqual(
      (
        await call('/api/me/profile', {
          method: 'PUT',
          body: update,
          headers: { 'Idempotency-Key': textKey },
        })
      ).value,
      textReceipt
    );
    await call('/api/me/profile', {
      method: 'PUT',
      body: update,
      headers: { 'Idempotency-Key': randomUUID() },
      status: 409,
    });
    await call('/api/me/profile', {
      method: 'PUT',
      body: { ...update, bio: 'Different command' },
      headers: { 'Idempotency-Key': textKey },
      status: 409,
    });
    assert.equal((await call('/api/me')).value.profile.name, update.name);
    const saved = (await call()).value;
    assert.equal(saved.profile.contactEmail, update.contactEmail);
    assert.deepEqual(saved.profile.socialLinks, update.socialLinks);
    assert.deepEqual(
      (await call('/api/me/profile', { user: other })).value,
      otherBefore
    );
    pass(
      'profile save/replay/conflicts and sidebar account data use the same canonical account'
    );

    const png = await image('orange', 'png');
    const upload = uploadHeaders(png, saved.revision);
    await call('/api/me/profile/avatar', {
      method: 'PUT',
      body: png,
      headers: { ...upload, 'X-Avatar-Sha256': '0'.repeat(64) },
      status: 400,
    });
    await call('/api/me/profile/avatar', {
      method: 'PUT',
      body: png,
      headers: { ...upload, 'Content-Type': 'image/svg+xml' },
      status: 415,
    });
    const invalidImage = Buffer.from('not an image');
    await call('/api/me/profile/avatar', {
      method: 'PUT',
      body: invalidImage,
      headers: uploadHeaders(invalidImage, saved.revision),
      status: 400,
    });
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1);
    await call('/api/me/profile/avatar', {
      method: 'PUT',
      body: oversized,
      headers: uploadHeaders(oversized, saved.revision),
      status: 413,
    });
    const photoReceipt = (
      await call('/api/me/profile/avatar', {
        method: 'PUT',
        body: png,
        headers: upload,
      })
    ).value;
    assert.equal(photoReceipt.revision, saved.revision + 1);
    assert.deepEqual(
      (
        await call('/api/me/profile/avatar', {
          method: 'PUT',
          body: png,
          headers: upload,
        })
      ).value,
      photoReceipt
    );
    const withPhoto = (await call()).value;
    const photoPath = '/api/me/profile/avatar/' + withPhoto.profile.avatarId;
    const photo = await call(photoPath, { binary: true });
    assert.equal(photo.response.headers.get('content-type'), 'image/webp');
    assert.equal(
      photo.response.headers.get('x-content-type-options'),
      'nosniff'
    );
    const metadata = await sharp(photo.value).metadata();
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 384);
    assert.equal(metadata.exif, undefined);
    await call(photoPath, { user: null, status: 401 });
    await call(photoPath, { user: other, status: 403 });
    pass(
      'bounded photo upload, normalized private download, replay and cross-account denial'
    );

    await service('stop', 'catalog-bff');
    for (const path of [
      '/api/me',
      '/api/me/',
      '/api/Me',
      '/api/me/profile',
      '/api/me/Profile/',
      photoPath,
      photoPath + '/',
    ])
      await call(path, { status: [502, 504] });
    await call('/api/me/articles', { status: [502, 503, 504] });
    await service('start', 'catalog-bff');
    assert.deepEqual(await ready(), withPhoto);
    assert.deepEqual(
      (await call(photoPath, { binary: true })).value,
      photo.value
    );
    pass(
      'account/profile/photo paths cannot bypass BFF; saved state survives BFF restart'
    );

    await service('stop', 'account-management');
    await call('/api/me', { status: 503 });
    await call(photoPath, { status: 503 });
    const uncertain = { ...update, expectedRevision: withPhoto.revision };
    const retryKey = randomUUID();
    await call('/api/me/profile', {
      method: 'PUT',
      body: uncertain,
      headers: { 'Idempotency-Key': retryKey },
      status: 503,
    });
    await service('start', 'account-management');
    assert.deepEqual(await ready(), withPhoto);
    assert.deepEqual(
      (await call(photoPath, { binary: true })).value,
      photo.value
    );
    const retryReceipt = (
      await call('/api/me/profile', {
        method: 'PUT',
        body: uncertain,
        headers: { 'Idempotency-Key': retryKey },
      })
    ).value;
    assert.deepEqual(
      (
        await call('/api/me/profile', {
          method: 'PUT',
          body: uncertain,
          headers: { 'Idempotency-Key': retryKey },
        })
      ).value,
      retryReceipt
    );
    pass(
      'Account outage fails explicitly and restart preserves profile/photo SQL data and retry intent'
    );

    const jpeg = await image('blue', 'jpeg');
    const replacement = uploadHeaders(
      jpeg,
      retryReceipt.revision,
      randomUUID(),
      'image/jpeg'
    );
    const replaced = (
      await call('/api/me/profile/avatar', {
        method: 'PUT',
        body: jpeg,
        headers: replacement,
      })
    ).value;
    const current = (await call()).value;
    assert.notEqual(current.profile.avatarId, withPhoto.profile.avatarId);
    await call(photoPath, { status: 403 });
    const currentPath = '/api/me/profile/avatar/' + current.profile.avatarId;
    assert.notDeepEqual(
      (await call(currentPath, { binary: true })).value,
      photo.value
    );
    assert.deepEqual(
      (
        await call('/api/me/profile/avatar', {
          method: 'PUT',
          body: png,
          headers: upload,
        })
      ).value,
      photoReceipt
    );
    assert.equal(
      (await call()).value.profile.avatarId,
      current.profile.avatarId
    );
    await call('/api/me/profile/avatar', {
      method: 'DELETE',
      headers: {
        'If-Match': `"${withPhoto.revision}"`,
        'Idempotency-Key': randomUUID(),
      },
      status: 409,
    });
    const removeHeaders = {
      'If-Match': `"${replaced.revision}"`,
      'Idempotency-Key': randomUUID(),
    };
    const removed = (
      await call('/api/me/profile/avatar', {
        method: 'DELETE',
        headers: removeHeaders,
      })
    ).value;
    assert.equal(removed.revision, replaced.revision + 1);
    assert.deepEqual(
      (
        await call('/api/me/profile/avatar', {
          method: 'DELETE',
          headers: removeHeaders,
        })
      ).value,
      removed
    );
    assert.equal((await call()).value.profile.avatarId, null);
    await call(currentPath, { status: 403 });
    assert.deepEqual(
      (await call('/api/me/profile', { user: other })).value,
      otherBefore
    );
    pass(
      'replacement/removal invalidate old photos; historical retries cannot resurrect them'
    );
  } finally {
    for (const name of [...stopped]) await service('start', name);
    await ready();
    // Only the freshly registered qualifier account is erased; existing review accounts are read-only.
    const deletion = (await call('/api/me', { method: 'DELETE', status: 202 }))
      .value;
    assert.equal(deletion.identityId, actor.uid);
    assert.equal(deletion.status, 'accepted');
    assert.ok(['pending', 'completed', 'failed'].includes(deletion.cleanup));
    erased = true;
    persist();
  }
  await call('/api/me', { status: 401 });
  await call('/api/me/profile', { status: 401 });
  pass(
    'BFF preserves erasure acceptance; tombstoned test identity loses account/profile access'
  );
  persist();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
