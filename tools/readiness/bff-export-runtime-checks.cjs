const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { gunzipSync } = require('node:zlib');
const { setTimeout: delay } = require('node:timers/promises');
const execute = promisify(execFile);

async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE;
  const project = process.env.WAPPS_BFF_COMPOSE_PROJECT;
  const report = process.env.WAPPS_BFF_REPORT;
  assert.ok(compose && project && report);
  const users = [],
    checks = [],
    jobs = [],
    erased = [],
    stopped = new Set();
  const cleanupErrors = [];
  let failure;
  const persist = () => {
    writeFileSync(report + '.accounts.json', JSON.stringify(users, null, 2), {
      mode: 0o600,
    });
    writeFileSync(
      report,
      JSON.stringify(
        {
          checks,
          jobs,
          disposableIdentities: users.map((user) => user.uid),
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
    path = '/api/me/exports',
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
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
  async function until(read, matches, label) {
    let last;
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        const value = await read();
        if (matches(value)) return value;
        last = value?.status;
      } catch (error) {
        last = error.message;
      }
      await delay(500);
    }
    throw Error(label + ': ' + String(last));
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
  const readyService = () =>
    until(
      () => call('/api/me/profile').then((r) => r.value),
      (value) => value?.identityId === users[0].uid,
      'Account did not recover'
    );
  const inspect = (id) =>
    call('/api/me/exports/' + id).then((result) => result.value);
  const readyJob = (id) =>
    until(
      () => inspect(id),
      (value) => value?.status === 'ready',
      'Export did not become ready'
    );
  async function request(key) {
    const job = (
      await call('/api/me/exports', {
        method: 'POST',
        body: {},
        key,
        status: 202,
      })
    ).value;
    if (!jobs.includes(job.id)) {
      jobs.push(job.id);
      persist();
    }
    return job;
  }
  async function download(job) {
    const result = await call('/api/me/exports/' + job.id + '/download', {
      binary: true,
    });
    assert.equal(
      result.response.headers.get('content-type'),
      'application/gzip'
    );
    assert.equal(
      result.response.headers.get('content-length'),
      String(job.bytes)
    );
    assert.equal(
      result.response.headers.get('content-disposition'),
      `attachment; filename="wapps-account-${job.id}.ndjson.gz"`
    );
    assert.equal(
      result.response.headers.get('x-content-type-options'),
      'nosniff'
    );
    assert.ok(
      result.response.headers.get('content-security-policy').includes('sandbox')
    );
    assert.equal(result.value.length, job.bytes);
    assert.equal(
      createHash('sha256').update(result.value).digest('hex'),
      job.sha256
    );
    return result.value;
  }
  try {
    for (const nickname of ['BFF Export Owner', 'BFF Export Other']) {
      const password = randomUUID() + '!Aa1';
      const user = {
        email: 'bff-export-' + randomUUID() + '@wapps-review.test',
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
      assert.ok(user.uid && user.token);
    }
    const [owner, other] = users;
    assert.deepEqual((await call()).value, { job: null });
    for (const user of [null, { token: 'invalid-session' }])
      await call('/api/me/exports', { user, status: 401 });
    await call('/api/me/exports?identityId=' + other.uid, { status: 400 });
    await call('/api/me/exports', {
      method: 'POST',
      body: { identityId: other.uid },
      key: randomUUID(),
      status: 400,
    });
    await call('/api/me/exports', { method: 'POST', body: {}, status: 400 });
    const spoofed = await call('/api/me/exports', {
      headers: {
        'X-User-Id': other.uid,
        'X-Ingress-Auth': 'forged',
        'X-User-Claims': '{"roles":["admin"]}',
      },
    });
    assert.deepEqual(spoofed.value, { job: null });
    pass(
      'trusted member identity, no-job status and strict request selectors are preserved through BFF'
    );

    const key = randomUUID(),
      initial = await request(key);
    assert.equal((await request(key)).id, initial.id);
    await call('/api/me/exports', {
      method: 'POST',
      body: {},
      key: randomUUID(),
      status: 409,
    });
    const job = await readyJob(initial.id);
    assert.equal((await call()).value.job.id, job.id);
    assert.equal((await request(key)).id, job.id);
    pass(
      'durable export request returns 202, same-key retries retain one job and another active request conflicts'
    );

    const bytes = await download(job);
    const lines = gunzipSync(bytes, { maxOutputLength: 8 * 1024 * 1024 })
      .toString()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(lines[0].type, 'manifest');
    assert.equal(lines[0].identityId, owner.uid);
    assert.equal(lines[0].format, 'wapps-account-export');
    const sources = ['account', 'credentials', 'editorial', 'discussion'];
    assert.deepEqual(lines[0].sources, sources);
    assert.deepEqual(
      lines.filter((line) => line.type === 'end').map((line) => line.source),
      sources
    );
    assert.equal(lines.at(-1).type, 'complete');
    assert.deepEqual(
      lines.at(-1).captures.map((item) => item.source),
      sources
    );
    const profile = lines.find(
      (line) =>
        line.type === 'record' &&
        line.source === 'account' &&
        line.collection === 'profile'
    );
    assert.equal(profile.data.profile.name, owner.nickname);
    const credential = lines.find(
      (line) =>
        line.type === 'record' &&
        line.source === 'credentials' &&
        line.collection === 'credential-user'
    );
    const bindings = lines.filter(
      (line) =>
        line.type === 'record' &&
        line.source === 'account' &&
        line.collection === 'credential-binding'
    );
    assert.ok(
      bindings.some((line) => line.data.subject === credential.data.uid)
    );
    const text = JSON.stringify(lines);
    for (const secret of [owner.token, owner.password, other.uid, other.email])
      assert.ok(!text.includes(secret));
    for (const field of [
      'passwordHash',
      'passwordSalt',
      'customClaims',
      'refreshToken',
      'accessToken',
    ])
      assert.ok(!text.includes('"' + field + '"'));
    pass(
      'complete four-source gzip archive streams through BFF with exact size/digest and safe private attachment headers'
    );

    const path = '/api/me/exports/' + job.id;
    for (const [route, method] of [
      [path, 'GET'],
      [path, 'DELETE'],
      [path + '/download', 'GET'],
    ])
      await call(route, { user: other, method, status: [403, 404] });
    assert.deepEqual((await call('/api/me/exports', { user: other })).value, {
      job: null,
    });
    await call(path + '/download', {
      headers: { Range: 'bytes=0-9' },
      status: 400,
    });
    await call(path + '/download', { method: 'HEAD', status: 405 });
    pass(
      'another account cannot inspect, revoke or download the archive; range and HEAD downloads are rejected'
    );

    await service('stop', 'catalog-bff');
    for (const route of ['/api/me/exports', path, path + '/download']) {
      await call(route, { status: [502, 504] });
      await call(
        route
          .replace('/api/me/exports', '/API/ME/EXPORTS')
          .replace('/download', '/DOWNLOAD') + '/',
        { status: [502, 504] }
      );
    }
    await call('/api/me/exports', {
      method: 'POST',
      body: {},
      key,
      status: [502, 504],
    });
    await call(path, { method: 'DELETE', status: [502, 504] });
    await call('/api/me/articles', { status: [502, 503, 504] });
    await service('start', 'catalog-bff');
    await readyService();
    assert.deepEqual(await download(await inspect(job.id)), bytes);
    pass(
      'every export read/command/download requires BFF, including case/slash variants; BFF restart preserves the archive'
    );

    await service('stop', 'account-management');
    for (const route of ['/api/me/exports', path + '/download']) {
      const response = await call(route, { status: 503 });
      assert.equal(response.response.headers.get('retry-after'), '2');
    }
    await call('/api/me/exports', {
      method: 'POST',
      body: {},
      key,
      status: 503,
    });
    await service('start', 'account-management');
    await readyService();
    assert.deepEqual(await download(await inspect(job.id)), bytes);
    assert.equal((await request(key)).id, job.id);
    pass(
      'Account outage fails explicitly; restart preserves stored archive and request replay without another capture'
    );

    for (let attempt = 0; attempt < 2; attempt++)
      assert.equal(
        (await call(path, { method: 'DELETE' })).value.status,
        'cancelled'
      );
    assert.equal((await request(key)).status, 'cancelled');
    await call(path + '/download', { status: 409 });
    pass(
      'revocation is repeatable and immediately blocks downloads; historical request retries cannot recreate the archive'
    );

    await service('stop', 'discussion');
    const recovering = await request(randomUUID());
    await until(
      () => inspect(recovering.id),
      (value) => value.attempts > 0 && value.status === 'queued',
      'Missing source did not leave a retryable job'
    );
    await call('/api/me/exports/' + recovering.id + '/download', {
      status: 409,
    });
    await service('start', 'discussion');
    const recovered = await readyJob(recovering.id);
    await download(recovered);
    pass(
      'a missing source never yields a partial ready archive; the same durable job completes after source recovery'
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
    if (users[0]?.uid) {
      for (const id of jobs) {
        try {
          await call('/api/me/exports/' + id, { method: 'DELETE' });
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
    }
    for (const user of [...users].reverse()) {
      if (!user.uid) continue;
      try {
        await call('/api/me', { user, method: 'DELETE', status: 202 });
        erased.push(user.uid);
        persist();
        await call('/api/me/exports', { user, status: [401, 403] });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }
  if (failure || cleanupErrors.length)
    throw new AggregateError(
      [...(failure ? [failure] : []), ...cleanupErrors],
      cleanupErrors.length
        ? 'Export cleanup incomplete; use recovery records'
        : 'Export qualification failed'
    );
  pass(
    'test archives revoked and deletion accepted for both disposable accounts with access denied; full cross-service erasure completion remains unqualified'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
