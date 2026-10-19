const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { DataSource } = require('typeorm');
const { MongoClient } = require('mongodb');
const {
  applicationParityServices,
} = require('./application-parity-services.cjs');

// Reuse disposable Editorial stores, but add an independent generic Discussion API/worker.
async function articleParityServices(options) {
  const {
    root,
    env,
    password,
    container,
    start,
    freePort,
    execute,
    processes,
  } = options;
  const editorial = await applicationParityServices(options);
  let community, sql, mongo, worker;
  let diagnostic = '';
  async function stopDiscussionWorker() {
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
  async function close() {
    // All cleanup operations are attempted even if an earlier resource fails.
    const results = await Promise.allSettled([
      stopDiscussionWorker(),
      community?.stop(),
      sql?.destroy(),
      mongo?.close(),
      editorial.close(),
    ]);
    const errors = results.filter((result) => result.status === 'rejected');
    if (errors.length)
      throw new AggregateError(
        errors.map((result) => result.reason),
        'Article service cleanup failed'
      );
  }
  try {
    const policyPort = await container(
      'article-discussion-opa',
      'openpolicyagent/opa:1.4.2-static',
      8181,
      [
        '--mount',
        `type=bind,source=${path.join(
          root,
          'sdk/features/identity/packages/infrastructure/opa/bundles/discussion'
        )},target=/policies,readonly`,
      ],
      ['run', '--server', '--addr=0.0.0.0:8181', '/policies']
    );
    const port = await freePort();
    const endpoints = {
      ...editorial.endpoints,
      DISCUSSION_URL: `http://127.0.0.1:${port}`,
    };
    const environment = {
      ...editorial.environment,
      ...endpoints,
      MYSQL_DATABASE: 'discussion',
      MONGO_DATABASE: 'discussion',
      DISCUSSION_DATABASE_HOST: env.MYSQL_HOST,
      DISCUSSION_DATABASE_PORT: env.MYSQL_PORT,
      DISCUSSION_DATABASE_USERNAME: env.MYSQL_USERNAME,
      DISCUSSION_DATABASE_PASSWORD: password,
      DISCUSSION_DATABASE_NAME: 'discussion',
      DISCUSSION_HOST: '127.0.0.1',
      DISCUSSION_PORT: String(port),
      DISCUSSION_PUBLIC_TENANT: 'default',
      DISCUSSION_SEED_DEMO_DATA: 'false',
      DISCUSSION_STORAGE_HOST: editorial.environment.EDITORIAL_MEDIA_ENDPOINT,
      DISCUSSION_STORAGE_ACCESSKEY: 'qualification',
      DISCUSSION_STORAGE_SECRETKEY: password,
      DISCUSSION_ERASURE_WORKERS_FENCED: 'false',
      OPA_URL: `http://127.0.0.1:${policyPort}`,
    };
    const bundle = 'sdk/features/discussion/applications/management';
    await execute(
      process.execPath,
      [path.join(root, 'dist', bundle, 'main.js'), '--migrate'],
      {
        cwd: root,
        env: environment,
        timeout: 30000,
      }
    );
    sql = await new DataSource({
      type: 'mysql',
      host: env.MYSQL_HOST,
      port: Number(env.MYSQL_PORT),
      username: env.MYSQL_USERNAME,
      password,
      database: 'discussion',
      synchronize: false,
    }).initialize();
    mongo = new MongoClient(
      `mongodb://wapps:${password}@127.0.0.1:${environment.MONGO_PORT}/?authSource=admin`,
      {
        serverSelectionTimeoutMS: 1000,
      }
    );
    await mongo.connect();
    const restartCommunity = async () => {
      await community?.stop();
      community = await start(bundle, environment, port, '/api/health');
    };
    await restartCommunity();
    return {
      ...editorial,
      endpoints,
      close,
      restartCommunity,
      stopCommunity: () => community.stop(),
      discussionSql: sql,
      discussionHeads: mongo
        .db('discussion')
        .collection('discussion_generation_heads'),
      stopDiscussionWorker,
      startDiscussionWorker: async () => {
        await stopDiscussionWorker();
        diagnostic = '';
        worker = spawn(
          process.execPath,
          [
            path.join(
              root,
              'dist/sdk/features/discussion/applications/materializer/main.js'
            ),
          ],
          {
            cwd: root,
            env: environment,
            stdio: ['ignore', 'pipe', 'pipe'],
          }
        );
        for (const stream of [worker.stdout, worker.stderr])
          stream.on('data', (chunk) => {
            diagnostic = (diagnostic + chunk).slice(-16000);
          });
        processes.push({ stop: stopDiscussionWorker });
      },
      assertDiscussionWorker: () => {
        assert.ok(worker, 'Discussion worker has not started');
        assert.equal(worker.exitCode, null, diagnostic);
        assert.equal(worker.signalCode, null, diagnostic);
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}

module.exports = { articleParityServices };
