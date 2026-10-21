const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');

// Called only by local-auth.test.cjs against its fresh, test-owned stores.
async function qualifyAccountAdmin({
  call,
  origins,
  operator,
  scoped,
  input,
  source,
  credentialSource,
  identities,
  subjectFor,
  ingressSecret,
}) {
  for (const [index, at] of origins.entries()) {
    const email = `admin-contract-${index}@example.test`;
    const target = await call('/auth/register', {
      at,
      body: { ...input, email },
      headers: { 'Idempotency-Key': `admin-contract-${index}` },
    });
    const path = (action = '', uid = target.uid) =>
      `/api/admin/users/${encodeURIComponent(uid)}${
        action ? '/' + action : ''
      }`;
    const run = (action, options = {}) =>
      call(path(action), { at, token: operator.token, ...options });
    const before = await identities.find(target.uid);
    const operations = [
      { action: 'email', method: 'PATCH', body: { email: `changed-${email}` } },
      {
        action: 'password',
        method: 'PATCH',
        body: { password: 'replacement-password' },
      },
      {
        action: 'unlink-providers',
        method: 'POST',
        body: { providersToUnlink: ['google.com'] },
      },
      {
        action: 'generate-password-reset-link',
        method: 'POST',
        body: { email },
      },
      {
        action: 'generate-email-verification-link',
        method: 'POST',
        body: { email },
      },
      { action: '', method: 'DELETE' },
      { action: 'identity', method: 'GET' },
      { action: 'deletion-status', method: 'GET' },
    ];
    for (const { action, ...options } of operations) {
      await run(action, { ...options, token: target.token, status: 403 });
      await run(action, { ...options, token: scoped.token, status: 403 });
      await run(action, { ...options, token: undefined, status: 401 });
      await run(action, {
        ...options,
        token: target.token,
        status: 403,
        headers: {
          'X-User-Id': operator.uid,
          'X-User-Claims': JSON.stringify({ roles: ['admin'] }),
          'X-Ingress-Auth': ingressSecret,
        },
      });
      await call(path(action) + '?tenantId=other', {
        at,
        token: operator.token,
        ...options,
        status: 400,
      });
      const malformed = await fetch(at + path(action, 'invalid/subject'), {
        method: options.method,
        headers: { Authorization: `Bearer ${operator.token}` },
      });
      assert(
        [400, 404].includes(malformed.status),
        'Malformed target must be rejected by BFF'
      );
    }
    assert.equal((await identities.find(target.uid)).revision, before.revision);
    assert.deepEqual(await run('identity'), {
      identityId: target.uid,
      subjectId: before.subjectId,
      revision: before.revision,
      isActive: true,
      isSuspended: false,
      isDeleted: false,
    });
    assert.equal(await run('deletion-status'), null);
    assert.equal(
      await call(path('identity', target.uid.toUpperCase()), {
        at,
        token: operator.token,
      }),
      null
    );
    await run('delete', { method: 'POST', status: 404 });
    await run('email', {
      method: 'PATCH',
      body: { email, roles: ['admin'] },
      status: 400,
    });
    await run('email', {
      method: 'PATCH',
      body: { email: 'operator@example.test' },
      status: 400,
    });
    await run('unlink-providers', {
      method: 'POST',
      body: { providersToUnlink: ['google.com'] },
      status: 400,
    });
    for (const action of [
      'generate-password-reset-link',
      'generate-email-verification-link',
    ])
      await run(action, { method: 'POST', body: { email }, status: 503 });

    await credentialSource.query(
      "CREATE TRIGGER fail_admin_credentials BEFORE UPDATE ON local_credential_users FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification credential rollback'"
    );
    try {
      await run('email', {
        method: 'PATCH',
        body: { email: `changed-${email}` },
        status: 503,
      });
      await call('/api/me', { at, token: target.token });
    } finally {
      await credentialSource.query('DROP TRIGGER fail_admin_credentials');
    }
    for (let retry = 0; retry < 2; retry++)
      assert.deepEqual(
        await run('email', {
          method: 'PATCH',
          body: { email: `changed-${email}` },
        }),
        { updated: true }
      );
    await call('/api/me', { at, token: target.token, status: 401 });
    await call('/auth/signin', {
      at,
      body: { email, password: input.password },
      status: 401,
    });
    const changed = await call('/auth/signin', {
      at,
      body: { email: `changed-${email}`, password: input.password },
    });
    assert.equal(changed.uid, target.uid);
    assert.deepEqual(
      await run('password', {
        method: 'PATCH',
        body: { password: 'replacement-password' },
      }),
      { updated: true }
    );
    await call('/api/me', { at, token: changed.token, status: 401 });
    await call('/auth/refresh', {
      at,
      body: { refreshToken: changed.refreshToken },
      status: 401,
    });
    await call('/auth/signin', {
      at,
      body: { email: `changed-${email}`, password: input.password },
      status: 401,
    });
    const replaced = await call('/auth/signin', {
      at,
      body: { email: `changed-${email}`, password: 'replacement-password' },
    });
    assert.equal(replaced.uid, target.uid);

    await source.query(
      "CREATE TRIGGER fail_admin_delete BEFORE UPDATE ON identities FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification delete rollback'"
    );
    try {
      await run('', { method: 'DELETE', status: 503 });
      assert.equal((await identities.find(target.uid)).isDeleted, false);
      assert.equal(await run('deletion-status'), null);
    } finally {
      await source.query('DROP TRIGGER fail_admin_delete');
    }
    const deleted = await run('', { method: 'DELETE', status: 202 });
    assert.deepEqual(deleted, {
      identityId: target.uid,
      revision: before.revision + 1,
      status: 'accepted',
      cleanup: 'pending',
    });
    assert.deepEqual(await run('', { method: 'DELETE', status: 202 }), deleted);
    await call('/api/me', { at, token: replaced.token, status: 401 });
    const subject = await subjectFor(target.uid);
    for (let attempt = 0; ; attempt++) {
      const [record] = await credentialSource.query(
        'SELECT deleted, email, password_hash FROM local_credential_users WHERE uid = ?',
        [subject]
      );
      if (record.deleted) {
        assert.equal(record.email, null);
        assert.equal(record.password_hash, null);
        break;
      }
      assert(attempt < 100, 'Credential cleanup did not complete');
      await delay(100);
    }
    // Credential deletion alone is not completion of the full erasure saga.
    assert.deepEqual(await run('deletion-status'), deleted);
    await source.query(
      'UPDATE identity_erasure_jobs SET failedAt = ? WHERE identityId = ?',
      [Date.now(), target.uid]
    );
    assert.deepEqual(await run('deletion-status'), {
      ...deleted,
      cleanup: 'failed',
    });
    await source.query(
      'UPDATE identity_erasure_jobs SET failedAt = NULL WHERE identityId = ?',
      [target.uid]
    );
    assert.deepEqual(await run('deletion-status'), deleted);
    assert.equal(
      (await identities.find(target.uid)).revision,
      deleted.revision
    );
  }
  console.log(
    'PASS remaining staff administration through both BFF gateways: tenant/forged denial, credential changes and revocation, rollback/retry, truthful unavailable provider actions, deletion replay and read-only combined cleanup status'
  );
}

module.exports = { qualifyAccountAdmin };
