const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { processService } = require('./qualification-process.cjs');

// The public discovery contract includes reviews from the actual Community API.
module.exports = async function discoveryCommunity({
  root, source, environment, editorialOrigin, start, ready, opaBinary,
}) {
  const password = environment.EDITORIAL_DATABASE_PASSWORD;
  const queuePort = start('discovery-queue', 'rabbitmq:4-management', 5672, {
    RABBITMQ_DEFAULT_USER: 'wapps', RABBITMQ_DEFAULT_PASS: password,
    RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS: '+S 2:2',
  });
  await ready(async () => {
    const connection = await require('amqplib').connect(
      `amqp://wapps:${encodeURIComponent(password)}@127.0.0.1:${queuePort}/`,
      { timeout: 1000 }
    );
    await connection.close();
  });
  const objectPort = start('discovery-media', 'minio/minio:RELEASE.2025-04-22T22-12-26Z', 9000,
    { MINIO_ROOT_USER: 'qualification', MINIO_ROOT_PASSWORD: password }, ['server', '/data']);
  const endpoint = `http://127.0.0.1:${objectPort}`;
  await ready(async () => {
    const response = await fetch(endpoint + '/minio/health/ready', { signal: AbortSignal.timeout(1000) });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
  });
  const policyBundle = path.join(root, 'sdk/features/identity/packages/infrastructure/opa/bundles/discussion');
  let policy, service;
  const env = {
    ...environment,
    MYSQL_HOST: environment.EDITORIAL_DATABASE_HOST,
    MYSQL_PORT: environment.EDITORIAL_DATABASE_PORT,
    MYSQL_USERNAME: environment.EDITORIAL_DATABASE_USERNAME,
    MYSQL_PASSWORD: password,
    MYSQL_DATABASE: 'discovery_community',
    DISCUSSION_DATABASE_HOST: environment.EDITORIAL_DATABASE_HOST,
    DISCUSSION_DATABASE_PORT: environment.EDITORIAL_DATABASE_PORT,
    DISCUSSION_DATABASE_USERNAME: environment.EDITORIAL_DATABASE_USERNAME,
    DISCUSSION_DATABASE_PASSWORD: password,
    DISCUSSION_DATABASE_NAME: 'discovery_community',
    DISCUSSION_STORAGE_HOST: endpoint,
    DISCUSSION_STORAGE_ACCESSKEY: 'qualification',
    DISCUSSION_STORAGE_SECRETKEY: password,
    DISCUSSION_HOST: '127.0.0.1', DISCUSSION_PORT: '0',
    DISCUSSION_SEED_DEMO_DATA: 'false', DISCUSSION_PUBLIC_TENANT: 'default',
    MONGO_DATABASE: 'discovery_community',
    QUEUE_HOST: '127.0.0.1', QUEUE_PORT: String(queuePort),
    QUEUE_USERNAME: 'wapps', QUEUE_PASSWORD: password,
  };
  const binary = path.join(root, 'dist/sdk/features/discussion/applications/management/main.js');
  async function stop() {
    try { await service?.stop(); } finally { await policy?.stop(); }
  }
  async function restart() {
    await service?.stop();
    env.EDITORIAL_URL = editorialOrigin();
    service = await processService(process.execPath, [binary], { cwd: root, env },
      log => log.match(/Discussion API is running on: (http:\/\/[^\s]+)\/api/)?.[1], '/api/health');
  }
  async function project(discussionId) {
    const { createPool } = require('mysql2/promise');
    const { MongoClient } = require('mongodb');
    const { MinioClient } = require('@sdk/extras/minio');
    const materializer = '../../sdk/features/discussion/applications/materializer/service/src/';
    const { MysqlDiscussionSnapshotReader } = require(materializer + 'mysql-snapshot-reader');
    const { MinioImmutablePayloadReader } = require(materializer + 'immutable-payload-reader');
    const { MongoGenerationStore } = require(materializer + 'mongo-generation-store');
    const { materializeDiscussion } = require(materializer + 'materialization');
    const pool = createPool({
      host: env.MYSQL_HOST, port: Number(env.MYSQL_PORT),
      user: env.MYSQL_USERNAME, password: env.MYSQL_PASSWORD, database: env.MYSQL_DATABASE,
    });
    const mongo = new MongoClient(`mongodb://${encodeURIComponent(env.MONGO_USERNAME)}:${encodeURIComponent(env.MONGO_PASSWORD)}@${env.MONGO_HOST}:${env.MONGO_PORT}`);
    try {
      await mongo.connect();
      const db = mongo.db(env.MONGO_DATABASE);
      const store = new MongoGenerationStore(db.collection('discussion_generation_nodes'), db.collection('discussion_generation_heads'));
      await store.ensureIndexes();
      await materializeDiscussion(discussionId, new MysqlDiscussionSnapshotReader(pool),
        new MinioImmutablePayloadReader(new MinioClient({ host: endpoint, accessKey: 'qualification', secretKey: password })), store);
    } finally {
      await pool.end();
      await mongo.close();
    }
  }
  try {
    if (process.env.WAPPS_SUITES_OPA_DOCKER === '1') {
      const port = start('discovery-policy', 'openpolicyagent/opa:1.4.2-static', 8181, {},
        ['run', '--server', '--addr', '0.0.0.0:8181', '/policy'],
        ['--mount', `type=bind,source=${policyBundle},target=/policy,readonly`]);
      env.OPA_URL = `http://127.0.0.1:${port}`;
      await ready(async () => {
        const response = await fetch(env.OPA_URL + '/health', { signal: AbortSignal.timeout(1000) });
        assert.equal(response.status, 200);
        await response.arrayBuffer();
      });
    } else {
      const reservation = net.createServer();
      await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
      const port = reservation.address().port;
      await new Promise(resolve => reservation.close(resolve));
      env.OPA_URL = `http://127.0.0.1:${port}`;
      policy = await processService(opaBinary,
        ['run', '--server', '--addr', `127.0.0.1:${port}`, policyBundle],
        { cwd: root }, () => env.OPA_URL, '/health');
    }
    await source.query('CREATE DATABASE discovery_community CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
    execFileSync(process.execPath, [binary, '--migrate'], { cwd: root, env, stdio: 'pipe', timeout: 30000 });
    await restart();
    return { get origin() { return service.origin; }, restart, stop, project, pause: () => service.stop() };
  } catch (error) {
    await stop();
    throw error;
  }
};
