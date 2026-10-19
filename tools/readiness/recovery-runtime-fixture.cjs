const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createServer } = require('node:net');
const { mkdtempSync, mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { createConnection } = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const amqp = require('amqplib');
const { S3Client } = require('@aws-sdk/client-s3');
const execute = promisify(execFile);
const root = path.resolve(__dirname, '../..');
const queue = 'discussion-projection-v2',
  failedQueue = queue + '.failed';

async function until(action, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let last;
  do {
    try {
      return await action();
    } catch (error) {
      last = error;
    }
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error(`${label}: ${last?.message}`);
}
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function recoveryFixture() {
  const id = randomUUID().replaceAll('-', ''),
    password = randomUUID(),
    secret = randomUUID();
  const directory =
    process.env.WAPPS_RECOVERY_EVIDENCE ??
    mkdtempSync(path.join(tmpdir(), 'wapps-recovery-runtime-'));
  mkdirSync(directory, { recursive: true });
  const containers = [],
    processes = [],
    observations = [];
  let sql, mongo, broker, channel, s3;
  const redact = (value) =>
    String(value)
      .replaceAll(password, '[redacted]')
      .replaceAll(secret, '[redacted]');
  const save = (name, value) =>
    writeFileSync(
      path.join(directory, name),
      redact(JSON.stringify(value, null, 2)) + '\n',
      { mode: 0o600 }
    );
  const observe = (name, value = {}) => {
    if (value.recoveryMs !== undefined)
      assert.ok(value.recoveryMs < value.targetMs, name + ' recovery deadline');
    observations.push({ name, at: new Date().toISOString(), ...value });
    save('observations.json', observations);
    console.log('PASS ' + name);
  };
  const docker = (args) =>
    execute('docker', args, { timeout: 30000, maxBuffer: 65536 });
  async function container(kind, image, ports, args = [], command = []) {
    const name = `wappsa-recovery-${kind}-${id}`;
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
    const imageId = (
      await docker(['inspect', '--format', '{{.Image}}', name])
    ).stdout.trim();
    save('resources.json', containers);
    observe('isolated ' + kind + ' allocated', {
      name,
      image,
      imageId,
      ports: published,
    });
    return published;
  }
  function launch(label, bundle, args = [], env = {}, instrument = false) {
    const child = spawn(
      process.execPath,
      [
        ...(instrument
          ? [
              '--require',
              path.join(
                __dirname,
                typeof instrument === 'string'
                  ? instrument
                  : 'discussion-crash-preload.cjs'
              ),
            ]
          : []),
        path.join(root, 'dist', bundle, 'main.js'),
        ...args,
      ],
      {
        cwd: root,
        env: { ...process.env, ...environment, ...env, NODE_OPTIONS: '' },
        stdio: ['ignore', 'pipe', 'pipe', ...(instrument ? ['ipc'] : [])],
      }
    );
    let logs = '',
      spawnError;
    const messages = [];
    child.on('error', (error) => {
      spawnError = error;
    });
    child.on('message', (message) => {
      messages.push(message);
      save(label + '.ipc.json', messages);
    });
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (data) => {
        logs += redact(data);
        writeFileSync(path.join(directory, label + '.log'), logs, {
          mode: 0o600,
        });
      });
    const done = new Promise((resolve) =>
      child.once('close', (code, signal) => resolve({ code, signal }))
    );
    const service = {
      child,
      messages,
      logs: () => logs,
      arm: async (arm) => {
        child.send({ arm });
        await until(() => {
          assert.ok(messages.some((m) => m.armed === arm));
        }, 'arm ' + arm);
      },
      barrier: (name) =>
        until(() => {
          assert.equal(spawnError, undefined);
          assert.equal(child.exitCode, null, logs.slice(-3000));
          assert.ok(messages.some((m) => m.barrier === name));
        }, 'barrier ' + name),
      finish: async (expected = 0) => {
        let timer;
        let result;
        try {
          result = await Promise.race([
            done,
            new Promise((_, reject) => {
              timer = setTimeout(
                () => reject(new Error('CLI timeout: ' + label)),
                30000
              );
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
        save(label + '.result.json', result);
        assert.equal(result.code, expected, logs.slice(-5000));
        return logs;
      },
      stop: async (signal = 'SIGTERM') => {
        if (child.exitCode !== null || child.signalCode !== null || spawnError)
          return;
        child.kill(signal);
        const deadline = setTimeout(() => child.kill('SIGKILL'), 5000);
        try {
          const result = await done;
          save(label + '.exit.json', result);
          if (signal === 'SIGKILL') assert.equal(result.signal, 'SIGKILL');
        } finally {
          clearTimeout(deadline);
        }
      },
    };
    processes.push(service);
    return service;
  }
  let environment = {};
  async function cleanup() {
    const errors = [];
    for (const service of processes.toReversed()) {
      try {
        await service.stop();
      } catch (error) {
        errors.push(redact(error.message));
      }
    }
    for (const close of [
      () => broker?.close(),
      () => mongo?.close(),
      () => sql?.end(),
      () => s3?.destroy(),
    ]) {
      try {
        await close();
      } catch (error) {
        errors.push(redact(error.message));
      }
    }
    for (const name of containers.toReversed()) {
      try {
        await docker(['rm', '-f', '--volumes', name]);
      } catch (error) {
        errors.push(redact(error.message));
      }
    }
    const remaining = (
      await docker([
        'ps',
        '-a',
        '--filter',
        'name=wappsa-recovery-',
        '--format',
        '{{.Names}}',
      ])
    ).stdout
      .trim()
      .split('\n')
      .filter((name) => containers.includes(name));
    save('cleanup.json', {
      resources: containers,
      remaining,
      processes: processes.map((p) => ({
        pid: p.child.pid,
        code: p.child.exitCode,
        signal: p.child.signalCode,
      })),
      errors,
    });
    assert.deepEqual(remaining, []);
    assert.deepEqual(errors, []);
  }
  try {
    const [mysqlPort] = await container(
      'mysql',
      'mysql:8.4',
      [3306],
      [
        '--memory=768m',
        '--cpus=1',
        '-e',
        `MYSQL_ROOT_PASSWORD=${password}`,
        '-e',
        'MYSQL_DATABASE=discussion',
      ]
    );
    const [mongoPort] = await container(
      'mongo',
      'mongo:7',
      [27017],
      [
        '--memory=768m',
        '--cpus=1',
        '-e',
        'MONGO_INITDB_ROOT_USERNAME=wapps',
        '-e',
        `MONGO_INITDB_ROOT_PASSWORD=${password}`,
      ],
      ['mongod', '--wiredTigerCacheSizeGB', '0.25']
    );
    const [brokerPort, managementPort] = await container(
      'rabbit',
      'rabbitmq:4-management',
      [5672, 15672],
      [
        '--memory=512m',
        '--cpus=1',
        '-e',
        'RABBITMQ_DEFAULT_USER=wapps',
        '-e',
        `RABBITMQ_DEFAULT_PASS=${password}`,
      ]
    );
    const [minioPort] = await container(
      'minio',
      'minio/minio:RELEASE.2025-04-22T22-12-26Z',
      [9000],
      [
        '--memory=512m',
        '--cpus=1',
        '-e',
        'MINIO_ROOT_USER=wapps',
        '-e',
        `MINIO_ROOT_PASSWORD=${password}`,
      ],
      ['server', '/data']
    );
    const [opaPort] = await container(
      'opa',
      'openpolicyagent/opa:1.4.2-static',
      [8181],
      [
        '--mount',
        `type=bind,source=${path.join(
          root,
          'sdk/features/identity/packages/infrastructure/opa/bundles/discussion'
        )},target=/policies,readonly`,
      ],
      ['run', '--server', '--addr=0.0.0.0:8181', '/policies']
    );
    const sqlOptions = {
      host: '127.0.0.1',
      port: mysqlPort,
      user: 'root',
      password,
      database: 'discussion',
      connectTimeout: 1000,
    };
    sql = await until(() => createConnection(sqlOptions), 'SQL startup', 40000);
    mongo = new MongoClient(
      `mongodb://wapps:${password}@127.0.0.1:${mongoPort}/?authSource=admin`,
      { serverSelectionTimeoutMS: 1000 }
    );
    await until(async () => {
      await mongo.connect();
      await mongo.db('admin').command({ ping: 1 });
    }, 'Mongo startup');
    broker = await until(
      () =>
        amqp.connect(`amqp://wapps:${password}@127.0.0.1:${brokerPort}`, {
          timeout: 1000,
        }),
      'broker startup',
      40000
    );
    broker.on('error', () => undefined);
    channel = await broker.createConfirmChannel();
    await until(async () => {
      const response = await fetch(
        `http://127.0.0.1:${minioPort}/minio/health/ready`
      );
      assert.equal(response.status, 200);
      await response.arrayBuffer();
    }, 'MinIO startup');
    await until(async () => {
      const response = await fetch(`http://127.0.0.1:${opaPort}/health`);
      assert.equal(response.status, 200);
      await response.arrayBuffer();
    }, 'OPA startup');
    s3 = new S3Client({
      endpoint: `http://127.0.0.1:${minioPort}`,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: 'wapps', secretAccessKey: password },
    });
    environment = {
      DISCUSSION_DATABASE_HOST: '127.0.0.1',
      DISCUSSION_DATABASE_PORT: String(mysqlPort),
      DISCUSSION_DATABASE_USERNAME: 'root',
      DISCUSSION_DATABASE_PASSWORD: password,
      DISCUSSION_DATABASE_NAME: 'discussion',
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: String(mysqlPort),
      MYSQL_USERNAME: 'root',
      MYSQL_PASSWORD: password,
      MYSQL_DATABASE: 'discussion',
      MONGO_HOST: '127.0.0.1',
      MONGO_PORT: String(mongoPort),
      MONGO_USERNAME: 'wapps',
      MONGO_PASSWORD: password,
      MONGO_DATABASE: 'discussion',
      QUEUE_HOST: '127.0.0.1',
      QUEUE_PORT: String(brokerPort),
      QUEUE_USERNAME: 'wapps',
      QUEUE_PASSWORD: password,
      DISCUSSION_STORAGE_HOST: `http://127.0.0.1:${minioPort}`,
      DISCUSSION_STORAGE_ACCESSKEY: 'wapps',
      DISCUSSION_STORAGE_SECRETKEY: password,
      DISCUSSION_HOST: '127.0.0.1',
      DISCUSSION_PORT: String(await freePort()),
      INGRESS_AUTH_SECRET: secret,
      OPA_URL: `http://127.0.0.1:${opaPort}`,
      EDITORIAL_DATABASE_HOST: '127.0.0.1',
      EDITORIAL_DATABASE_PORT: String(mysqlPort),
      EDITORIAL_DATABASE_USERNAME: 'root',
      EDITORIAL_DATABASE_PASSWORD: password,
    };
    return {
      id,
      directory,
      sql,
      mongo,
      channel,
      s3,
      password,
      secret,
      environment,
      sqlOptions,
      launch,
      save,
      observe,
      cleanup,
      queue,
      failedQueue,
      until,
      freePort,
      queueState: async (name = queue) => {
        const response = await fetch(
          `http://127.0.0.1:${managementPort}/api/queues/%2f/${encodeURIComponent(
            name
          )}`,
          {
            headers: {
              Authorization:
                'Basic ' + Buffer.from('wapps:' + password).toString('base64'),
            },
            signal: AbortSignal.timeout(3000),
          }
        );
        assert.equal(response.status, 200);
        return response.json();
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
module.exports = { recoveryFixture, until, queue, failedQueue };
