const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { request: httpRequest } = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');
const sharp = require('sharp');

async function qualifyArticleCovers({
  request,
  change,
  origins,
  author,
  other,
  foreign,
  id,
}) {
  const covers = '/api/me/article-covers';
  const bytes = await Promise.all(
    ['green', 'blue'].map((background) =>
      sharp({
        create: { width: 320, height: 180, channels: 3, background },
      })
        .png()
        .toBuffer()
    )
  );
  const reserve = (content, options = {}) =>
    change(
      covers,
      author,
      {
        articleId: id,
        source: {
          contentType: 'image/png',
          bytes: content.length,
          sha256: createHash('sha256').update(content).digest('hex'),
        },
      },
      options
    );
  const upload = (reservation, content, options = {}) =>
    change(`${covers}/${reservation.id}/content`, author, content, {
      method: 'PUT',
      headers: { 'If-Match': `"${reservation.revision}"` },
      ...options,
    });
  const first = await reserve(bytes[0]);
  for (const actor of [other, foreign]) {
    await request(`${covers}/${first.id}`, { actor, status: 404 });
    await upload(first, bytes[0], { actor, status: 404 });
    await request(`${covers}/${first.id}/content`, { actor, status: 404 });
  }
  for (const source of [
    { contentType: 'image/svg+xml', bytes: 100, sha256: 'a'.repeat(64) },
    {
      contentType: 'image/png',
      bytes: 8 * 1024 * 1024 + 1,
      sha256: 'a'.repeat(64),
    },
    { contentType: 'image/png', bytes: 0, sha256: 'a'.repeat(64) },
    { contentType: 'image/png', bytes: 100, sha256: 'invalid' },
  ])
    await change(covers, author, { articleId: id, source }, { status: 400 });
  await upload(first, Buffer.alloc(bytes[0].length), { status: 400 });
  await upload(first, bytes[0].subarray(1), { status: 400 });
  await upload({ ...first, revision: 9 }, bytes[0], { status: 409 });
  await upload(first, bytes[0], { headers: { 'If-Match': '1' }, status: 400 });
  await upload(first, bytes[0], {
    headers: { 'If-Match': '"1"', 'Content-Type': 'image/png' },
    status: 415,
  });
  await upload(first, bytes[0], {
    headers: { 'If-Match': '"1"', 'Content-Encoding': 'gzip' },
    status: 415,
  });
  for (const at of origins)
    await upload(first, Buffer.alloc(8 * 1024 * 1024 + 1), { at, status: 413 });

  // Abort a partial octet stream before a complete upload can reach Editorial.
  const aborted = await reserve(bytes[0]);
  await new Promise((resolve, reject) => {
    const stream = httpRequest(origins[0] + `${covers}/${aborted.id}/content`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${author.token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes[0].length),
        'If-Match': '"1"',
        'Idempotency-Key': randomUUID(),
      },
    });
    stream.once('error', (error) =>
      error.code === 'ECONNRESET' ? resolve() : reject(error)
    );
    stream.write(bytes[0].subarray(0, 10));
    setTimeout(() => stream.destroy(), 150);
  });
  await delay(50);
  assert.equal(
    (await request(`${covers}/${aborted.id}`, { actor: author })).status,
    'pending'
  );
  await upload(aborted, bytes[0]);

  const uploaded = [];
  for (const [index, reservation] of [
    first,
    await reserve(bytes[1]),
  ].entries()) {
    const key = randomUUID();
    const result = await upload(reservation, bytes[index], {
      at: origins[index],
      key,
    });
    assert.equal(result.status, 'ready');
    assert.deepEqual(await upload(reservation, bytes[index], { key }), result);
    const route = `${covers}/${reservation.id}/content`;
    const normalized = await request(route, { actor: author, binary: true });
    const metadata = await sharp(normalized).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    uploaded.push({
      ...reservation,
      bytes: bytes[index],
      key,
      result,
      normalized,
      route,
    });
  }
  const cancelled = await reserve(bytes[0]),
    key = randomUUID();
  const result = await change(
    `${covers}/${cancelled.id}`,
    author,
    { expectedRevision: 1 },
    { method: 'DELETE', key }
  );
  assert.deepEqual(
    await change(
      `${covers}/${cancelled.id}`,
      author,
      { expectedRevision: 1 },
      { method: 'DELETE', key }
    ),
    result
  );
  await request(`${covers}/${cancelled.id}/content`, {
    actor: author,
    status: 400,
  });
  assert.ok(
    !(await request(covers + '?articleId=' + id, { actor: author })).some(
      (item) => item.id === cancelled.id
    )
  );
  assert.ok(
    (await request(covers + '?articleId=' + id, { actor: author })).some(
      (item) => item.id === first.id
    )
  );
  console.log(
    'PASS article covers: byte/hash/type/size/revision limits, partial-stream cancellation, owner/tenant preview denial, normalized objects and upload/cancellation replay through both selected gateways'
  );
  return { first: uploaded[0], second: uploaded[1], upload, reserve };
}

module.exports = { qualifyArticleCovers };
