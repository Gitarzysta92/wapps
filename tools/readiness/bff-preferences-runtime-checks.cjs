const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const execute = promisify(execFile);

async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(
    ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname),
    'This qualifier requires a local review stack'
  );
  assert.equal(origin.protocol, 'http:');
  const accounts = JSON.parse(
    readFileSync(process.env.WAPPS_BFF_ACCOUNTS_FILE, 'utf8')
  );
  const { member, staff } = accounts;
  assert.ok(member?.token && staff?.token && member.uid !== staff.uid);
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE;
  const project = process.env.WAPPS_BFF_COMPOSE_PROJECT;
  const output = process.env.WAPPS_BFF_REPORT;
  assert.ok(
    compose && project && output,
    'Compose context and report are required'
  );
  const checks = [];
  const pass = (name) => {
    checks.push(name);
    console.log('PASS ' + name);
  };
  async function service(action, name) {
    await execute(
      'docker',
      ['compose', '-f', compose, '-p', project, action, name],
      {
        timeout: 45000,
        maxBuffer: 65536,
      }
    );
  }
  async function call({
    user = member,
    route = '/api/me/preferences',
    method = 'GET',
    body,
    key,
    headers = {},
    status = 200,
  } = {}) {
    const response = await fetch(new URL(route, origin), {
      method,
      headers: {
        ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
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
    if (status === 200 && route.startsWith('/api/me/preferences'))
      assert.ok(
        response.headers
          .get('cache-control')
          ?.split(/,\s*/)
          .includes('no-store')
      );
    const text = await response.text();
    return { value: text.startsWith('{') ? JSON.parse(text) : text, response };
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

  const before = (await call()).value;
  const otherBefore = (await call({ user: staff })).value;
  assert.equal(before.identityId, member.uid);
  assert.equal(otherBefore.identityId, staff.uid);
  // Keep a recovery record before any write. It contains no session credentials.
  writeFileSync(output, JSON.stringify({ before, checks }, null, 2), {
    mode: 0o600,
  });
  const changed = structuredClone(before.preferences);
  changed.display.defaultView =
    changed.display.defaultView === 'grid' ? 'list' : 'grid';
  const command = { expectedRevision: before.revision, preferences: changed };
  const key = randomUUID();
  let bffStopped = false;
  let accountStopped = false;
  let attemptedWrite = false;
  let restored = false;
  try {
    await call({ user: null, status: 401 });
    await call({ user: { token: 'invalid-session' }, status: 401 });
    assert.deepEqual(
      (
        await call({
          headers: { 'X-User-Id': staff.uid, 'X-Ingress-Auth': 'forged' },
        })
      ).value,
      before
    );
    await call({
      route: '/api/me/preferences?identityId=' + staff.uid,
      status: 400,
    });
    pass(
      'real authentication, identity-header replacement and self-only selection'
    );

    attemptedWrite = true;
    const receipt = (await call({ method: 'PUT', body: command, key })).value;
    assert.deepEqual(receipt, {
      identityId: member.uid,
      revision: before.revision + 1,
    });
    assert.deepEqual(
      (await call({ method: 'PUT', body: command, key })).value,
      receipt
    );
    const saved = (await call()).value;
    assert.equal(saved.revision, receipt.revision);
    assert.deepEqual(saved.preferences, changed);
    assert.deepEqual(
      (await call({ route: '/api/me/preferences/' })).value,
      saved
    );
    assert.deepEqual((await call({ user: staff })).value, otherBefore);
    pass(
      'durable save, same-key replay, trailing-slash route and account isolation'
    );

    await call({
      method: 'PUT',
      body: command,
      key: randomUUID(),
      status: 409,
    });
    await call({
      method: 'PUT',
      body: { ...command, preferences: before.preferences },
      key,
      status: 409,
    });
    await call({ method: 'PUT', body: command, status: 400 });
    assert.deepEqual((await call()).value, saved);
    pass('stale revision, reused-key mismatch and missing-key rejection');

    bffStopped = true;
    await service('stop', 'catalog-bff');
    await call({ status: [502, 504] });
    await call({ route: '/api/me/preferences/', status: [502, 504] });
    await call({ route: '/api/me/Preferences', status: [502, 504] });
    await call({ route: '/api/me/articles', status: [502, 503, 504] });
    await service('start', 'catalog-bff');
    bffStopped = false;
    assert.deepEqual(await ready(), saved);
    pass(
      'canonical, trailing-slash and case-variant paths require BFF; unmigrated application drafts stay available'
    );

    accountStopped = true;
    await service('stop', 'account-management');
    const unavailable = await call({ status: 503 });
    assert.ok(
      unavailable.response.headers
        .get('cache-control')
        ?.split(/,\s*/)
        .includes('no-store')
    );
    assert.equal(unavailable.response.headers.get('retry-after'), '2');
    const retryKey = randomUUID();
    const next = { expectedRevision: saved.revision, preferences: changed };
    await call({ method: 'PUT', body: next, key: retryKey, status: 503 });
    await service('start', 'account-management');
    accountStopped = false;
    assert.deepEqual(await ready(), saved);
    const retry = (await call({ method: 'PUT', body: next, key: retryKey }))
      .value;
    assert.equal(retry.revision, saved.revision + 1);
    assert.deepEqual(
      (await call({ method: 'PUT', body: next, key: retryKey })).value,
      retry
    );
    pass(
      'Account outage fails explicitly; restart preserves SQL state and same-key retry works'
    );
  } finally {
    if (bffStopped) await service('start', 'catalog-bff');
    if (accountStopped) await service('start', 'account-management');
    const current = await ready();
    if (attemptedWrite) {
      if (
        JSON.stringify(current.preferences) !==
        JSON.stringify(before.preferences)
      ) {
        assert.deepEqual(
          current.preferences,
          changed,
          'Concurrent preference edit; inspect recovery report'
        );
        await call({
          method: 'PUT',
          body: {
            expectedRevision: current.revision,
            preferences: before.preferences,
          },
          key: randomUUID(),
        });
      }
    }
    assert.deepEqual((await call()).value.preferences, before.preferences);
    assert.deepEqual((await call({ user: staff })).value, otherBefore);
    restored = true;
    writeFileSync(
      output,
      JSON.stringify({ before, checks, restored }, null, 2),
      { mode: 0o600 }
    );
  }
  pass('original preferences restored and second account unchanged');
  writeFileSync(output, JSON.stringify({ before, checks, restored }, null, 2), {
    mode: 0o600,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
