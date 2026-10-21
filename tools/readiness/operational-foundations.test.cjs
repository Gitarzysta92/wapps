/* Only this invocation's uniquely named containers, databases and processes are changed. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { once } = require('node:events');
const { createServer } = require('node:net');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');
const { createConnection } = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const amqp = require('amqplib');
const execute = promisify(execFile);
const root = path.resolve(__dirname, '../..');

test(
  'Editorial migrations and bounded catalog readiness with real dependency faults',
  { timeout: 240000 },
  async () => {
    assert.equal(
      process.env.WAPPS_OPERATIONAL_INTEGRATION,
      '1',
      'Explicit opt-in and built Editorial/BFF are required'
    );
    const id = randomUUID().replaceAll('-', ''),
      password = randomUUID();
    const directory = mkdtempSync(path.join(tmpdir(), 'wappsa-operations-'));
    const containers = [],
      processes = [],
      paused = new Set();
    const docker = (args) =>
      execute('docker', args, { timeout: 30000, maxBuffer: 65536 });
    let sql, mongo, broker, worker, editorial, bff;
    async function container(kind, image, ports, args = [], command = []) {
      const name = `wappsa-operations-${kind}-${id}`;
      await docker([
        'run',
        '-d',
        '--pull=never',
        '--name',
        name,
        ...ports.flatMap((port) => ['-p', `127.0.0.1::${port}`]),
        ...args,
        image,
        ...command,
      ]);
      containers.push(name);
      const published = [];
      for (const port of ports)
        published.push(
          Number(
            (
              await docker([
                'inspect',
                '--format',
                `{{(index (index .NetworkSettings.Ports "${port}/tcp") 0).HostPort}}`,
                name,
              ])
            ).stdout.trim()
          )
        );
      return { name, ports: published };
    }
    async function freePort() {
      const listener = createServer();
      await new Promise((resolve) => listener.listen(0, '0.0.0.0', resolve));
      const port = listener.address().port;
      await new Promise((resolve) => listener.close(resolve));
      return port;
    }
    async function until(action, label, timeout = 20000) {
      const deadline = Date.now() + timeout;
      let last;
      do {
        try {
          return await action();
        } catch (error) {
          last = error;
          await delay(250);
        }
      } while (Date.now() < deadline);
      throw new Error(`${label}: ${last?.message}`);
    }
    function launch(project, args, environment) {
      const child = spawn(
        process.execPath,
        [path.join(root, 'dist/apps/services', project, 'main.js'), ...args],
        { cwd: root, env: environment, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      let logs = '';
      for (const stream of [child.stdout, child.stderr])
        stream.on('data', (chunk) => {
          logs = (logs + chunk).slice(-80000);
        });
      const result = {
        child,
        logs: () => logs.replaceAll(password, '[redacted]'),
        stop: async () => {
          if (child.exitCode !== null || child.signalCode !== null) return;
          child.kill('SIGCONT');
          const exit = once(child, 'exit');
          child.kill('SIGTERM');
          const deadline = setTimeout(() => child.kill('SIGKILL'), 5000);
          try {
            await exit;
          } finally {
            clearTimeout(deadline);
          }
        },
      };
      processes.push(result);
      return result;
    }
    async function json(origin, route, options = {}) {
      const started = Date.now();
      const response = await fetch(origin + route, {
        ...options,
        signal: AbortSignal.timeout(2600),
      });
      const value = await response.json();
      assert.ok(Date.now() - started < 2500, 'HTTP readiness deadline');
      assert.ok(
        !JSON.stringify(value).includes(password),
        'No credential in report'
      );
      return { status: response.status, value };
    }
    async function pause(name) {
      await docker(['pause', name]);
      paused.add(name);
    }
    async function resume(name) {
      await docker(['unpause', name]);
      paused.delete(name);
    }
    try {
      const mysql = await container(
        'mysql',
        'mysql:8.4',
        [3306],
        [
          '-e',
          `MYSQL_ROOT_PASSWORD=${password}`,
          '-e',
          'MYSQL_DATABASE=editorial',
        ],
        ['--log-bin-trust-function-creators=ON']
      );
      const mongodb = await container(
        'mongo',
        'mongo:7',
        [27017],
        [
          '-e',
          'MONGO_INITDB_ROOT_USERNAME=wapps',
          '-e',
          `MONGO_INITDB_ROOT_PASSWORD=${password}`,
        ],
        ['mongod', '--wiredTigerCacheSizeGB', '0.25']
      );
      writeFileSync(
        path.join(directory, 'rabbitmq.conf'),
        'collect_statistics_interval = 1000\n'
      );
      const rabbit = await container(
        'rabbit',
        'rabbitmq:4-management',
        [5672, 15672],
        [
          '-e',
          'RABBITMQ_DEFAULT_USER=wapps',
          '-e',
          `RABBITMQ_DEFAULT_PASS=${password}`,
          '--mount',
          `type=bind,source=${path.join(
            directory,
            'rabbitmq.conf'
          )},target=/etc/rabbitmq/rabbitmq.conf,readonly`,
        ]
      );
      const opa = await container(
        'opa',
        'openpolicyagent/opa:1.4.2-static',
        [8181],
        [
          '--mount',
          `type=bind,source=${path.join(
            root,
            'sdk/features/identity/packages/infrastructure/opa/bundles/editorial'
          )},target=/policies,readonly`,
        ],
        ['run', '--server', '--addr=0.0.0.0:8181', '/policies']
      );
      const sqlOptions = {
        host: '127.0.0.1',
        port: mysql.ports[0],
        user: 'root',
        password,
        database: 'editorial',
        connectTimeout: 500,
      };
      sql = await until(
        () => createConnection(sqlOptions),
        'SQL startup',
        40000
      );
      mongo = new MongoClient(
        `mongodb://wapps:${password}@127.0.0.1:${mongodb.ports[0]}/?authSource=admin`,
        { serverSelectionTimeoutMS: 500 }
      );
      await until(() => mongo.connect(), 'Mongo startup');
      broker = await until(
        () =>
          amqp.connect({
            hostname: '127.0.0.1',
            port: rabbit.ports[0],
            username: 'wapps',
            password,
          }),
        'Rabbit startup',
        40000
      );
      broker.on('error', () => undefined);
      const channel = await broker.createConfirmChannel();
      const env = {
        ...process.env,
        NX_DAEMON: 'false',
        NX_ISOLATE_PLUGINS: 'false',
        EDITORIAL_TEST_MYSQL_PORT: String(mysql.ports[0]),
        EDITORIAL_TEST_MYSQL_USERNAME: 'root',
        EDITORIAL_TEST_MYSQL_PASSWORD: password,
        EDITORIAL_TEST_MONGO_PORT: String(mongodb.ports[0]),
        EDITORIAL_TEST_MONGO_USERNAME: 'wapps',
        EDITORIAL_TEST_MONGO_PASSWORD: password,
        EDITORIAL_TEST_QUEUE_PORT: String(rabbit.ports[0]),
        EDITORIAL_TEST_QUEUE_USERNAME: 'wapps',
        EDITORIAL_TEST_QUEUE_PASSWORD: password,
        WAPPS_EDITORIAL_INTEGRATION: '1',
        WAPPS_EDITORIAL_PROJECTION_INTEGRATION: '1',
        EDITORIAL_DATABASE_HOST: '127.0.0.1',
        EDITORIAL_DATABASE_PORT: String(mysql.ports[0]),
        EDITORIAL_DATABASE_USERNAME: 'root',
        EDITORIAL_DATABASE_PASSWORD: password,
        EDITORIAL_DATABASE_NAME: 'editorial',
        MONGO_HOST: '127.0.0.1',
        MONGO_PORT: String(mongodb.ports[0]),
        MONGO_USERNAME: 'wapps',
        MONGO_PASSWORD: password,
        MONGO_DATABASE: 'editorial',
        QUEUE_HOST: '127.0.0.1',
        QUEUE_PORT: String(rabbit.ports[0]),
        QUEUE_USERNAME: 'wapps',
        QUEUE_PASSWORD: password,
        OPA_URL: `http://127.0.0.1:${opa.ports[0]}`,
        EDITORIAL_READINESS_QUEUE_URL: `http://127.0.0.1:${rabbit.ports[1]}`,
        EDITORIAL_READINESS_MAX_BACKLOG_MS: '2000',
        EDITORIAL_PORT: String(await freePort()),
        PORT: String(await freePort()),
        EDITORIAL_HOST: '0.0.0.0',
        INGRESS_AUTH_SECRET: `ingress-${id}`,
        EXPLORE_SERVICE_SECRET: `explore-${id}`,
        ACCOUNT_EXPORT_SOURCE_SECRET: `export-${id}`,
        ACCOUNT_ERASURE_SECRET: `erasure-${id}`,
        NOTIFICATION_SERVICE_SECRET: `notifications-${id}`,
        EDITORIAL_MEDIA_CLEANUP_ENABLED: 'false',
        EDITORIAL_HEALTH_MONITOR_ENABLED: 'false',
        EDITORIAL_SEED_DEMO_DATA: 'false',
        EDITORIAL_ERASURE_WORKERS_FENCED: 'false',
        DISCUSSION_URL: 'http://127.0.0.1:1',
        ACCOUNT_MANAGEMENT_URL: 'http://127.0.0.1:1',
      };
      // Nested qualifiers must run their own test harness and emit checked TAP results.
      delete env.NODE_TEST_CONTEXT;
      env.EDITORIAL_URL = `http://127.0.0.1:${env.EDITORIAL_PORT}`;
      const owner = env.EDITORIAL_URL,
        portal = `http://127.0.0.1:${env.PORT}`;
      for (const file of [
        'editorial-recovery.test.cjs',
        'editorial-projection-recovery.test.cjs',
      ]) {
        const result = await execute(
          process.execPath,
          ['--test', path.join(root, 'tools/readiness', file)],
          { cwd: root, env, timeout: 120000, maxBuffer: 1000000 }
        );
        assert.match(result.stdout, /# tests 1\b/);
        assert.match(result.stdout, /# pass 1\b/);
        assert.match(result.stdout, /# skipped 0\b/);
        console.log(result.stdout.replaceAll(password, '[redacted]'));
      }
      const bundle = path.join(root, 'dist/apps/services/editorial/main.js');
      await execute(process.execPath, [bundle, '--migrate'], {
        cwd: root,
        env,
        timeout: 30000,
      });
      const startOwner = async () => {
        editorial = launch('editorial', [], env);
        await until(
          async () =>
            assert.equal((await json(owner, '/api/health')).status, 200),
          'Owner startup'
        );
      };
      await startOwner();
      bff = launch('catalog-bff', [], env);
      await until(
        async () =>
          assert.equal((await json(portal, '/api/health')).status, 200),
        'BFF startup'
      );
      worker = launch('editorial', ['--materialize'], env);
      const ready = async () =>
        until(async () => {
          for (const origin of [owner, portal]) {
            const report = await json(origin, '/api/health/ready');
            assert.equal(report.status, 200, JSON.stringify(report));
          }
        }, 'Readiness recovery');
      const failure = async (dependency, code) =>
        until(async () => {
          for (const origin of [owner, portal]) {
            const report = await json(origin, '/api/health/ready');
            assert.equal(report.status, 503, JSON.stringify(report));
            assert.equal(
              report.value.checks[dependency]?.code,
              code,
              JSON.stringify(report)
            );
            assert.equal((await json(origin, '/api/health')).status, 200);
          }
        }, code);
      await ready();
      const headers = {
        'Content-Type': 'application/json',
        'X-Ingress-Auth': env.INGRESS_AUTH_SECRET,
        'X-User-Id': 'qualification-owner',
        'X-User-Claims': JSON.stringify({
          roles: ['editorial:taxonomy'],
          tenantId: 'default',
        }),
      };
      const createCategory = async (key) => {
        const result = await json(owner, '/api/categories', {
          method: 'POST',
          headers: { ...headers, 'Idempotency-Key': key },
          body: JSON.stringify({ name: key, slug: key }),
        });
        assert.equal(result.status, 201, JSON.stringify(result));
        return result.value;
      };
      const initial = await createCategory('operational-baseline');
      await until(
        async () =>
          assert.ok(
            (
              await json(portal, '/api/catalog/facets')
            ).value.categories.some((category) => category.id === initial.id)
          ),
        'Real catalog projection'
      );
      console.log(
        'PASS independent built Editorial/BFF, real SQL/Mongo/OPA/broker/materializer and catalog read; liveness and scoped readiness separate'
      );

      await editorial.stop();
      const unavailable = await json(portal, '/api/health/ready');
      assert.equal(unavailable.status, 503);
      assert.equal(unavailable.value.checks.owner.code, 'owner_unavailable');
      assert.equal((await json(portal, '/api/health')).status, 200);
      await startOwner();
      await ready();
      console.log('PASS owner process outage and restart recovery');
      for (const [provider, dependency, code] of [
        [mysql, 'sql', 'sql_unavailable'],
        [mongodb, 'projection', 'projection_unavailable'],
        [opa, 'policy', 'policy_unavailable'],
        [rabbit, 'materializer', 'queue_unavailable'],
      ]) {
        await pause(provider.name);
        try {
          await failure(dependency, code);
          const concurrent = await Promise.all(
            Array.from({ length: 6 }, () => json(portal, '/api/health/ready'))
          );
          for (const report of concurrent) {
            assert.equal(report.status, 503);
            assert.equal(report.value.checks[dependency]?.code, code);
          }
        } finally {
          await resume(provider.name);
        }
        await ready();
        console.log(
          `PASS ${dependency} timeout, bounded concurrent read-only reports, independent liveness and recovery`
        );
      }
      await sql.query(
        'ALTER TABLE app_records MODIFY classification varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
      );
      try {
        await failure('schema', 'schema_incompatible');
      } finally {
        await sql.query(
          'ALTER TABLE app_records MODIFY classification varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
        );
      }
      await ready();
      console.log(
        'PASS incompatible physical schema rejection and recovery without running migrations from a health endpoint'
      );
      await sql.query(
        'ALTER TABLE editorial_resource_states MODIFY revision varchar(20) NOT NULL'
      );
      try {
        await failure('schema', 'schema_incompatible');
      } finally {
        await sql.query(
          'ALTER TABLE editorial_resource_states MODIFY revision bigint unsigned NOT NULL'
        );
      }
      await ready();
      console.log(
        'PASS incompatible authoritative revision type fails closed despite retained migration receipts'
      );

      await worker.stop();
      await failure('materializer', 'worker_missing');
      worker = launch('editorial', ['--materialize'], env);
      await ready();
      worker.child.kill('SIGSTOP');
      await createCategory('operational-stalled');
      try {
        await failure('materializer', 'worker_stalled');
      } finally {
        worker.child.kill('SIGCONT');
      }
      await ready();
      console.log(
        'PASS missing worker and live-but-stuck delivery are distinguishable; acknowledgement restores readiness'
      );

      channel.sendToQueue('editorial-projection-v1', Buffer.from('{malformed'));
      await channel.waitForConfirms();
      await failure('materializer', 'poison_messages');
      // Deliberate operator recovery of this test-owned poison message only.
      const poison = await channel.get('editorial-projection-v1.failed', {
        noAck: false,
      });
      assert.ok(poison);
      assert.equal(poison.content.toString(), '{malformed');
      channel.ack(poison);
      await ready();
      console.log(
        'PASS retained poison alert and explicit test-owned operator recovery'
      );

      await sql.query(
        `CREATE TRIGGER readiness_delay_outbox BEFORE INSERT ON editorial_outbox FOR EACH ROW SET NEW.availableAt = 9999999999999, NEW.createdAt = 1, NEW.leasedUntil = 1`
      );
      const delayed = await createCategory('operational-dispatch');
      await sql.query('DROP TRIGGER readiness_delay_outbox');
      await failure('outbox', 'dispatch_backlog');
      const stalled = await json(owner, '/api/health/ready');
      assert.ok(stalled.value.checks.outbox.expiredLeases > 0);
      await sql.query(
        'UPDATE editorial_outbox SET availableAt=?, leasedUntil=NULL WHERE resourceId=?',
        [Date.now(), delayed.id]
      );
      await ready();
      assert.match(editorial.logs(), /editorial_catalog_readiness/);
      assert.match(editorial.logs(), /dispatch_backlog/);
      assert.match(editorial.logs(), /poison_messages/);
      console.log(
        'PASS durable SQL backlog/expired-lease alert, recovery and safe transition logs'
      );
      await channel.close();
    } catch (error) {
      for (const service of [editorial, bff, worker])
        if (service) console.error(service.logs().slice(-12000));
      throw error;
    } finally {
      for (const name of paused) await resume(name);
      for (const service of processes.reverse()) await service.stop();
      await broker?.close();
      await mongo?.close();
      await sql?.end();
      for (const name of containers.reverse())
        await docker(['rm', '-f', '--volumes', name]);
      rmSync(directory, { recursive: true, force: true });
    }
  }
);
