const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { request: httpRequest, createServer } = require('node:http');
const { once } = require('node:events');
const { gunzipSync } = require('node:zlib');
const { setTimeout: delay } = require('node:timers/promises');
const { MysqlAccountExports } = require('@wapps/account-mysql');
const { ACCOUNT_EXPORT_LIMITS } = require('@sdk/features/identity/core');
const { profileParityContent } = require('./profile-parity-content.cjs');

const roster = ['account', 'credentials', 'editorial', 'discussion'];
const base = '/api/me/exports';
const variants = (path) => [
  path,
  path + '/',
  path
    .replace('/api/me/exports', '/API/ME/EXPORTS')
    .replace('/download', '/DOWNLOAD') + '/',
];
async function until(read, matches, message) {
  let value;
  for (let attempt = 0; attempt < 200; attempt++) {
    value = await read();
    if (matches(value)) return value;
    await delay(100);
  }
  assert.fail(message + ': ' + JSON.stringify(value));
}
function readWithBody(url, token, framing) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          [framing]: framing === 'Content-Length' ? '2' : 'chunked',
        },
        signal: AbortSignal.timeout(20000),
      },
      (response) => {
        response.resume();
        response.once('end', () => resolve(response.statusCode));
      }
    );
    request.once('error', reject);
    request.end('{}');
  });
}

