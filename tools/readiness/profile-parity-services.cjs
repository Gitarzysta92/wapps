const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { MongoClient } = require('mongodb');
const { DataSource } = require('typeorm');
const {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
} = require('@aws-sdk/client-s3');
const { claimFreshObjectStore } = require('./fresh-object-store.cjs');
const {
  MysqlEditorialSnapshotReader,
} = require('../../apps/services/editorial/src/app/infrastructure/mysql-editorial-snapshot');
const {
  MongoEditorialProjections,
} = require('../../apps/services/editorial/src/app/infrastructure/mongo-editorial-projections');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');

// Only accepts the local-auth qualifier's fresh containers and disposable SQL schemas.
async function profileParityServices({
  root,
  env,
  password,
  container,
  start,
  freePort,
  execute,
  processes,
}) {
  const mongoPort = await container(
    'profile-mongo',
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
  const storagePort = await container(
    'profile-minio',
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
  const policies = {};
  for (const name of ['editorial', 'discussion'])
    policies[name] = await container(
      `profile-${name}-opa`,
      'openpolicyagent/opa:1.4.2-static',
      8181,
      [
        '--mount',
        `type=bind,source=${path.join(
          root,
          'sdk/features/identity/packages/infrastructure/opa/bundles',
          name
        )},target=/policies,readonly`,
      ],
      ['run', '--server', '--addr=0.0.0.0:8181', '/policies']
    );
  const editorialPort = await freePort(),
    discussionPort = await freePort();
  const endpoints = {
    EDITORIAL_URL: `http://127.0.0.1:${editorialPort}`,
    DISCUSSION_URL: `http://127.0.0.1:${discussionPort}`,
  };
  const common = {
    ...env,
    ...endpoints,
    MONGO_HOST: '127.0.0.1',
    MONGO_PORT: String(mongoPort),
    MONGO_USERNAME: 'wapps',
    MONGO_PASSWORD: password,
    EDITORIAL_SEED_DEMO_DATA: 'false',
    DISCUSSION_SEED_DEMO_DATA: 'false',
    EDITORIAL_PUBLIC_TENANT: 'default',
    DISCUSSION_PUBLIC_TENANT: 'default',
    EDITORIAL_ERASURE_WORKERS_FENCED: 'false',
    DISCUSSION_ERASURE_WORKERS_FENCED: 'false',
    EDITORIAL_MEDIA_CLEANUP_ENABLED: 'false',
    EDITORIAL_HEALTH_MONITOR_ENABLED: 'false',
    DISCUSSION_STORAGE_HOST: `http://127.0.0.1:${storagePort}`,
    DISCUSSION_STORAGE_ACCESSKEY: 'qualification',
    DISCUSSION_STORAGE_SECRETKEY: password,
  };
  const config = (name, port) => ({
    ...common,
    MYSQL_DATABASE: name,
    MONGO_DATABASE: name,
    [`${name.toUpperCase()}_HOST`]: '127.0.0.1',
    [`${name.toUpperCase()}_PORT`]: String(port),
    [`${name.toUpperCase()}_DATABASE_HOST`]: env.MYSQL_HOST,
    [`${name.toUpperCase()}_DATABASE_PORT`]: env.MYSQL_PORT,
    [`${name.toUpperCase()}_DATABASE_USERNAME`]: env.MYSQL_USERNAME,
    [`${name.toUpperCase()}_DATABASE_PASSWORD`]: password,
    [`${name.toUpperCase()}_DATABASE_NAME`]: name,
    OPA_URL: `http://127.0.0.1:${policies[name]}`,
  });
  const editorialEnv = config('editorial', editorialPort),
    discussionEnv = config('discussion', discussionPort);
  const editorialBundle = 'apps/services/editorial',
    discussionBundle = 'sdk/features/discussion/applications/management';
  const mongo = new MongoClient(
    `mongodb://wapps:${password}@127.0.0.1:${mongoPort}/?authSource=admin`,
    { serverSelectionTimeoutMS: 1000 }
  );
  let sql, editorial, discussion, releaseStore, storage;
  const worker = { child: null, diagnostic: '' };
  async function stopWorker() {
    const child = worker.child;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const deadline = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {
      await exited;
    } finally {
      clearTimeout(deadline);
    }
  }
  const restartEditorial = async () => {
    await editorial?.stop();
    editorial = await start(
      editorialBundle,
      editorialEnv,
      editorialPort,
      '/api/health'
    );
  };
  const restartDiscussion = async () => {
    await discussion?.stop();
    discussion = await start(
      discussionBundle,
      discussionEnv,
      discussionPort,
      '/api/health'
    );
  };
  async function close() {
    await stopWorker();
    await editorial?.stop();
    await discussion?.stop();
    await sql?.destroy();
    await mongo.close();
    await releaseStore?.();
    storage?.destroy();
  }
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await mongo.connect();
        break;
      } catch (error) {
        if (attempt >= 30) throw error;
        await delay(200);
      }
    }
    storage = new S3Client({
      endpoint: common.DISCUSSION_STORAGE_HOST,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: 'qualification', secretAccessKey: password },
    });
    releaseStore = await claimFreshObjectStore({
      listBuckets: async () =>
        (
          await storage.send(new ListBucketsCommand({}))
        ).Buckets.map((bucket) => bucket.Name),
      createBucket: (name) =>
        storage.send(new CreateBucketCommand({ Bucket: name })),
      deleteBucket: (name) =>
        storage.send(new DeleteBucketCommand({ Bucket: name })),
    });
    for (const [bundle, environment] of [
      [editorialBundle, editorialEnv],
      [discussionBundle, discussionEnv],
    ])
      await execute(
        process.execPath,
        [path.join(root, 'dist', bundle, 'main.js'), '--migrate'],
        { cwd: root, env: environment, timeout: 30000 }
      );
    sql = await new DataSource({
      type: 'mysql',
      host: env.MYSQL_HOST,
      port: Number(env.MYSQL_PORT),
      username: env.MYSQL_USERNAME,
      password,
      database: 'editorial',
      synchronize: false,
    }).initialize();
    const reader = new MysqlEditorialSnapshotReader(sql, 'default');
    const projections = new MongoEditorialProjections(
      mongo.db('editorial').collection('editorial_projections_v1')
    );
    await restartEditorial();
    await restartDiscussion();
    return {
      endpoints,
      close,
      restartEditorial,
      restartDiscussion,
      stopEditorial: () => editorial.stop(),
      stopDiscussion: () => discussion.stop(),
      project: async (kind, id) =>
        projections.publish(
          projectEditorialSnapshot(await reader.read(kind, id))
        ),
      startWorker: () => {
        assert.equal(worker.child, null);
        worker.child = spawn(
          process.execPath,
          [
            path.join(
              root,
              'dist/sdk/features/discussion/applications/materializer/main.js'
            ),
          ],
          { cwd: root, env: discussionEnv, stdio: ['ignore', 'pipe', 'pipe'] }
        );
        for (const stream of [worker.child.stdout, worker.child.stderr])
          stream.on('data', (chunk) => {
            worker.diagnostic = (worker.diagnostic + chunk).slice(-8000);
          });
        processes.push({ stop: stopWorker });
      },
      assertWorker: () => {
        assert.equal(worker.child?.exitCode, null, worker.diagnostic);
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}

module.exports = { profileParityServices };
