const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');

async function qualifyProfileAvatarsHttp({
  accountOrigin,
  headers,
  identities,
}) {
  const uid = 'HttpPhotoOwner';
  for (const id of [uid, 'HttpPhotoForeign']) {
    await identities.ensure({
      uid: id,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
    await identities.enrollAccount(id, 'Private photo member', 'enroll');
  }
  const bytes = await sharp({
    create: { width: 800, height: 600, channels: 3, background: 'orange' },
  })
    .png()
    .withMetadata()
    .toBuffer();
  const key = randomUUID();
  const requestHeaders = {
    ...headers(uid),
    'content-type': 'image/png',
    'x-avatar-bytes': String(bytes.length),
    'x-avatar-sha256': createHash('sha256').update(bytes).digest('hex'),
    'if-match': '"2"',
    'idempotency-key': key,
  };
  const call = (method, endpoint, extra = {}, body) =>
    fetch(`${accountOrigin()}/api/me/profile${endpoint}`, {
      method,
      headers: { ...requestHeaders, ...extra },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(10_000),
    });
  assert.equal(
    (await fetch(`${accountOrigin()}/api/me/profile/avatar`)).status,
    401
  );
  assert.equal(
    (await call('PUT', '/avatar', { 'x-avatar-sha256': '0'.repeat(64) }, bytes))
      .status,
    400
  );
  assert.equal(
    (await call('PUT', '/avatar', { 'content-type': 'image/svg+xml' }, bytes))
      .status,
    415
  );
  assert.equal(
    (await call('PUT', '/avatar', { 'if-match': '2' }, bytes)).status,
    400
  );
  assert.equal(
    (await call('PUT', '/avatar', { 'x-avatar-bytes': String(2 * 1024 * 1024) }, Buffer.alloc(2 * 1024 * 1024 + 1))).status,
    413,
    'The transport must bound actual bytes independently of declared size'
  );
  const uploaded = await call('PUT', '/avatar', {}, bytes);
  assert.equal(uploaded.status, 200, await uploaded.clone().text());
  const receipt = await uploaded.json();
  assert.equal(receipt.revision, 3);
  const profile = await identities.getProfile(uid);
  const id = profile.profile.avatarId;
  const photo = await call('GET', `/avatar/${id}`);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/webp');
  assert.equal(photo.headers.get('cache-control'), 'private, no-store');
  assert.equal(photo.headers.get('x-content-type-options'), 'nosniff');
  const storedBytes = Buffer.from(await photo.arrayBuffer());
  const metadata = await sharp(storedBytes).metadata();
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 384);
  assert.equal(metadata.exif, undefined);
  assert.equal(
    (await call('GET', `/avatar/${id}`, headers('HttpPhotoForeign'))).status,
    403
  );
  assert.deepEqual(
    await (await call('PUT', '/avatar', {}, bytes)).json(),
    receipt
  );
  assert.equal((await call('DELETE', '/avatar')).status, 409);
  await identities.setSuspended(uid, true);
  assert.equal((await call('GET', `/avatar/${id}`)).status, 401);
  assert.equal((await call('PUT', '/avatar', {}, bytes)).status, 401);
  await identities.setSuspended(uid, false);
  return {
    restored: async () => {
      const response = await call('GET', `/avatar/${id}`);
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), storedBytes);
    },
    policyUnavailable: async () => {
      assert.equal((await call('GET', `/avatar/${id}`)).status, 503);
      assert.equal((await call('PUT', '/avatar', {}, bytes)).status, 503);
    },
  };
}
module.exports = { qualifyProfileAvatarsHttp };