// Receives only local-auth's fresh stores, independent processes and enrolled sessions.
async function qualifyExportParity({
  call,
  origins,
  input,
  source,
  identities,
  operator,
  services,
  subjectFor,
  credentials,
  ingressSecret,
  restartAccount,
  restartBff,
  stopBff,
  stopAccount,
  crashAccount,
  stopAuth,
  restartAuth,
  pausePolicy,
  resumePolicy,
}) {
  const owners = [];
  const pass = (name) => console.log('PASS A27 ' + name);
  const countChunks = async (id) =>
    Number(
      (
        await source.query(
          'SELECT COUNT(*) AS total FROM identity_account_export_chunks WHERE exportId = ?',
          [id]
        )
      )[0].total
    );
  const enroll = async (label, at = origins[0]) => {
    const email = `export-${label}-${randomUUID()}@example.test`;
    const registered = await call('/auth/register', {
      at,
      body: { ...input, email },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    await credentials.setOperatorClaims(await subjectFor(registered.uid), {
      roles: ['discussion:writer'],
      tenantId: 'default',
    });
    return {
      ...(await call('/auth/signin', {
        at,
        body: { email, password: input.password },
      })),
      email,
    };
  };
  const other = await enroll('other');
  const request = (owner, at, key = randomUUID(), status = 202) =>
    call(base, {
      at,
      token: owner.token,
      method: 'POST',
      body: {},
      headers: { 'Idempotency-Key': key },
      status,
    });
  const inspect = (owner, at, id) =>
    call(base + '/' + id, { at, token: owner.token });
  const ready = (owner, at, id) =>
    until(
      () => inspect(owner, at, id),
      (job) => job.status === 'ready',
      'Export did not become ready'
    );
  const cancel = async (owner, at, id) => {
    const job = await call(base + '/' + id, {
      at,
      token: owner.token,
      method: 'DELETE',
    });
    assert.equal(job.status, 'cancelled');
    assert.equal(await countChunks(id), 0);
  };
  async function download(
    owner,
    at,
    job,
    path = base + '/' + job.id + '/download'
  ) {
    const response = await fetch(at + path, {
      headers: { Authorization: 'Bearer ' + owner.token },
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('content-type'), 'application/gzip');
    assert.equal(response.headers.get('content-length'), String(job.bytes));
    assert.equal(response.headers.get('content-encoding'), null);
    assert.equal(
      response.headers.get('content-disposition'),
      `attachment; filename="wapps-account-${job.id}.ndjson.gz"`
    );
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy'), /sandbox/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, job.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), job.sha256);
    const lines = gunzipSync(bytes, { maxOutputLength: 16 * 1024 * 1024 })
      .toString()
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.equal(lines[0].identityId, owner.uid);
    assert.equal(lines[0].consistency, 'per-service canonical snapshots');
    assert.deepEqual(lines[0].sources, roster);
    assert.deepEqual(
      lines.filter((line) => line.type === 'begin').map((line) => line.source),
      roster
    );
    assert.deepEqual(
      lines.filter((line) => line.type === 'end').map((line) => line.source),
      roster
    );
    assert.equal(lines.at(-1).type, 'complete');
    assert.deepEqual(
      lines.at(-1).captures.map((receipt) => receipt.source),
      roster
    );
    for (const receipt of lines.at(-1).captures) {
      const records = lines.filter(
        (line) => line.type === 'record' && line.source === receipt.source
      );
      assert.ok(records.length > 0, receipt.source);
      assert.equal(receipt.records, records.length);
      assert.equal(
        lines.find(
          (line) => line.type === 'end' && line.source === receipt.source
        ).records,
        records.length
      );
    }
    const credential = lines.find(
      (line) =>
        line.source === 'credentials' && line.collection === 'credential-user'
    );
    assert.equal(credential.data.uid, await subjectFor(owner.uid));
    const text = JSON.stringify(lines);
    for (const secret of [
      owner.token,
      input.password,
      other.uid,
      other.email,
      'foreign-private-export-body',
    ])
      assert.ok(!text.includes(secret), 'Foreign/private secret leaked');
    for (const field of [
      'passwordHash',
      'passwordSalt',
      'refreshToken',
      'accessToken',
      'customClaims',
    ])
      assert.ok(!text.includes('"' + field + '"'), field);
    return { bytes, lines };
  }

  for (const [index, at] of origins.entries()) {
    const owner = await enroll(String(index), at);
    owners.push(owner);
    const session = await call('/auth/signin', {
      at,
      body: { email: owner.email, password: input.password },
    });
    assert.equal(session.uid, owner.uid);
    const content = await profileParityContent({
      call,
      at,
      owner,
      operator,
      services,
      ingressSecret,
      checkLag: false,
      startWorker: index === 0,
    });
    const privateTopic = await call('/api/discussions', {
      at,
      token: owner.token,
      status: 201,
      headers: { 'Idempotency-Key': randomUUID() },
      body: {
        content: 'historical-private-export-body',
        state: 'draft',
        visibility: 'private',
      },
    });
    await call('/api/discussions/' + privateTopic.id, {
      at,
      token: owner.token,
      method: 'PUT',
      headers: { 'Idempotency-Key': randomUUID() },
      body: {
        content: 'current-private-export-body',
        expectedRevision: privateTopic.revision,
      },
    });
    await call('/api/discussions', {
      at,
      token: other.token,
      status: 201,
      headers: { 'Idempotency-Key': randomUUID() },
      body: {
        content: 'foreign-private-export-body',
        state: 'draft',
        visibility: 'private',
      },
    });
    assert.deepEqual(await call(base, { at, token: owner.token }), {
      job: null,
    });
    await call(base, { at, status: 401 });
    await call(base, { at, token: 'invalid', status: 401 });
    await call(base + '?identityId=' + other.uid, {
      at,
      token: owner.token,
      status: 400,
    });
    await call(base, {
      at,
      token: owner.token,
      method: 'POST',
      body: {},
      status: 400,
    });
    await call(base, {
      at,
      token: owner.token,
      method: 'POST',
      body: { identityId: other.uid },
      headers: { 'Idempotency-Key': randomUUID() },
      status: 400,
    });
    await call(base, {
      at,
      token: owner.token,
      method: 'POST',
      body: { excess: 'x'.repeat(65536) },
      headers: { 'Idempotency-Key': randomUUID() },
      status: 413,
    });
    const key = randomUUID();
    const accepted = await Promise.all([
      request(owner, at, key),
      request(session, at, key),
    ]);
    assert.equal(accepted[0].id, accepted[1].id);
    await request(owner, at, randomUUID(), 409);
    const job = await ready(owner, at, accepted[0].id);
    const archive = await download(owner, at, job);
    const text = JSON.stringify(archive.lines);
    for (const value of [
      content.application.id,
      content.suite.id,
      content.article.id,
      'historical-private-export-body',
      'current-private-export-body',
    ])
      assert.ok(text.includes(value), value);
    const versions = archive.lines.filter(
      (line) =>
        line.collection === 'payload-versions' &&
        line.data.nodeId === privateTopic.id
    );
    assert.equal(versions.length, 2);
    assert.deepEqual(versions.map((line) => line.data.current).sort(), [
      false,
      true,
    ]);
    for (const route of [
      base,
      base + '/' + job.id,
      base + '/' + job.id + '/download',
    ]) {
      for (const path of variants(route)) {
        if (route.endsWith('/download'))
          assert.deepEqual(
            (await download(owner, at, job, path)).bytes,
            archive.bytes
          );
        else await call(path, { at, token: owner.token });
      }
      for (const framing of ['Content-Length', 'Transfer-Encoding'])
        assert.equal(await readWithBody(at + route, owner.token, framing), 400);
    }
    for (const path of variants(base))
      assert.equal(
        (
          await call(path, {
            at,
            token: owner.token,
            method: 'POST',
            body: {},
            headers: { 'Idempotency-Key': key },
            status: 202,
          })
        ).id,
        job.id
      );
    for (const path of [
      base + '/unknown/nested',
      base + '/' + job.id + '/download/unknown',
    ])
      for (const route of variants(path))
        await call(route, { at, token: owner.token, status: 404 });
    for (const [path, method] of [
      [base + '/' + job.id, 'GET'],
      [base + '/' + job.id, 'DELETE'],
      [base + '/' + job.id + '/download', 'GET'],
    ])
      await call(path, { at, token: other.token, method, status: 403 });
    await call(base + '/' + job.id + '/download', {
      at,
      token: owner.token,
      headers: { Range: 'bytes=0-9' },
      status: 400,
    });
    await call(base + '/' + job.id + '/download', {
      at,
      token: owner.token,
      method: 'HEAD',
      status: 405,
    });
    const spoofed = await call(base, {
      at,
      token: owner.token,
      headers: {
        'X-User-Id': other.uid,
        'X-Ingress-Auth': 'forged',
        'X-User-Claims': '{"roles":["admin"]}',
      },
    });
    assert.equal(spoofed.job.id, job.id);
    await restartAccount();
    await restartAuth();
    assert.deepEqual(
      (await download(session, at, await ready(owner, at, job.id))).bytes,
      archive.bytes
    );
    assert.equal((await request(owner, at, key)).id, job.id);
    const [stored] = await source.query(
      'SELECT payload FROM identity_account_export_chunks WHERE exportId = ? AND position = 0',
      [job.id]
    );
    await source.query(
      'UPDATE identity_account_export_chunks SET payload = ? WHERE exportId = ? AND position = 0',
      [Buffer.alloc(stored.payload.length), job.id]
    );
    try {
      await call(base + '/' + job.id + '/download', {
        at,
        token: owner.token,
        status: 503,
      });
    } finally {
      await source.query(
        'UPDATE identity_account_export_chunks SET payload = ? WHERE exportId = ? AND position = 0',
        [stored.payload, job.id]
      );
    }
    await identities.setSuspended(owner.uid, true);
    try {
      await call(base + '/' + job.id + '/download', {
        at,
        token: owner.token,
        status: 401,
      });
    } finally {
      await identities.setSuspended(owner.uid, false);
    }
    await stopBff();
    try {
      for (const path of [
        base,
        base + '/' + job.id,
        base + '/' + job.id + '/download',
        base + '/unknown/nested',
        base + '/' + job.id + '/download/unknown',
      ])
        for (const route of variants(path))
          await call(route, { at, token: owner.token, status: 502 });
      for (const route of variants(base))
        await call(route, {
          at,
          token: owner.token,
          method: 'POST',
          body: {},
          headers: { 'Idempotency-Key': key },
          status: 502,
        });
      for (const route of variants(base + '/' + job.id))
        await call(route, {
          at,
          token: owner.token,
          method: 'DELETE',
          status: 502,
        });
    } finally {
      await restartBff();
    }
    await restartBff({ ACCOUNT_MANAGEMENT_URL: 'http://127.0.0.1:1' });
    try {
      for (const path of [
        base,
        base + '/' + job.id,
        base + '/' + job.id + '/download',
      ])
        await call(path, { at, token: owner.token, status: 503 });
      await request(owner, at, key, 503);
      await call(base + '/' + job.id, {
        at,
        token: owner.token,
        method: 'DELETE',
        status: 503,
      });
    } finally {
      await restartBff();
    }
    assert.deepEqual((await download(owner, at, job)).bytes, archive.bytes);
    for (const route of variants(base + '/' + job.id)) {
      assert.equal(
        (await call(route, { at, token: owner.token, method: 'DELETE' }))
          .status,
        'cancelled'
      );
      assert.equal(await countChunks(job.id), 0);
    }
    assert.equal((await request(owner, at, key)).status, 'cancelled');
    await call(base + '/' + job.id + '/download', {
      at,
      token: owner.token,
      status: 409,
    });
    pass(
      `${
        index ? 'alpha' : 'local'
      } gateway: real four-provider history, exact receipts/digest, independent sessions/restarts, replay/conflict, bounds, isolation/lifecycle, corruption, cancellation and whole-family BFF outage`
    );
  }

  const at = origins[0],
    owner = owners[0];
  for (const [stop, restart, label] of [
    [services.stopDiscussion, services.restartDiscussion, 'Discussion'],
    [services.stopEditorial, services.restartEditorial, 'Editorial'],
  ]) {
    await stop();
    let job;
    try {
      job = await request(owner, at);
      await until(
        () => inspect(owner, at, job.id),
        (value) => value.status === 'queued' && value.attempts > 0,
        label + ' did not fail closed'
      );
      await call(base + '/' + job.id + '/download', {
        at,
        token: owner.token,
        status: 409,
      });
    } finally {
      await restart();
    }
    await restartAccount();
    assert.ok((await ready(owner, at, job.id)).attempts >= 2);
    await download(owner, at, await inspect(owner, at, job.id));
    await cancel(owner, at, job.id);
  }
  await stopAuth();
  let credentialRetry;
  try {
    // Nginx maps an unavailable authentication subrequest to 500, before BFF.
    await call(base, { at, token: owner.token, status: 500 });
    credentialRetry = await new MysqlAccountExports(source).request(
      owners[1].uid,
      randomUUID()
    );
    await until(
      async () =>
        (
          await source.query(
            'SELECT status, attempts FROM identity_account_exports WHERE id = ?',
            [credentialRetry.id]
          )
        )[0],
      (job) => job.status === 'queued' && Number(job.attempts) > 0,
      'Credential outage did not schedule retry'
    );
    assert.equal(await countChunks(credentialRetry.id), 0);
  } finally {
    await restartAuth();
  }
  await restartAccount();
  await download(owners[1], at, await ready(owners[1], at, credentialRetry.id));
  await cancel(owners[1], at, credentialRetry.id);
  await pausePolicy();
  try {
    await call(base, { at, token: owner.token, status: 503 });
  } finally {
    await resumePolicy();
  }
  pass(
    'real Editorial/Discussion outages retain incomplete retryable jobs; source and Account recovery captures all providers; Authentication and policy outages fail closed'
  );

  const expiring = await ready(
    owners[1],
    at,
    (
      await request(owners[1], at)
    ).id
  );
  const time = Date.now();
  await source.query(
    'UPDATE identity_account_exports SET requestedAt = ?, availableAt = ?, expiresAt = ?, readyAt = ? WHERE id = ?',
    [
      time - ACCOUNT_EXPORT_LIMITS.retentionMs - 1,
      time - ACCOUNT_EXPORT_LIMITS.retentionMs - 1,
      time - 1,
      time - 2,
      expiring.id,
    ]
  );
  assert.equal((await inspect(owners[1], at, expiring.id)).status, 'expired');
  await call(base + '/' + expiring.id + '/download', {
    at,
    token: owners[1].token,
    status: 409,
  });
  await until(
    () => countChunks(expiring.id),
    (count) => count === 0,
    'Expired chunks were not purged'
  );
  pass(
    'runtime retention expiry immediately denies downloads and purges the private artifact'
  );

  const lock = source.createQueryRunner();
  await lock.connect();
  let interrupted;
  try {
    await lock.query('LOCK TABLES editorial.application_drafts WRITE');
    interrupted = await request(owner, at);
    await until(
      () => inspect(owner, at, interrupted.id),
      (job) => job.status === 'building',
      'Worker did not start'
    );
    await crashAccount();
  } finally {
    await lock.query('UNLOCK TABLES');
    await lock.release();
  }
  const [lease] = await source.query(
    'SELECT status, leaseToken FROM identity_account_exports WHERE id = ?',
    [interrupted.id]
  );
  assert.equal(lease.status, 'building');
  assert.ok(lease.leaseToken);
  // Accelerate only the expired lease in this disposable store after the real SIGKILL.
  await source.query(
    'UPDATE identity_account_exports SET leasedUntil = ? WHERE id = ?',
    [Date.now() - 1, interrupted.id]
  );
  await restartAccount();
  const recovered = await ready(owner, at, interrupted.id);
  assert.equal(recovered.attempts, 2);
  await download(owner, at, recovered);
  await cancel(owner, at, interrupted.id);
  const cancellationLock = source.createQueryRunner();
  await cancellationLock.connect();
  let cancelled;
  try {
    await cancellationLock.query(
      'LOCK TABLES editorial.application_drafts WRITE'
    );
    cancelled = await request(owner, at);
    await until(
      () => inspect(owner, at, cancelled.id),
      (job) => job.status === 'building',
      'Cancellation worker did not start'
    );
    await cancel(owner, at, cancelled.id);
  } finally {
    await cancellationLock.query('UNLOCK TABLES');
    await cancellationLock.release();
  }
  await delay(1000);
  assert.equal((await inspect(owner, at, cancelled.id)).status, 'cancelled');
  assert.equal(await countChunks(cancelled.id), 0);
  pass(
    'actual Account SIGKILL preserves its durable lease and recovers on restart; cancellation during blocked real capture cannot resurrect chunks or ready state'
  );

  const invalidOwner = await enroll('invalid');
  const fixture = createServer();
  let mode = 'missing';
  fixture.on('request', (request, response) => {
    request.resume();
    const time = Date.now();
    const begin = { type: 'begin', source: 'editorial', at: time };
    const end = { type: 'end', source: 'editorial', at: time, records: 0 };
    const entries =
      mode === 'missing'
        ? [begin]
        : mode === 'foreign'
        ? [begin, { ...end, source: 'discussion' }]
        : [begin, end, end];
    response.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    if (mode === 'oversized')
      response.end(
        JSON.stringify(begin) +
          '\n' +
          'x'.repeat(ACCOUNT_EXPORT_LIMITS.recordBytes + 1)
      );
    else
      response.end(
        entries.map((entry) => JSON.stringify(entry) + '\n').join('')
      );
  });
  fixture.listen(0, '127.0.0.1');
  await once(fixture, 'listening');
  try {
    // Explicit malformed-source transport probes supplement the real-provider captures above.
    await restartAccount({
      EDITORIAL_URL: `http://127.0.0.1:${fixture.address().port}`,
    });
    for (mode of ['missing', 'foreign', 'duplicate', 'oversized']) {
      const job = await request(invalidOwner, at);
      const failed = await until(
        () => inspect(invalidOwner, at, job.id),
        (value) => value.status === 'failed',
        mode + ' receipt was accepted'
      );
      assert.equal(
        failed.failure,
        mode === 'oversized' ? 'limit-exceeded' : 'invalid-source'
      );
      assert.equal(await countChunks(job.id), 0);
      await call(base + '/' + job.id + '/download', {
        at,
        token: invalidOwner.token,
        status: 409,
      });
    }
  } finally {
    await restartAccount();
    await new Promise((resolve) => fixture.close(resolve));
  }
  await stopAccount();
  try {
    const store = new MysqlAccountExports(source);
    const job = await store.request(invalidOwner.uid, randomUUID());
    const claim = await store.claim(Date.now(), randomUUID());
    assert.equal(claim.id, job.id);
    for (const captures of [
      [],
      roster.slice(1),
      [...roster.slice(0, 3), 'foreign'],
      [...roster.slice(0, 3), 'account'],
    ])
      await assert.rejects(async () =>
        store.complete(
          claim,
          {
            bytes: 1,
            sha256: '0'.repeat(64),
            chunks: 1,
            captures: captures.map((name) => ({
              source: name,
              startedAt: Date.now(),
              completedAt: Date.now(),
              records: 0,
            })),
          },
          Date.now()
        )
      );
    assert.equal(
      (await store.inspect(invalidOwner.uid, job.id)).status,
      'building'
    );
    await store.cancel(invalidOwner.uid, job.id);
  } finally {
    await restartAccount();
  }
  pass(
    'missing, foreign, duplicate and oversized source streams cannot complete; durable SQL completion independently rejects incomplete/foreign/duplicate provider receipts'
  );
}

module.exports = { qualifyExportParity };
