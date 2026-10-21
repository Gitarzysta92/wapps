const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');

module.exports = async function applicationMedia({
  local,
  maintainer,
  other,
  reviewer,
  id,
  services,
  change,
  request,
}) {
  const bytes = await sharp({
    create: { width: 80, height: 40, channels: 3, background: 'green' },
  })
    .png()
    .toBuffer();
  const reservation = await change('/api/me/application-images', maintainer, {
    draftId: id,
    purpose: 'logo',
    source: {
      contentType: 'image/png',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  });
  const url = '/api/me/application-images/' + reservation.id;
  await request(url, { actor: other, status: 404 });
  const key = randomUUID();
  async function upload() {
    const response = await fetch(local + url + '/content', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${maintainer.token}`,
        'Content-Type': 'application/octet-stream',
        'If-Match': '"1"',
        'Idempotency-Key': key,
      },
      body: bytes,
      signal: AbortSignal.timeout(25000),
    });
    const value = await response.json();
    assert.equal(response.status, 200, JSON.stringify(value));
    return value;
  }
  const uploaded = await upload();
  assert.deepEqual(await upload(), uploaded);
  await change(
    `/api/me/application-drafts/${id}/images`,
    maintainer,
    { purpose: 'logo', imageId: reservation.id, expectedRevision: 1 },
    { method: 'PUT', status: 200 }
  );
  async function preview(route, actor = maintainer, expected = 200) {
    const response = await fetch(local + route, {
      headers: actor ? { Authorization: `Bearer ${actor.token}` } : {},
      signal: AbortSignal.timeout(25000),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, expected, buffer.toString().slice(0, 200));
    if (expected === 200) {
      assert.equal(response.headers.get('content-type'), 'image/webp');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
    }
    return buffer;
  }
  const frozen = await preview(url + '/content');
  await preview(url + '/content', other, 404);
  await services.pauseStorage();
  try {
    await preview(url + '/content', maintainer, 503);
  } finally {
    await services.resumeStorage();
  }
  assert.deepEqual(await preview(url + '/content'), frozen);
  console.log(
    'PASS required application image reservation/upload/replay and private WebP bytes use real SQL/MinIO through BFF; foreign reads and object-store outage fail closed'
  );
  return {
    review: async (revision) =>
      assert.deepEqual(
        await preview(
          `/api/editorial/application-reviews/${id}/submissions/${revision}/images/logo/content`,
          reviewer
        ),
        frozen
      ),
    published: async (applicationId) =>
      assert.deepEqual(
        await preview(
          `/api/media/applications/${applicationId}/logo/${reservation.id}`,
          null
        ),
        frozen
      ),
  };
};
