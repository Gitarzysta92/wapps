const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { processService } = require('./qualification-process.cjs');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');

// The runner owns disposable SQL/Mongo/OPA and Editorial. Authentication is an explicit fixture.
module.exports = async function qualifyHealthMonitors({
  root,
  source,
  origin,
  secret,
  restart,
  stop,
  stopPolicy,
  reader,
  projections,
  pass,
  output,
}) {
  const directory = path.join(output, 'health-monitor-gateways');
  fs.mkdirSync(directory, { recursive: true });
  const name = 'wapps-health-bff-' + randomUUID();
  const docker = (args) =>
    execFileSync('docker', args, {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const actors = {
    staff: {
      uid: 'HealthBffStaff',
      roles: ['editorial:health-manager'],
      tenantId: 'default',
    },
    member: { uid: 'HealthBffMember', roles: [], tenantId: 'default' },
    tenant: {
      uid: 'HealthBffTenantStaff',
      roles: ['admin'],
      tenantId: 'other',
    },
    erased: {
      uid: 'HealthBffErasedStaff',
      roles: ['editorial:health-manager'],
      tenantId: 'default',
    },
  };
  const trusted = (actor) => ({
    'x-ingress-auth': secret,
    'x-user-id': actor.uid,
    'x-anonymous': 'false',
    'x-user-claims': JSON.stringify({
      roles: actor.roles,
      tenantId: actor.tenantId,
    }),
  });
  let bff,
    ingressStarted = false,
    bffRequests = 0,
    ownerWrites = 0,
    loseNextReply = false;
  const servers = [];
  const listen = async (handler) => {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
    return server.address().port;
  };
  function forward(request, response, target, loseReply = false) {
    const upstream = http.request(
      new URL(request.url, target),
      { method: request.method, headers: request.headers },
      (received) => {
        if (loseReply) {
          received.resume();
          received.on('end', () => response.destroy());
        } else {
          response.writeHead(received.statusCode, received.headers);
          received.pipe(response);
        }
      }
    );
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    upstream.setTimeout(15000, () => upstream.destroy());
    request.pipe(upstream);
  }
  async function request(
    at,
    route,
    { method = 'GET', body, actor = 'staff', status = 200, headers = {} } = {}
  ) {
    const response = await fetch(at + route, {
      method,
      headers: {
        ...(actor ? { authorization: 'Bearer ' + actor } : {}),
        ...headers,
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    assert.equal(response.status, status, `${method} ${route}: ${text}`);
    if (status !== 502 && status !== 413 && status !== 404 && status !== 401) {
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.ok(!text.includes('injected health') && !text.includes(secret));
    }
    return response.headers.get('content-type')?.startsWith('application/json')
      ? JSON.parse(text)
      : text;
  }
  try {
    const ownerPort = await listen((req, res) => {
      if (req.method === 'PUT') ownerWrites++;
      const lost = loseNextReply && req.method === 'PUT';
      if (lost) loseNextReply = false;
      forward(req, res, origin(), lost);
    });
    const bffPort = await listen((req, res) => {
      if (req.url.startsWith('/api/internal/authentication/validate')) {
        const actor =
          actors[String(req.headers.authorization).replace(/^Bearer /, '')];
        res.writeHead(actor ? 204 : 401, actor ? trusted(actor) : {});
        res.end();
        return;
      }
      bffRequests++;
      forward(req, res, bff.origin);
    });
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
            EDITORIAL_URL: `http://127.0.0.1:${ownerPort}`,
            INGRESS_AUTH_SECRET: secret,
            DISCUSSION_URL: 'http://127.0.0.1:1',
            EXPLORE_SERVICE_SECRET: 'qualification-health-explore-secret',
          },
        },
        (log) =>
          log.match(/Catalog BFF is running on: (http:\/\/[^\s]+)\/api/)?.[1],
        '/api/health'
      );
    };
    await restartBff();
    for (const environment of ['local', 'alpha']) {
      const prefix = environment === 'local' ? 'local' : 'wapps';
      const config = fs
        .readFileSync(
          path.join(root, `deploy/${environment}/nginx/api.conf`),
          'utf8'
        )
        .replaceAll(`/etc/nginx/${prefix}/`, '/etc/nginx/qualification/')
        .replaceAll('/auth.conf', `/${environment}-auth.conf`)
        .replace(/http:\/\/([a-z_-]+)(?::\d+)?/g, (_match, service) =>
          service === 'local_auth'
            ? 'http://local_auth'
            : `http://host.docker.internal:${
                service === 'catalog-bff'
                  ? bffPort
                  : service === 'editorial'
                  ? ownerPort
                  : 1
              }`
        );
      fs.writeFileSync(path.join(directory, environment + '-api.conf'), config);
      fs.copyFileSync(
        path.join(root, `deploy/${environment}/nginx/auth.conf`),
        path.join(directory, environment + '-auth.conf')
      );
    }
    fs.writeFileSync(
      path.join(directory, 'application-media.conf'),
      '# Media is outside the health monitor qualification.\n'
    );
    fs.writeFileSync(
      path.join(directory, 'nginx.conf'),
      `events {}\nhttp {
      access_log off;
      limit_req_zone $binary_remote_addr zone=identity_recovery:1m rate=100r/s;
      limit_req_zone $binary_remote_addr zone=identity_enrollment:1m rate=100r/s;
      map $http_authorization $validation_path { "" /api/internal/authentication/validate-optional; default /api/internal/authentication/validate; }
      upstream local_auth { server host.docker.internal:${bffPort}; }
      server { listen 8080; include /etc/nginx/qualification/local-api.conf; }
      server { listen 8081; include /etc/nginx/qualification/alpha-api.conf; }
    }\n`
    );
    docker([
      'run',
      '--detach',
      '--pull=never',
      '--name',
      name,
      ...(process.platform === 'linux'
        ? ['--add-host', 'host.docker.internal:host-gateway']
        : []),
      '--publish',
      '127.0.0.1::8080',
      '--publish',
      '127.0.0.1::8081',
      '--mount',
      `type=bind,source=${directory},target=/etc/nginx/qualification,readonly`,
      'nginx:1.28-alpine',
      'nginx',
      '-c',
      '/etc/nginx/qualification/nginx.conf',
      '-g',
      'daemon off;',
    ]);
    ingressStarted = true;
    docker([
      'exec',
      name,
      'nginx',
      '-c',
      '/etc/nginx/qualification/nginx.conf',
      '-t',
    ]);
    const gateways = [8080, 8081].map(
      (port) => 'http://' + docker(['port', name, `${port}/tcp`]).trim()
    );
    for (const at of gateways) {
      for (let attempt = 0; ; attempt++) {
        try {
          const response = await fetch(at + '/api/health', {
            headers: { authorization: 'Bearer staff' },
            signal: AbortSignal.timeout(1000),
          });
          assert.equal(response.status, 200);
          await response.arrayBuffer();
          break;
        } catch (error) {
          if (attempt >= 30) throw error;
          await delay(100);
        }
      }
    }
    const create = async (slug) => {
      const response = await fetch(origin() + '/api/apps', {
        method: 'POST',
        headers: {
          ...trusted({ ...actors.staff, roles: ['editorial:publisher'] }),
          'content-type': 'application/json',
          'idempotency-key': randomUUID(),
        },
        body: JSON.stringify({
          name: slug,
          slug,
          website: 'https://health.example.test',
        }),
        signal: AbortSignal.timeout(10000),
      });
      assert.equal(response.status, 201);
      return response.json();
    };
    const app = await create('bff-health-application');
    const second = await create('bff-health-second');
    await projections.publish(
      projectEditorialSnapshot(await reader.read('app', app.id))
    );
    const route = '/api/editorial/health-monitors/' + app.id,
      id = randomUUID();
    const fields = {
      expectedRevision: 0,
      expectedApplicationRevision: 1,
      name: 'BFF website',
      url: 'https://health.example.test/health',
      enabled: true,
    };
    for (const at of gateways) {
      const before = bffRequests;
      await request(at, route, {
        actor: null,
        status: 401,
        headers: trusted(actors.staff),
      });
      for (const actor of ['member', 'tenant']) {
        await request(at, route, {
          actor,
          status: 403,
          headers: trusted(actors.staff),
        });
        await request(at, route + '/' + id, {
          method: 'PUT',
          body: fields,
          actor,
          status: 403,
          headers: trusted(actors.staff),
        });
      }
      assert.deepEqual((await request(at, route)).monitors, []);
      assert.ok(bffRequests >= before + 5, 'Both gateways must traverse BFF');
      await request(at, route + '?tenantId=other', { status: 400 });
      await request(at, route + '/' + id, {
        method: 'PUT',
        body: { ...fields, url: 'https://other.example.test' },
        status: 400,
      });
      await request(at, route + '/' + id, {
        method: 'PUT',
        body: { ...fields, expectedApplicationRevision: 2 },
        status: 409,
      });
      await request(at, route + '/' + id, {
        method: 'PUT',
        body: { ...fields, extra: 'x'.repeat(9000) },
        status: 413,
      });
      await request(at, route + '/' + id + '/unknown', { status: 404 });
    }
    await request(bff.origin, route, {
      actor: null,
      headers: { ...trusted(actors.staff), 'x-ingress-auth': 'forged' },
      status: 401,
    });
    const configured = await request(gateways[0], route + '/' + id, {
      method: 'PUT',
      body: fields,
    });
    const replay = () =>
      request(gateways[1], route + '/' + id, { method: 'PUT', body: fields });
    const concurrent = await Promise.all([replay(), replay()]);
    concurrent.forEach((value) => assert.deepEqual(value, configured));
    const updated = await request(gateways[1], route + '/' + id, {
      method: 'PUT',
      body: { ...fields, expectedRevision: 1, enabled: false },
    });
    assert.equal(updated.revision, 2);
    assert.deepEqual(await replay(), configured);
    assert.deepEqual((await request(gateways[0], route)).monitors, [updated]);
    await request(gateways[0], route + '/' + id, {
      method: 'PUT',
      body: { ...fields, name: 'Conflicting replay' },
      status: 409,
    });
    await request(
      gateways[0],
      '/api/editorial/health-monitors/' + second.id + '/' + id,
      { method: 'PUT', body: fields, status: 409 }
    );
    await source.query(
      'INSERT INTO identity_erasure_barriers (identityId,erasureRevision,requestedAt) VALUES (?,1,?)',
      [actors.erased.uid, Date.now()]
    );
    await request(gateways[0], route + '/' + id, {
      method: 'PUT',
      body: fields,
      actor: 'erased',
      status: 403,
    });
    pass(
      'Both real Nginx route sets traverse BFF: staff/tenant/forged denial, bounded input, canonical erasure fence, origin validation and immutable concurrent/historical replay'
    );

    const failedId = randomUUID();
    await source.query(
      "CREATE TRIGGER qualification_bff_health_write BEFORE INSERT ON health_monitors FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected health failure'"
    );
    try {
      await request(gateways[0], route + '/' + failedId, {
        method: 'PUT',
        body: fields,
        status: 503,
      });
      assert.equal(
        (
          await source.query(
            'SELECT * FROM health_monitor_versions WHERE monitorId=?',
            [failedId]
          )
        ).length,
        0
      );
    } finally {
      await source.query('DROP TRIGGER qualification_bff_health_write');
    }
    const retried = await request(gateways[1], route + '/' + failedId, {
      method: 'PUT',
      body: fields,
    });
    assert.equal(retried.revision, 1);
    const lostId = randomUUID(),
      writesBefore = ownerWrites;
    loseNextReply = true;
    await request(gateways[0], route + '/' + lostId, {
      method: 'PUT',
      body: fields,
      status: 503,
    });
    assert.equal(
      ownerWrites,
      writesBefore + 1,
      'A lost reply must not cause automatic mutation retry'
    );
    assert.equal(
      (
        await source.query(
          'SELECT * FROM health_monitor_versions WHERE monitorId=?',
          [lostId]
        )
      ).length,
      1
    );
    const recovered = await request(gateways[1], route + '/' + lostId, {
      method: 'PUT',
      body: fields,
    });
    assert.equal(recovered.revision, 1);
    assert.equal(
      (
        await source.query(
          'SELECT * FROM health_monitor_versions WHERE monitorId=?',
          [lostId]
        )
      ).length,
      1
    );
    pass(
      'BFF SQL failure rolls back monitor/version atomically; explicit retry recovers; a committed lost reply returns 503 and same-revision replay confirms one write'
    );

    const saved = await request(gateways[0], route);
    const publicResponse = await fetch(
      bff.origin + '/api/catalog/application-health/bff-health-application',
      { signal: AbortSignal.timeout(10000) }
    );
    assert.equal(publicResponse.status, 200);
    assert.equal(publicResponse.headers.get('cache-control'), 'no-store');
    const publicReport = await publicResponse.json();
    assert.equal(publicReport.monitors.length, 2);
    for (const monitor of publicReport.monitors) {
      assert.equal(monitor.status, 'unknown');
      assert.equal(monitor.latest, null);
      assert.equal(monitor.measured, 0);
      assert.equal(monitor.availabilityPercent, null);
    }
    await restart();
    await restartBff();
    for (const at of gateways)
      assert.deepEqual(await request(at, route), saved);
    await source.query('UPDATE app_records SET isSuspended=1 WHERE id=?', [
      app.id,
    ]);
    for (const at of gateways) {
      await request(at, route, { status: 404 });
      await request(at, route + '/' + id, {
        method: 'PUT',
        body: fields,
        status: 404,
      });
    }
    await source.query('UPDATE app_records SET isSuspended=0 WHERE id=?', [
      app.id,
    ]);
    await stop();
    for (const at of gateways) {
      await request(at, route, { status: 503 });
      await request(at, route + '/' + id, {
        method: 'PUT',
        body: fields,
        status: 503,
      });
    }
    await restart();
    await bff.stop();
    for (const at of gateways) {
      await request(at, route, { status: 502 });
      await request(at, route + '/' + id, {
        method: 'PUT',
        body: fields,
        status: 502,
      });
      await request(
        at,
        route.replace(
          '/editorial/health-monitors/',
          '/EDITORIAL/HEALTH-MONITORS/'
        ),
        { status: 502 }
      );
      await request(at, route + '/' + id + '/unknown', { status: 502 });
    }
    await restartBff();
    for (const at of gateways)
      assert.deepEqual(await request(at, route), saved);
    pass(
      'BFF-configured monitors stay unknown until measured; disabled checks stay absent; configurations survive owner/BFF restarts; withdrawal/outages fail closed without direct-owner fallback'
    );
    await stopPolicy();
    for (const at of gateways) {
      await request(at, route, { status: 503 });
      await request(at, route + '/' + randomUUID(), {
        method: 'PUT',
        body: fields,
        status: 503,
      });
    }
    assert.equal(
      (
        await source.query(
          'SELECT * FROM health_monitors WHERE applicationId=?',
          [app.id]
        )
      ).length,
      saved.monitors.length
    );
    pass(
      'Real OPA outage denies staff reads and writes without changing durable configurations'
    );
  } finally {
    if (ingressStarted) docker(['rm', '-f', '-v', name]);
    await bff?.stop();
    for (const server of servers) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
};
