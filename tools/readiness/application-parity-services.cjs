const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { MongoClient } = require('mongodb');
const { DataSource } = require('typeorm');
const {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
} = require('@aws-sdk/client-s3');
const { randomUUID } = require('node:crypto');
const { ownershipDnsFixture } = require('./ownership-dns-fixture.cjs');

// All stores and listeners belong to the invoking local-auth qualification run.
async function applicationParityServices({
  root,
  env,
  password,
  container,
  names,
  start,
  freePort,
  execute,
  processes,
}) {
  const mongoPort = await container(
    'application-mongo',
    'mongo:7',
    27017,
    [
      '--env',
      'MONGO_INITDB_ROOT_USERNAME=wapps',
      '--env',
      `MONGO_INITDB_ROOT_PASSWORD=${password}`,
    ],
    ['mongod', '--wiredTigerCacheSizeGB', '0.25']
  );
  const mongoName = names.at(-1);
  const policyPort = await container(
    'application-opa',
    'openpolicyagent/opa:1.4.2-static',
    8181,
    [
      '--mount',
      `type=bind,source=${path.join(
        root,
        'sdk/features/identity/packages/infrastructure/opa/bundles/editorial'
      )},target=/policies,readonly`,
    ],
    ['run', '--server', '--addr=0.0.0.0:8181', '/policies']
  );
  const policyName = names.at(-1);
  const storagePort = await container(
    'application-minio',
    'minio/minio:RELEASE.2025-04-22T22-12-26Z',
    9000,
    [
      '--env',
      'MINIO_ROOT_USER=qualification',
      '--env',
      `MINIO_ROOT_PASSWORD=${password}`,
    ],
    ['server', '/data']
  );
  const storageName = names.at(-1);
  const bucket = 'applications-' + randomUUID();
  const dns = await ownershipDnsFixture();
  const storage = new S3Client({
    endpoint: `http://127.0.0.1:${storagePort}`,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: 'qualification', secretAccessKey: password },
  });
  const port = await freePort();
  const endpoints = { EDITORIAL_URL: `http://127.0.0.1:${port}` };
  const environment = {
    ...env,
    ...endpoints,
    MYSQL_DATABASE: 'editorial',
    MONGO_HOST: '127.0.0.1',
    MONGO_PORT: String(mongoPort),
    MONGO_USERNAME: 'wapps',
    MONGO_PASSWORD: password,
    MONGO_DATABASE: 'editorial',
    EDITORIAL_DATABASE_HOST: env.MYSQL_HOST,
    EDITORIAL_DATABASE_PORT: env.MYSQL_PORT,
    EDITORIAL_DATABASE_USERNAME: env.MYSQL_USERNAME,
    EDITORIAL_DATABASE_PASSWORD: password,
    EDITORIAL_DATABASE_NAME: 'editorial',
    EDITORIAL_PUBLIC_TENANT: 'default',
    EDITORIAL_HOST: '127.0.0.1',
    EDITORIAL_PORT: String(port),
    EDITORIAL_SEED_DEMO_DATA: 'false',
    EDITORIAL_OWNERSHIP_DNS_SERVERS: dns.address,
    EDITORIAL_MEDIA_ENDPOINT: `http://127.0.0.1:${storagePort}`,
    EDITORIAL_MEDIA_BUCKET: bucket,
    EDITORIAL_MEDIA_ACCESS_KEY: 'qualification',
    EDITORIAL_MEDIA_SECRET_KEY: password,
    EDITORIAL_MEDIA_PUBLIC_ORIGIN: 'http://localhost',
    EDITORIAL_ERASURE_WORKERS_FENCED: 'false',
    EDITORIAL_MEDIA_CLEANUP_ENABLED: 'false',
    EDITORIAL_HEALTH_MONITOR_ENABLED: 'false',
    OPA_URL: `http://127.0.0.1:${policyPort}`,
  };
  const bundle = path.join(root, 'dist/apps/services/editorial/main.js');
  const mongo = new MongoClient(
    `mongodb://wapps:${password}@127.0.0.1:${mongoPort}/?authSource=admin`,
    {
      serverSelectionTimeoutMS: 1000,
    }
  );
  let sql, editorial, worker;
  let diagnostic = '';
  const paused = new Set();
  async function stopWorker() {
    if (!worker || worker.exitCode !== null || worker.signalCode !== null)
      return;
    const exited = once(worker, 'exit');
    worker.kill('SIGTERM');
    const deadline = setTimeout(() => worker.kill('SIGKILL'), 5000);
    try {
      await exited;
    } finally {
      clearTimeout(deadline);
    }
  }
  const restartEditorial = async (overrides = {}) => {
    await editorial?.stop();
    editorial = await start(
      'apps/services/editorial',
      { ...environment, ...overrides },
      port,
      '/api/health'
    );
  };
  async function pause(name) {
    await execute('docker', ['pause', name], { timeout: 5000 });
    paused.add(name);
  }
  async function resume(name) {
    if (!paused.has(name)) return;
    await execute('docker', ['unpause', name], { timeout: 5000 });
    paused.delete(name);
  }
  async function close() {
    for (const name of paused) await resume(name);
    await stopWorker();
    await editorial?.stop();
    await sql?.destroy();
    await mongo.close();
    storage.destroy();
    await dns.close();
  }
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await storage.send(new CreateBucketCommand({ Bucket: bucket }));
        await storage.send(new HeadBucketCommand({ Bucket: bucket }));
        break;
      } catch (error) {
        if (attempt >= 30) throw error;
        await delay(200);
      }
    }
    for (let attempt = 0; ; attempt++) {
      try {
        await mongo.connect();
        break;
      } catch (error) {
        if (attempt >= 30) throw error;
        await delay(200);
      }
    }
    await execute(process.execPath, [bundle, '--migrate'], {
      cwd: root,
      env: environment,
      timeout: 30000,
    });
    sql = await new DataSource({
      type: 'mysql',
      host: env.MYSQL_HOST,
      port: Number(env.MYSQL_PORT),
      username: env.MYSQL_USERNAME,
      password,
      database: 'editorial',
      synchronize: false,
    }).initialize();
    await restartEditorial();
    const projections = mongo
      .db('editorial')
      .collection('editorial_projections_v1');
    return {
      endpoints,
      environment,
      dns,
      storage,
      bucket,
      sql,
      projections,
      close,
      restartEditorial,
      crashEditorial: () => editorial.crash(),
      stopEditorial: () => editorial.stop(),
      pauseStorage: () => pause(storageName),
      resumeStorage: () => resume(storageName),
      pausePolicy: () => pause(policyName),
      resumePolicy: () => resume(policyName),
      pauseMongo: () => pause(mongoName),
      resumeMongo: () => resume(mongoName),
      stopWorker,
      startWorker: async () => {
        await stopWorker();
        diagnostic = '';
        worker = spawn(process.execPath, [bundle, '--materialize'], {
          cwd: root,
          env: environment,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        for (const stream of [worker.stdout, worker.stderr])
          stream.on('data', (chunk) => {
            diagnostic = (diagnostic + chunk).slice(-8000);
          });
        processes.push({ stop: stopWorker });
      },
      assertWorker: () => {
        assert.ok(worker, 'Editorial worker has not started');
        assert.equal(worker.exitCode, null, diagnostic);
        assert.equal(worker.signalCode, null, diagnostic);
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}

module.exports = { applicationParityServices };
