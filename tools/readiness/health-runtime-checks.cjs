const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const { processService } = require('./qualification-process.cjs');
const {
  ApplicationHealth,
  ObserveApplicationHealth,
} = require('../../apps/services/editorial/src/app/application-health/application-health');
const {
  MysqlApplicationHealth,
} = require('../../apps/services/editorial/src/app/application-health/mysql-application-health');
const {
  HttpHealthProbe,
} = require('../../apps/services/editorial/src/app/application-health/http-health-probe');
const {
  HealthObservations1791840018000,
} = require('../../apps/services/editorial/src/app/application-health/health-observations.migration');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');

// Coverage's expected interval count advances with time; compare the durable evidence.
const assertEvidence = (actual, expected) => {
  const facts = (rows) =>
    rows.map(
      ({
        id,
        revision,
        name,
        url,
        status,
        latest,
        measured,
        available,
        availabilityPercent,
      }) => ({
        id,
        revision,
        name,
        url,
        status,
        latest,
        measured,
        available,
        availabilityPercent,
      })
    );
  assert.deepEqual(facts(actual), facts(expected));
};

module.exports = async function qualifyHealth(options) {
  const {
    root,
    source,
    origin,
    secret,
    restart,
    policy,
    reader,
    projections,
    pass,
    output,
  } = options;
  const headers = (
    uid = 'HealthStaff',
    roles = ['editorial:health-manager'],
    tenantId = 'default'
  ) => ({
    'content-type': 'application/json',
    'x-user-id': uid,
    'x-user-claims': JSON.stringify({ tenantId, roles }),
    'x-ingress-auth': secret,
  });
  async function call(
    route,
    method = 'GET',
    body,
    claims = headers(),
    expected = 200
  ) {
    const response = await fetch(origin() + '/api/' + route, {
      method,
      headers: { ...claims, 'idempotency-key': randomUUID() },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    const value = await response.json();
    assert.equal(
      response.status,
      expected,
      route + ': ' + JSON.stringify(value)
    );
    return value;
  }
  const application = await call(
    'apps',
    'POST',
    {
      name: 'Observed application',
      slug: 'observed-application',
      website: 'https://health.example.test',
    },
    headers('HealthPublisher', ['editorial:publisher']),
    201
  );
  const empty = await call(
    'apps',
    'POST',
    {
      name: 'Unmonitored application',
      slug: 'unmonitored-application',
      website: 'https://empty.example.test',
    },
    headers('HealthPublisher', ['editorial:publisher']),
    201
  );
  for (const app of [application, empty])
    await projections.publish(
      projectEditorialSnapshot(await reader.read('app', app.id))
    );
  const read = () =>
    call(
      'catalog/application-health/observed-application',
      'GET',
      undefined,
      {}
    );
  assert.deepEqual((await read()).monitors, []);
  const id = randomUUID(),
    managerRoute = 'editorial/health-monitors/' + application.id;
  const fields = {
    expectedRevision: 0,
    expectedApplicationRevision: 1,
    name: 'Public website',
    url: 'https://health.example.test/health',
    enabled: true,
  };
  await call(managerRoute, 'GET', undefined, {}, 401);
  await call(
    managerRoute + '/' + id,
    'PUT',
    fields,
    headers('Member', []),
    403
  );
  await call(
    managerRoute + '/' + id,
    'PUT',
    fields,
    headers('Staff', ['admin'], 'private'),
    403
  );
  await call(
    managerRoute + '/' + id,
    'PUT',
    { ...fields, url: 'https://other.example.test/' },
    undefined,
    400
  );
  await call(
    managerRoute + '/' + id,
    'PUT',
    { ...fields, expectedApplicationRevision: 2 },
    undefined,
    409
  );
  const configured = await call(managerRoute + '/' + id, 'PUT', fields);
  assert.equal(configured.revision, 1);
  assert.deepEqual(
    await call(managerRoute + '/' + id, 'PUT', fields),
    configured
  );
  await call(
    managerRoute + '/' + id,
    'PUT',
    { ...fields, name: 'Conflicting replay' },
    undefined,
    409
  );
  assert.equal((await call(managerRoute)).monitors.length, 1);
  await call(
    managerRoute + '?tenantId=private',
    'GET',
    undefined,
    undefined,
    400
  );
  await call(
    'catalog/application-health/observed-application?tenantId=private',
    'GET',
    undefined,
    {},
    400
  );
  pass(
    'Staff-only HTTP configuration, tenant isolation, approved website origin, revision conflicts and immutable replay'
  );

  const migration = new HealthObservations1791840018000(),
    runner = source.createQueryRunner();
  try {
    await migration.up(runner);
    await migration.up(runner);
    await runner.query(
      'RENAME TABLE health_observations TO retained_health_observations'
    );
    try {
      await assert.rejects(migration.up(runner), /missing/);
    } finally {
      await runner.query(
        'RENAME TABLE retained_health_observations TO health_observations'
      );
    }
    await runner.query(
      "CREATE TRIGGER qualification_health_write BEFORE INSERT ON health_monitors FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected health write failure'"
    );
    const failedId = randomUUID();
    try {
      const store = new MysqlApplicationHealth(source, 'default');
      await assert.rejects(
        store.configure({
          actor: {
            identityId: 'HealthStaff',
            tenantId: 'default',
            roles: ['editorial:health-manager'],
          },
          expectedRevision: 0,
          expectedApplicationRevision: 1,
          monitor: { ...configured, id: failedId },
        })
      );
      assert.equal(
        (
          await source.query(
            'SELECT * FROM health_monitor_versions WHERE monitorId=?',
            [failedId]
          )
        ).length,
        0
      );
      await assert.rejects(migration.up(runner), /constraints/);
    } finally {
      await runner.query('DROP TRIGGER qualification_health_write');
    }
    await migration.up(runner);
    await assert.rejects(migration.down(), /authoritative/);
  } finally {
    await runner.release();
  }
  pass(
    'Real MySQL migration replay, recorded table-loss refusal, atomic configuration rollback and destructive rollback refusal'
  );

  const store = new MysqlApplicationHealth(source, 'default');
  const slot = Math.floor(Date.now() / 300000) * 300000;
  const leaseTime = slot + 100;
  const leases = await Promise.all([
    store.claim(id, randomUUID(), leaseTime),
    store.claim(id, randomUUID(), leaseTime),
  ]);
  assert.equal(leases.filter(Boolean).length, 1);
  const firstLease = leases.find(Boolean);
  const replacement = await store.claim(id, randomUUID(), leaseTime + 20001);
  assert.ok(replacement);
  const evidence = {
    monitorId: id,
    configurationRevision: 1,
    slotAt: slot,
    observedAt: leaseTime + 20002,
    status: 'operational',
    reason: 'http-success',
    httpStatus: 200,
    durationMs: 10,
  };
  await assert.rejects(
    store.record(firstLease, evidence, evidence.observedAt),
    /superseded/
  );
  await store.record(replacement, evidence, evidence.observedAt);
  await store.record(replacement, evidence, evidence.observedAt);
  await assert.rejects(
    store.record(
      replacement,
      { ...evidence, durationMs: 20 },
      evidence.observedAt
    ),
    /different evidence/
  );
  assert.equal(await store.claim(id, randomUUID(), leaseTime + 30000), null);
  await call(managerRoute + '/' + id, 'PUT', {
    ...fields,
    expectedRevision: 1,
    name: 'Current website',
  });
  assert.equal((await read()).monitors[0].latest, null);
  await assert.rejects(
    store.record(replacement, evidence, evidence.observedAt),
    /configuration changed/
  );
  for (const time of [100, 20101, 40102])
    assert.ok(await store.claim(id, randomUUID(), slot + time));
  assert.equal(await store.claim(id, randomUUID(), slot + 60103), null);
  await call(managerRoute + '/' + id, 'PUT', {
    ...fields,
    expectedRevision: 2,
    enabled: false,
  });
  assert.equal(await store.claim(id, randomUUID(), leaseTime), null);
  assert.deepEqual((await read()).monitors, []);
  await call(managerRoute + '/' + id, 'PUT', {
    ...fields,
    expectedRevision: 3,
  });
  pass(
    'Concurrent claims converge; expired leases retry at most three times; duplicate results converge; configuration changes and disabled checks fence old workers'
  );

  // Only the test transport routes the already-validated public target to localhost.
  let requests = 0;
  const fixture = http.createServer((request, response) => {
    requests++;
    assert.equal(request.headers.authorization, undefined);
    assert.equal(request.headers.cookie, undefined);
    if (request.url === '/redirect') {
      response.writeHead(302, { location: 'http://127.0.0.1/private' });
      response.end();
    } else if (request.url === '/failed') {
      response.writeHead(503);
      response.end('unavailable');
    } else if (request.url === '/slow') {
      const timer = setTimeout(() => {
        response.writeHead(200);
        response.end('slow');
      }, 2100);
      response.once('close', () => clearTimeout(timer));
    } else if (request.url === '/timeout') {
      // Keep headers pending until the production adapter's deadline aborts the socket.
    } else {
      response.writeHead(200);
      response.end('ok');
    }
  });
  await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  const probe = new HttpHealthProbe(
    async () => [{ address: '1.1.1.1', family: 4 }],
    (url, requestOptions, response) => {
      assert.equal(url.hostname, 'health.example.test');
      requestOptions.lookup(url.hostname, {}, (error, address, family) => {
        assert.equal(error, null);
        assert.equal(address, '1.1.1.1');
        assert.equal(family, 4);
      });
      return http.request(
        new URL(`http://127.0.0.1:${fixture.address().port}${url.pathname}`),
        { ...requestOptions, lookup: undefined },
        response
      );
    }
  );
  let bff;
  const restartBff = async () => {
    await bff?.stop();
    bff = await processService(
      process.execPath,
      [path.join(root, 'dist/apps/services/catalog-bff/main.js')],
      {
        cwd: root,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          HOST: '127.0.0.1',
          PORT: '0',
          EDITORIAL_URL: origin(),
          DISCUSSION_URL: 'http://127.0.0.1:1',
          EXPLORE_SERVICE_SECRET: 'qualification-health-explore-secret',
        },
      },
      (log) =>
        log.match(/Catalog BFF is running on: (http:\/\/[^\s]+)\/api/)?.[1],
      '/api/health'
    );
  };
  const bffRead = async (slug = 'observed-application', status = 200) => {
    const response = await fetch(
      bff.origin + '/api/catalog/application-health/' + slug,
      { signal: AbortSignal.timeout(20000) }
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response.json();
  };
  try {
    const blocked = new HttpHealthProbe(async () => [
      { address: '127.0.0.1', family: 4 },
    ]);
    assert.equal(
      (await blocked.observe('http://health.example.test/health')).reason,
      'blocked-target'
    );
    assert.equal(requests, 0);
    const definitions = [
      { name: 'Failure endpoint', path: '/failed' },
      { name: 'Redirect endpoint', path: '/redirect' },
      { name: 'No observations', path: '/unused' },
    ];
    for (const definition of definitions) {
      definition.id = randomUUID();
      await call(managerRoute + '/' + definition.id, 'PUT', {
        ...fields,
        name: definition.name,
        url: 'https://health.example.test' + definition.path,
      });
    }
    // The unobserved definition is intentionally absent from this controlled worker scan.
    const workerStore = Object.create(store);
    workerStore.candidates = async (after) =>
      (await store.candidates(after)).filter(
        (value) => value !== definitions[2].id
      );
    const access = new ApplicationHealth(store, policy, 'default');
    const worker = new ObserveApplicationHealth(
      access,
      workerStore,
      probe,
      randomUUID
    );
    if (Date.now() % 300000 > 275000)
      await new Promise((resolve) =>
        setTimeout(resolve, 300000 - (Date.now() % 300000) + 100)
      );
    assert.equal((await worker.batch(null)).recorded, 3);
    assert.equal(requests, 3);
    assert.equal((await worker.batch(null)).recorded, 0);
    assert.equal(requests, 3);
    const beforeRestart = await read();
    assert.equal(
      (await probe.observe('https://health.example.test/slow')).reason,
      'http-slow'
    );
    assert.equal(
      (await probe.observe('https://health.example.test/timeout')).reason,
      'timeout'
    );
    assert.deepEqual(beforeRestart.monitors.map((item) => item.status).sort(), [
      'operational',
      'outage',
      'unknown',
      'unknown',
    ]);
    for (const item of beforeRestart.monitors)
      assert.equal(item.history.length, 30);
    await restart();
    assertEvidence((await read()).monitors, beforeRestart.monitors);
    await restartBff();
    assertEvidence((await bffRead()).monitors, beforeRestart.monitors);
    await restartBff();
    assertEvidence((await bffRead()).monitors, beforeRestart.monitors);
    await bffRead('missing-app', 404);
    await bffRead('observed-application?tenantId=private', 400);
    pass(
      'Actual bounded HTTP transport persists success, failure and redirect-unknown evidence; missing measurements stay unknown across compiled Editorial/BFF restarts'
    );

    // Shift one real result into an old slot to qualify stale UI without waiting fifteen minutes.
    const current = (await read()).monitors.find((item) => item.id === id);
    const old = {
      ...current.latest,
      slotAt: current.latest.slotAt - 1800000,
      observedAt: current.latest.observedAt - 1800000,
    };
    await source.query(
      'UPDATE health_observations SET slotAt=?, observation=? WHERE monitorId=? AND configurationRevision=? AND slotAt=?',
      [
        old.slotAt,
        JSON.stringify(old),
        id,
        current.revision,
        current.latest.slotAt,
      ]
    );
    assert.equal(
      (await bffRead()).monitors.find((item) => item.id === id).status,
      'stale'
    );
    const saved = (await bffRead()).monitors;
    if (options.browser) {
      await require('./application-draft-browser.cjs').applicationDraftBrowser({
        root,
        origin,
        healthOrigin: () => bff.origin,
        headers,
        restart,
        source,
        output,
        workflowOnly: true,
        articleWorkflow: async ({ session, go, text, capture, setOffline }) => {
          const click = async (label, target) => {
            await target.waitForFunction(
              (label) =>
                [
                  ...document.querySelectorAll(
                    'application-health-api-page button'
                  ),
                ].some(
                  (button) =>
                    button.textContent.trim() === label && !button.disabled
                ),
              {},
              label
            );
            const buttons = await target.$$(
              'application-health-api-page button'
            );
            for (const button of buttons)
              if (
                await button.evaluate(
                  (element, value) => element.textContent.trim() === value,
                  label
                )
              ) {
                await button.focus();
                await target.keyboard.press('Enter');
                return;
              }
            throw new Error('Health action missing: ' + label);
          };
          const one = await session(''),
            two = await session('');
          const route = '/apps/observed-application/health';
          await go(route, one);
          await text('No recent result is available', one);
          await text('The endpoint redirected the request', one);
          await text('HTTP 503', one);
          await text('No observation has been recorded', one);
          await capture('http-health-evidence', one);
          await go(route, two);
          await text('HTTP 503', two);
          assert.equal(
            await one.$eval('application-health-api-page', (element) =>
              /99\.9|All systems operational|Database|Storage service/.test(
                element.textContent
              )
            ),
            false
          );
          setOffline((value) =>
            value.startsWith('/api/catalog/application-health/')
          );
          await click('Refresh checks', one);
          await text('Observations unavailable', one);
          assert.equal(
            await one.$$eval('.health-monitor', (elements) => elements.length),
            0
          );
          setOffline(false);
          await click('Retry checks', one);
          await text('HTTP 503', one);
          await go('/apps/unmonitored-application/health', one);
          await text('Health unknown', one);
          await go('/apps/missing-app/health', one);
          await text('Application not found', one);
          return [
            'Independent sessions read durable HTTP observations',
            'Stale, redirect, failed and unobserved states',
            'Retry removes stale success on outage',
            'Unmonitored and missing application states',
          ];
        },
      });
      pass(
        'Independent browsers, HTTP-only states and retry, 390/768/1440 layouts in light/dark themes'
      );
    }
    const pendingAt = Math.floor(Date.now() / 300000) * 300000 + 100;
    const pending = await store.claim(
      definitions[2].id,
      randomUUID(),
      pendingAt
    );
    assert.ok(pending);
    await source.query('UPDATE app_records SET isSuspended=1 WHERE id=?', [
      application.id,
    ]);
    assert.deepEqual(await store.candidates(null), []);
    assert.equal(await store.claim(id, randomUUID(), Date.now()), null);
    await assert.rejects(
      store.record(
        pending,
        {
          ...evidence,
          monitorId: pending.monitor.id,
          configurationRevision: pending.monitor.revision,
          slotAt: pending.slotAt,
          observedAt: pendingAt + 1,
        },
        pendingAt + 1
      ),
      /no longer public/
    );
    await bffRead('observed-application', 404);
    await source.query('UPDATE app_records SET isSuspended=0 WHERE id=?', [
      application.id,
    ]);
    assertEvidence((await bffRead()).monitors, saved);
    await options.stop();
    await bffRead('observed-application', 503);
    await restart();
    await restartBff();
    assertEvidence((await bffRead()).monitors, saved);
    pass(
      'Current parent withdrawal fences public reads and workers; service outage returns 503 and restart recovers committed evidence'
    );
    for (let count = 0; count < 4; count++)
      await call(managerRoute + '/' + randomUUID(), 'PUT', {
        ...fields,
        name: 'Capacity ' + count,
      });
    await call(
      managerRoute + '/' + randomUUID(),
      'PUT',
      fields,
      undefined,
      409
    );
    assert.equal((await call(managerRoute)).monitors.length, 8);
    pass('Real-store eight-monitor capacity remains bounded');
  } finally {
    await bff?.stop();
    await new Promise((resolve) => fixture.close(resolve));
  }
};
