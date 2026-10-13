const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');
const { request: streamRequest } = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');

async function applicationMediaHttpChecks({
  source,
  restart,
  origin,
  secret,
  pass,
}) {
  const headers = (user = 'HttpMediaAlice', tenant = 'default') => ({
    'x-user-id': user,
    'x-user-claims': JSON.stringify({ tenantId: tenant, roles: [] }),
    'x-ingress-auth': secret,
  });
  const bytes = await sharp({
    create: { width: 80, height: 40, channels: 3, background: 'green' },
  })
    .png()
    .toBuffer();
  const descriptor = {
    contentType: 'image/png',
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const request = (
    path,
    method = 'GET',
    body,
    extra = {},
    user = 'HttpMediaAlice',
    tenant = 'default'
  ) =>
    fetch(origin() + '/api/' + path, {
      method,
      headers: {
        ...headers(user, tenant),
        'content-type': 'application/json',
        'idempotency-key': randomUUID(),
        ...extra,
      },
      ...(body === undefined
        ? {}
        : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  const draftResponse = await request('me/application-drafts', 'POST', {
    name: 'HTTP media',
    slug: 'http-media-' + randomUUID(),
    website: 'https://example.test',
    description: 'Upload through the production API.',
  });
  assert.equal(draftResponse.status, 201);
  const draft = await draftResponse.json();
  const input = { draftId: draft.id, purpose: 'banner', source: descriptor };
  const path = 'me/application-images';
  const createKey = randomUUID();
  const createdResponse = await request(path, 'POST', input, {
    'idempotency-key': createKey,
  });
  assert.equal(createdResponse.status, 201);
  assert.equal(createdResponse.headers.get('cache-control'), 'no-store');
  const created = await createdResponse.json();
  const url = path + '/' + created.id;
  const uploadKey = randomUUID();
  const binaryHeaders = {
    'content-type': 'application/octet-stream',
    'if-match': '"1"',
    'idempotency-key': uploadKey,
  };
  const upload = (value = bytes, extra = {}, user, tenant) =>
    request(
      url + '/content',
      'PUT',
      value,
      { ...binaryHeaders, ...extra },
      user,
      tenant
    );
  assert.equal((await fetch(origin() + '/api/' + url)).status, 401);
  assert.equal(
    (
      await fetch(origin() + '/api/' + url + '/content', {
        headers: { 'x-user-id': 'spoofed' },
      })
    ).status,
    401
  );
  for (const [user, tenant] of [
    ['HttpMediaBob', 'default'],
    ['HttpMediaAlice', 'other'],
    ['httpmediaalice', 'default'],
  ]) {
    assert.equal(
      (await request(url, 'GET', undefined, {}, user, tenant)).status,
      404
    );
    assert.equal((await upload(bytes, {}, user, tenant)).status, 404);
    assert.equal(
      (await request(url + '/content', 'GET', undefined, {}, user, tenant))
        .status,
      404
    );
  }
  assert.equal(
    (await request(path, 'POST', { ...input, ownerIdentityId: 'other' }))
      .status,
    400
  );
  assert.equal((await upload(bytes, { 'if-match': '1' })).status, 400);
  assert.equal((await upload(bytes, { 'if-match': 'W/"1"' })).status, 400);
  assert.equal(
    (await upload(bytes, { 'content-type': 'image/png' })).status,
    415
  );
  assert.equal(
    (await upload(bytes, { 'content-encoding': 'gzip' })).status,
    415
  );
  assert.equal((await upload(Buffer.alloc(8 * 1024 * 1024 + 1))).status, 413);
  assert.equal((await upload(Buffer.from('wrong source'))).status, 400);
  assert.equal((await request(url + '/content')).status, 400);
  pass(
    'compiled media HTTP rejects anonymous/spoofed/cross-owner access, authority overrides, unsupported transport, oversized bodies and mismatched source'
  );

  const heldResponses = [];
  const held = [1, 2].map(() => {
    const pending = streamRequest(origin() + '/api/' + url + '/content', {
      method: 'PUT',
      headers: {
        ...headers(),
        ...binaryHeaders,
        'content-length': String(bytes.length),
      },
      timeout: 5000,
    });
    pending.on('error', (error) =>
      heldResponses.push({ error: error.message })
    );
    pending.on('timeout', () => pending.destroy());
    pending.on('response', (response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () =>
        heldResponses.push({ status: response.statusCode, body })
      );
    });
    pending.write(bytes.subarray(0, 8));
    return pending;
  });
  try {
    let busy = false;
    for (let i = 0; i < 20; i++) {
      const probe = await upload(Buffer.from('capacity probe'));
      if (probe.status === 503) {
        assert.match(await probe.text(), /Image uploads are busy/);
        busy = true;
      } else assert.equal(probe.status, 400);
      // Arrival order is intentionally concurrent: either a held request or the probe may lose admission.
      busy ||= heldResponses.some(
        (response) =>
          response.status === 503 &&
          /Image uploads are busy/.test(response.body)
      );
      if (busy) break;
      await delay(50);
    }
    assert.equal(busy, true, JSON.stringify(heldResponses));
    assert.equal(
      (
        await source.query(
          'SELECT attempts FROM application_image_uploads WHERE id = ?',
          [created.id]
        )
      )[0].attempts,
      0
    );
  } finally {
    for (const pending of held) pending.destroy();
  }
  let recovered;
  for (let i = 0; i < 20; i++) {
    recovered = (await upload(Buffer.from('capacity probe'))).status;
    if (recovered === 400) break;
    assert.equal(recovered, 503);
    await delay(50);
  }
  assert.equal(recovered, 400);
  pass(
    'HTTP bounds simultaneous binary buffers and releases capacity after aborted bodies without consuming processing attempts'
  );

  await source.query(
    "CREATE TRIGGER reject_http_media_receipt BEFORE UPDATE ON application_image_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification media HTTP receipt failure'"
  );
  try {
    const failed = await upload();
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('retry-after'), '2');
    assert.equal((await (await request(url)).json()).status, 'pending');
  } finally {
    await source.query('DROP TRIGGER reject_http_media_receipt');
  }
  const completedResponse = await upload();
  assert.equal(completedResponse.status, 200);
  const completed = await completedResponse.json();
  assert.deepEqual(completed, { id: created.id, revision: 2, status: 'ready' });
  const read = await request(url + '/content');
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('cache-control'), 'private, no-store');
  assert.equal(read.headers.get('content-type'), 'image/webp');
  assert.equal(read.headers.get('x-content-type-options'), 'nosniff');
  const image = Buffer.from(await read.arrayBuffer());
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.width, 80);
  assert.equal(metadata.height, 40);
  assert.equal(metadata.format, 'webp');
  pass(
    'compiled API recovers a SQL receipt failure after object upload and serves normalized private bytes with explicit cache and content-type controls'
  );

  await restart();
  assert.deepEqual(
    await (
      await request(path, 'POST', input, { 'idempotency-key': createKey })
    ).json(),
    created
  );
  assert.deepEqual(await (await upload()).json(), completed);
  assert.deepEqual(
    Buffer.from(await (await request(url + '/content')).arrayBuffer()),
    image
  );
  assert.equal(
    (await upload(bytes, { 'idempotency-key': randomUUID() })).status,
    409
  );
  assert.equal(
    (
      await request(
        path,
        'POST',
        { ...input, purpose: 'logo' },
        { 'idempotency-key': createKey }
      )
    ).status,
    409
  );
  assert.equal(
    (
      await request('me/application-drafts/' + draft.id, 'DELETE', {
        expectedRevision: 1,
      })
    ).status,
    200
  );
  assert.equal((await request(url)).status, 404);
  assert.equal((await request(url + '/content')).status, 404);
  assert.equal((await upload()).status, 404);
  pass(
    'API process restart preserves ready bytes and exact receipts; changed intent conflicts and canonical draft deletion immediately removes preview access'
  );
}
module.exports = { applicationMediaHttpChecks };
