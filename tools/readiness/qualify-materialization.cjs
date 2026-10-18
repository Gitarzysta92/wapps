/* Real-store checks run on temporary loopback containers without existing volumes. */
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { createConnection } = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const amqp = require('amqplib');

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some(
      (arg) =>
        ![
          '--catalog-browser',
          '--catalog-only',
          '--favorites',
          '--favorites-browser',
          '--account-export-sources',
          '--discussion-payloads',
          '--discussion-bff',
          '--discussion-author-erasure',
          '--reply-notifications',
          '--mention-notifications',
          '--favorite-updates',
        ].includes(arg)
    )
  )
    throw new Error('Unknown qualification option');
  const catalogBrowser = args.includes('--catalog-browser');
  const catalogOnly = args.includes('--catalog-only');
  if (
    catalogOnly &&
    args.some((arg) => !['--catalog-only', '--catalog-browser'].includes(arg))
  )
    throw new Error(
      'Catalog-only qualification supports only the optional catalog browser'
    );
  const exportSources = args.includes('--account-export-sources');
  const payloads = args.includes('--discussion-payloads');
  const discussionBff = args.includes('--discussion-bff');
  if (discussionBff && args.length !== 1)
    throw new Error('Discussion BFF qualification runs independently');
  const authorErasure = args.includes('--discussion-author-erasure');
  if (authorErasure && args.length !== 1)
    throw new Error(
      'Discussion author erasure qualification runs independently'
    );
  const favoriteUpdates = args.includes('--favorite-updates');
  if (favoriteUpdates && args.length !== 1)
    throw new Error('Favorite update qualification runs independently');
  const mentionNotifications = args.includes('--mention-notifications');
  if (mentionNotifications && args.length !== 1)
    throw new Error('Mention notification qualification runs independently');
  const replyNotifications = args.includes('--reply-notifications');
  if (replyNotifications && args.length !== 1)
    throw new Error('Reply notification qualification runs independently');
  const objectStoresOnly =
    exportSources ||
    payloads ||
    replyNotifications ||
    favoriteUpdates ||
    mentionNotifications;
  if (payloads && args.length !== 1)
    throw new Error('Discussion payload qualification runs independently');
  if (exportSources && args.length !== 1)
    throw new Error('Account export source qualification runs independently');
  const favorites =
    args.includes('--favorites') || args.includes('--favorites-browser');
  const run = randomUUID();
  const password = randomUUID();
  const containers = [];
  let child;
  function cleanup() {
    child?.kill('SIGTERM');
    const failures = [];
    for (const name of containers.splice(0).reverse()) {
      try {
        execFileSync('docker', ['stop', '--time', '5', name], {
          stdio: 'pipe',
          timeout: 20_000,
        });
        execFileSync('docker', ['rm', '--volumes', name], {
          stdio: 'pipe',
          timeout: 20_000,
        });
      } catch {
        failures.push(name);
      }
    }
    if (failures.length)
      throw new Error(
        `Could not stop qualification containers: ${failures.join(', ')}`
      );
  }
  for (const [signal, code] of [
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ]) {
    process.once(signal, () => {
      try {
        cleanup();
      } finally {
        process.exit(code);
      }
    });
  }
  function start(
    service,
    image,
    port,
    options,
    environment = {},
    command = []
  ) {
    const name = `wapps-materialization-${service}-${run}`;
    execFileSync(
      'docker',
      [
        'run',
        '--detach',
        '--pull=never',
        '--name',
        name,
        '--publish',
        `127.0.0.1::${port}`,
        ...options,
        ...Object.keys(environment).flatMap((key) => ['--env', key]),
        image,
        ...command,
      ],
      {
        env: { ...process.env, ...environment },
        stdio: 'pipe',
        timeout: 30_000,
      }
    );
    containers.push(name);
    const assigned = Number(
      execFileSync(
        'docker',
        [
          'inspect',
          '--format',
          `{{(index (index .NetworkSettings.Ports "${port}/tcp") 0).HostPort}}`,
          name,
        ],
        { encoding: 'utf8' }
      ).trim()
    );
    if (!Number.isInteger(assigned) || assigned < 1 || assigned > 65535)
      throw new Error('Invalid qualification port');
    const imageId = execFileSync(
      'docker',
      ['inspect', '--format', '{{.Image}}', name],
      { encoding: 'utf8' }
    ).trim();
    console.log(JSON.stringify({ service, image, imageId, port: assigned }));
    return assigned;
  }
  async function ready(service, probe) {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await probe();
        console.log(`${service} is ready.`);
        return;
      } catch {
        const name = `wapps-materialization-${service.toLowerCase()}-${run}`;
        const state = JSON.parse(
          execFileSync(
            'docker',
            ['inspect', '--format', '{{json .State}}', name],
            { encoding: 'utf8' }
          )
        );
        if (!state.Running) {
          const diagnostics = path.join(
            mkdtempSync(path.join(tmpdir(), 'wapps-store-startup-')),
            `${service}.log`
          );
          const logs = execFileSync('docker', ['logs', '--tail', '100', name], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          writeFileSync(diagnostics, logs, { mode: 0o600 });
          throw new Error(
            `Temporary ${service} exited (${state.ExitCode}, OOM: ${state.OOMKilled}); startup diagnostics: ${diagnostics}`
          );
        }
        await delay(1000);
      }
    }
    throw new Error(`Temporary ${service} did not become ready`);
  }
  try {
    const sqlPort = start(
      'mysql',
      'mysql:8.4',
      3306,
      ['--memory=768m', '--cpus=1', '--tmpfs', '/var/lib/mysql:rw,size=512m'],
      { MYSQL_ROOT_PASSWORD: password }
    );
    const mongoPort = objectStoresOnly
      ? 0
      : start(
          'mongo',
          'mongo:7',
          27017,
          [
            '--memory=768m',
            '--cpus=1',
            '--tmpfs',
            '/data/db:rw,size=512m',
            '--tmpfs',
            '/data/configdb:rw,size=64m',
          ],
          {
            MONGO_INITDB_ROOT_USERNAME: 'wapps',
            MONGO_INITDB_ROOT_PASSWORD: password,
          },
          ['mongod', '--bind_ip', '0.0.0.0', '--wiredTigerCacheSizeGB', '0.25']
        );
    const queuePort = objectStoresOnly
      ? 0
      : start(
          'rabbitmq',
          'rabbitmq:4-management',
          5672,
          [
            '--memory=512m',
            '--cpus=1',
            '--tmpfs',
            '/var/lib/rabbitmq:rw,size=256m',
          ],
          { RABBITMQ_DEFAULT_USER: 'wapps', RABBITMQ_DEFAULT_PASS: password }
        );
    const minioPort = start(
      'minio',
      'minio/minio:RELEASE.2025-04-22T22-12-26Z',
      9000,
      ['--memory=512m', '--cpus=1', '--tmpfs', '/data:rw,size=256m'],
      { MINIO_ROOT_USER: 'wapps', MINIO_ROOT_PASSWORD: password },
      ['server', '/data']
    );
    const probes = await Promise.allSettled([
      ready('mysql', async () => {
        const connection = await createConnection({
          host: '127.0.0.1',
          port: sqlPort,
          user: 'root',
          password,
          connectTimeout: 1000,
        });
        await connection.end();
      }),
      ...(objectStoresOnly
        ? []
        : [
            ready('mongo', async () => {
              const client = new MongoClient(
                `mongodb://wapps:${password}@127.0.0.1:${mongoPort}/?authSource=admin`,
                {
                  serverSelectionTimeoutMS: 1000,
                  connectTimeoutMS: 1000,
                  socketTimeoutMS: 1000,
                }
              );
              try {
                await client.connect();
                await client.db('admin').command({ ping: 1 });
              } finally {
                await client.close();
              }
            }),
            ready('rabbitmq', async () => {
              const connection = await amqp.connect(
                `amqp://wapps:${password}@127.0.0.1:${queuePort}`,
                { timeout: 1000 }
              );
              await connection.close();
            }),
          ]),
      ready('minio', async () => {
        const response = await fetch(
          `http://127.0.0.1:${minioPort}/minio/health/ready`,
          { signal: AbortSignal.timeout(1000) }
        );
        await response.arrayBuffer();
        if (!response.ok) throw new Error('MinIO not ready');
      }),
    ]);
    for (const probe of probes)
      if (probe.status === 'rejected') throw probe.reason;
    console.log(
      `${
        objectStoresOnly ? 'SQL and MinIO' : 'All four'
      } isolated stores are ready. Existing Wapps databases and volumes are untouched.`
    );
    const environment = {
      ...process.env,
      LOCAL_PASSWORD: password,
      WAPPS_DISCUSSION_INTEGRATION: '1',
      WAPPS_ACCOUNT_EXPORT_DISCUSSION: exportSources ? '1' : '0',
      WAPPS_DISCUSSION_PAYLOADS: payloads ? '1' : '0',
      WAPPS_DISCUSSION_BFF: discussionBff ? '1' : '0',
      WAPPS_FAVORITE_UPDATES: favoriteUpdates ? '1' : '0',
      WAPPS_REPLY_NOTIFICATIONS: replyNotifications ? '1' : '0',
      WAPPS_MENTION_NOTIFICATIONS: mentionNotifications ? '1' : '0',
      WAPPS_DISCUSSION_AUTHOR_ERASURE: authorErasure ? '1' : '0',
      WAPPS_EDITORIAL_INTEGRATION: '1',
      WAPPS_EDITORIAL_PROJECTION_INTEGRATION: '1',
      WAPPS_CATALOG_INTEGRATION: '1',
      WAPPS_CATALOG_BROWSER: catalogBrowser ? '1' : '0',
      WAPPS_FAVORITES_INTEGRATION: favorites ? '1' : '0',
      WAPPS_FAVORITES_BROWSER: args.includes('--favorites-browser') ? '1' : '0',
      DISCUSSION_TEST_MYSQL_PORT: String(sqlPort),
      DISCUSSION_TEST_MYSQL_USERNAME: 'root',
      DISCUSSION_TEST_MONGO_PORT: String(mongoPort),
      DISCUSSION_TEST_QUEUE_PORT: String(queuePort),
      DISCUSSION_TEST_MINIO_PORT: String(minioPort),
      EDITORIAL_TEST_MYSQL_PORT: String(sqlPort),
      EDITORIAL_TEST_MYSQL_USERNAME: 'root',
      EDITORIAL_TEST_MYSQL_PASSWORD: password,
      EDITORIAL_TEST_MONGO_PORT: String(mongoPort),
      EDITORIAL_TEST_MONGO_USERNAME: 'wapps',
      EDITORIAL_TEST_MONGO_PASSWORD: password,
      EDITORIAL_TEST_QUEUE_PORT: String(queuePort),
      EDITORIAL_TEST_QUEUE_USERNAME: 'wapps',
      EDITORIAL_TEST_QUEUE_PASSWORD: password,
    };
    let failed = false;
    for (const file of catalogOnly
      ? ['catalog-journey.test.cjs']
      : objectStoresOnly || authorErasure || discussionBff
      ? ['discussion-recovery.test.cjs']
      : [
          'discussion-recovery.test.cjs',
          'editorial-recovery.test.cjs',
          'editorial-projection-recovery.test.cjs',
          'catalog-journey.test.cjs',
        ]) {
      const code = await new Promise((resolve) => {
        child = spawn(
          process.execPath,
          ['--test', path.join(__dirname, file)],
          { env: environment, stdio: 'inherit' }
        );
        const deadline = setTimeout(
          () => child?.kill('SIGKILL'),
          catalogBrowser ? 300_000 : 180_000
        );
        child.once('error', () => {
          clearTimeout(deadline);
          resolve(1);
        });
        child.once('exit', (code) => {
          clearTimeout(deadline);
          child = undefined;
          resolve(code ?? 1);
        });
      });
      failed ||= code !== 0;
    }
    process.exitCode = failed ? 1 : 0;
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Qualification failed'
  );
  process.exitCode = 1;
});
