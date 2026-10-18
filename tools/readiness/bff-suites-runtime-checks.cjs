const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const execute = promisify(execFile);
const base = '/api/me/suites';

async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE;
  const project = process.env.WAPPS_BFF_COMPOSE_PROJECT;
  const report = process.env.WAPPS_BFF_REPORT;
  assert.ok(compose && project && report);
  const users = [],
    suites = [],
    checks = [],
    erased = [],
    stopped = new Set(),
    cleanupErrors = [];
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
          suites,
          disposableIdentities: users.map((u) => u.uid),
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
    path = base,
    {
      user = users[0],
      method = 'GET',
      body,
      key,
      headers = {},
      status = 200,
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
      signal: AbortSignal.timeout(25000),
    });
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      `${method} ${path}: HTTP ${response.status}, expected ${status}`
    );
    if (response.ok && path.startsWith('/api/'))
      assert.ok(response.headers.get('cache-control')?.includes('no-store'));
    const text = await response.text();
    return {
      response,
      value:
        text.startsWith('[') || text.startsWith('{') ? JSON.parse(text) : null,
    };
  }
  async function until(read, label) {
    let last;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        return await read();
      } catch (error) {
        last = error;
        await delay(500);
      }
    }
    throw new Error(label, { cause: last });
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
  const read = (id) => call(base + '/' + id).then((r) => r.value);
  const create = async (fields, key) => {
    const receipt = (
      await call(base, { method: 'POST', body: fields, key, status: 201 })
    ).value;
    if (!suites.includes(receipt.id)) {
      suites.push(receipt.id);
      persist();
    }
    return receipt;
  };
  const update = async (id, body, key = randomUUID()) =>
    (await call(base + '/' + id, { method: 'PUT', body, key })).value;
  const fieldValues = (suite) => ({
    title: suite.title,
    description: suite.description,
    applicationIds: suite.applicationIds,
    classification: suite.classification,
  });
  try {
    for (const nickname of ['BFF Suite Owner', 'BFF Suite Other']) {
      const user = {
        email: 'bff-suite-' + randomUUID() + '@wapps-review.test',
        password: randomUUID() + '!Aa1',
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
              password: user.password,
              passwordConfirmation: user.password,
              nickname,
            },
          })
        ).value
      );
      persist();
      assert.ok(user.uid && user.token);
    }
    const [owner, other] = users;
    assert.deepEqual((await call()).value, []);
    for (const user of [null, { token: 'invalid-session' }])
      await call(base, { user, status: 401 });
    await call(base + '?ownerIdentityId=' + other.uid, { status: 400 });
    await call(base + '/invalid-id', { status: 400 });
    assert.deepEqual(
      (
        await call(base, {
          headers: {
            'X-User-Id': other.uid,
            'X-Ingress-Auth': 'forged',
            'X-User-Claims': '{"roles":["admin"]}',
          },
        })
      ).value,
      []
    );
    pass(
      'private empty workspace and strict selectors require verified identity; spoofed identity headers cannot select another owner'
    );

    const catalogPath =
      '/api/catalog/apps?search=&page=1&pageSize=20&sort=name';
    const catalog = (await call(catalogPath)).value;
    assert.ok(
      catalog.items.length >= 2,
      'Provide two existing public applications without reseeding'
    );
    const [first, second] = catalog.items;
    const ids = [first.id, second.id];
    const selectionPath = '/api/catalog/app-selection?ids=' + ids.join(',');
    const selection = (await call(selectionPath)).value.items;
    assert.deepEqual(
      selection.map((app) => app.id),
      ids
    );
    assert.deepEqual(
      selection.map((app) => app.name),
      [first.name, second.name]
    );
    const search = (
      await call(
        '/api/catalog/apps?search=' +
          encodeURIComponent(first.name) +
          '&page=1&pageSize=20&sort=name'
      )
    ).value;
    assert.ok(search.items.some((app) => app.id === first.id));
    assert.deepEqual(
      (await call('/api/catalog/app-selection?ids=' + randomUUID())).value
        .items,
      []
    );
    pass(
      'application search and ordered ID resolution use BFF and real public metadata; missing targets are not fabricated'
    );

    const fields = {
      title: 'Disposable BFF suite ' + randomUUID().slice(0, 8),
      description: 'Local BFF qualification collection',
      applicationIds: ids,
      classification: 'general',
    };
    const createKey = randomUUID();
    const created = await create(fields, createKey);
    assert.deepEqual(created, { id: created.id, revision: 1, deleted: false });
    assert.deepEqual(await create(fields, createKey), created);
    await call(base, {
      method: 'POST',
      body: { ...fields, title: 'Different' },
      key: createKey,
      status: 409,
    });
    let current = await read(created.id);
    assert.deepEqual(fieldValues(current), fields);
    assert.equal(current.visibility, 'private');
    assert.equal((await call()).value.length, 1);
    const independent = (
      await call('/auth/signin', {
        user: null,
        method: 'POST',
        body: { email: owner.email, password: owner.password },
      })
    ).value;
    assert.equal(independent.uid, owner.uid);
    assert.deepEqual(
      (await call(base + '/' + created.id, { user: independent })).value,
      current
    );
    pass(
      'create and replay persist one canonical suite; a separately authenticated session reads the same saved content'
    );

    for (const method of ['GET', 'PUT', 'DELETE']) {
      await call(base + '/' + created.id, {
        user: other,
        method,
        key: randomUUID(),
        status: 404,
        body:
          method === 'GET'
            ? undefined
            : method === 'PUT'
            ? { ...fields, expectedRevision: 1 }
            : { expectedRevision: 1 },
      });
    }
    await call(base + '/' + created.id, {
      user: other,
      headers: {
        'X-User-Id': owner.uid,
        'X-User-Claims': '{"tenantId":"default","roles":["admin"]}',
      },
      status: 404,
    });
    for (const body of [
      { ...fields, ownerIdentityId: other.uid },
      { ...fields, applicationIds: [] },
      { ...fields, applicationIds: [first.id, first.id] },
      { ...fields, applicationIds: [randomUUID()] },
    ])
      await call(base, {
        method: 'POST',
        body,
        key: randomUUID(),
        status: 400,
      });
    await call(base, { method: 'POST', body: fields, status: 400 });
    assert.deepEqual((await call(base, { user: other })).value, []);
    pass(
      'other owners cannot read, edit or delete; invalid or unavailable new application references are rejected by the owner'
    );

    const reordered = {
      ...fields,
      title: fields.title + ' edited',
      applicationIds: [...ids].reverse(),
      classification: 'mature',
      expectedRevision: current.revision,
    };
    const updateKey = randomUUID();
    const saved = await update(created.id, reordered, updateKey);
    assert.deepEqual(await update(created.id, reordered, updateKey), saved);
    current = await read(created.id);
    assert.deepEqual(current.applicationIds, reordered.applicationIds);
    assert.equal(current.classification, 'mature');
    await call(base + '/' + created.id, {
      method: 'PUT',
      body: reordered,
      key: randomUUID(),
      status: 409,
    });
    const removal = {
      ...fieldValues(current),
      applicationIds: [second.id],
      expectedRevision: current.revision,
    };
    await update(created.id, removal);
    current = await read(created.id);
    assert.deepEqual(current.applicationIds, [second.id]);
    await update(created.id, {
      ...fieldValues(current),
      applicationIds: [second.id, first.id],
      expectedRevision: current.revision,
    });
    current = await read(created.id);
    assert.deepEqual(current.applicationIds, [second.id, first.id]);
    pass(
      'edit, reorder, remove and add preserve membership order and proposed classification; stale writes conflict and retries do not duplicate changes'
    );

    await service('stop', 'catalog-bff');
    for (const path of [
      base,
      base + '/',
      '/api/me/Suites',
      base + '/' + created.id,
      '/api/me/Suites/' + created.id + '/',
      catalogPath,
      selectionPath,
    ])
      await call(path, { status: [502, 504] });
    for (const [method, path, body] of [
      ['POST', base, fields],
      [
        'PUT',
        base + '/' + created.id,
        { ...fieldValues(current), expectedRevision: current.revision },
      ],
      [
        'DELETE',
        base + '/' + created.id,
        { expectedRevision: current.revision },
      ],
    ])
      await call(path, { method, body, key: randomUUID(), status: [502, 504] });
    await call('/api/me/articles', { status: [502, 503, 504] });
    await service('start', 'catalog-bff');
    await until(() => call(), 'BFF did not recover');
    assert.deepEqual(await read(created.id), current);
    assert.deepEqual(await create(fields, createKey), created);
    pass(
      'suite CRUD, case/slash variants, search and selection require BFF; restart preserves the suite and original receipts'
    );

    const retryKey = randomUUID();
    const retryBody = {
      ...fieldValues(current),
      description: 'Retry after Editorial outage',
      expectedRevision: current.revision,
    };
    await service('stop', 'editorial');
    for (const path of [
      base,
      base + '/' + created.id,
      catalogPath,
      selectionPath,
    ]) {
      const result = await call(path, { status: 503 });
      assert.equal(result.response.headers.get('retry-after'), '2');
    }
    await call(base, {
      method: 'POST',
      body: fields,
      key: randomUUID(),
      status: 503,
    });
    await call(base + '/' + created.id, {
      method: 'PUT',
      body: retryBody,
      key: retryKey,
      status: 503,
    });
    await call(base + '/' + created.id, {
      method: 'DELETE',
      body: { expectedRevision: current.revision },
      key: randomUUID(),
      status: 503,
    });
    await call('/api/me/profile');
    await service('start', 'editorial');
    await until(() => call(), 'Editorial did not recover');
    assert.deepEqual(await read(created.id), current);
    const retried = await update(created.id, retryBody, retryKey);
    assert.deepEqual(await update(created.id, retryBody, retryKey), retried);
    current = await read(created.id);
    assert.equal(current.description, retryBody.description);
    pass(
      'Editorial outages fail explicitly; SQL content survives restart and the retained command can be retried once safely'
    );

    await service('stop', 'mongodb');
    await call(selectionPath, { status: 503 });
    assert.deepEqual(await read(created.id), current);
    const canonical = {
      ...fieldValues(current),
      applicationIds: [first.id],
      expectedRevision: current.revision,
    };
    await update(created.id, canonical);
    current = await read(created.id);
    assert.deepEqual(current.applicationIds, [first.id]);
    await service('start', 'mongodb');
    await until(
      () => call(selectionPath),
      'Catalog projections did not recover'
    );
    pass(
      'projection outage does not replace canonical suite authority: metadata fails explicitly while private reads and member removal still work'
    );

    const deleteKey = randomUUID();
    const deleteBody = { expectedRevision: current.revision };
    const deleted = (
      await call(base + '/' + created.id, {
        method: 'DELETE',
        body: deleteBody,
        key: deleteKey,
      })
    ).value;
    assert.deepEqual(deleted, {
      id: created.id,
      revision: current.revision + 1,
      deleted: true,
    });
    assert.deepEqual(
      (
        await call(base + '/' + created.id, {
          method: 'DELETE',
          body: deleteBody,
          key: deleteKey,
        })
      ).value,
      deleted
    );
    assert.deepEqual(await create(fields, createKey), created);
    assert.deepEqual(await update(created.id, reordered, updateKey), saved);
    await call(base + '/' + created.id, { status: 404 });
    assert.deepEqual((await call()).value, []);
    await service('stop', 'editorial');
    await service('start', 'editorial');
    await until(() => call(), 'Editorial did not recover after deletion');
    assert.deepEqual(await create(fields, createKey), created);
    await call(base + '/' + created.id, { status: 404 });
    pass(
      'delete is repeatable; tombstones and historical create/update receipts cannot resurrect a suite, including after restart'
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
      try {
        await until(() => call(), 'Suite services did not recover for cleanup');
        for (const id of suites) {
          const result = await call(base + '/' + id, { status: [200, 404] });
          if (result.response.status === 200)
            await call(base + '/' + id, {
              method: 'DELETE',
              body: { expectedRevision: result.value.revision },
              key: randomUUID(),
            });
        }
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    for (const user of [...users].reverse()) {
      if (!user.uid) continue;
      try {
        await call('/api/me', { user, method: 'DELETE', status: 202 });
        erased.push(user.uid);
        persist();
        await call(base, { user, status: [401, 403] });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }
  if (failure || cleanupErrors.length)
    throw new AggregateError(
      [...(failure ? [failure] : []), ...cleanupErrors],
      cleanupErrors.length
        ? 'Suite cleanup incomplete; use recovery records'
        : 'Suite qualification failed'
    );
  pass(
    'disposable suites removed and both test accounts erased with access denied; existing accounts and content preserved'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
