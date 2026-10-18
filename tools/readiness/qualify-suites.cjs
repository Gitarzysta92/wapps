/* Disposable real SQL/Mongo/OPA qualification for the private suite workflow. */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const config = path.join(root, 'tsconfig.base.json');
require('ts-node').register({
  project: config,
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
require('tsconfig-paths').register({
  baseUrl: root,
  paths: ts.readConfigFile(config, ts.sys.readFile).config.compilerOptions
    .paths,
});
require('reflect-metadata');
const {
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
} = require('../../libs/adapters/account-mysql/src');
const { DataSource } = require('typeorm');
const { createConnection } = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const { processService } = require('./qualification-process.cjs');
const load = (name) =>
  require(path.join(root, 'apps/services/editorial/src/app', name));
const { EditorialOwnership1791676802000 } = load(
  'infrastructure/editorial-schema.migration'
);
const { EditorialBackfill1791676803000 } = load(
  'infrastructure/editorial-backfill.migration'
);
const { SuiteWorkspace1791676808000 } = load(
  'suites/suite-workspace.migration'
);
const { SuitePublication1791676809000 } = load(
  'suites/suite-publication.migration'
);
const { SuitePublicationSnapshots1791840009000 } = load(
  'suites/suite-publication-snapshots.migration'
);
const { EditorialAuthorErasure1791840010000 } = load(
  'account-erasure/editorial-author-erasure.migration'
);
const { EditorialMediaAssets1791840011000 } = load(
  'application-media/editorial-media-assets.migration'
);
const { EditorialWorkspaceErasure1791840012000 } = load(
  'account-erasure/editorial-workspace-erasure.migration'
);
const { EditorialAuditErasure1791840013000 } = load(
  'account-erasure/editorial-audit-erasure.migration'
);
const { ContentClassification1791886000000 } = load(
  'content-classification/content-classification.migration'
);
const { HealthObservations1791840018000 } = load(
  'application-health/health-observations.migration'
);
const { EditorialContentUpdates1791840017000 } = load(
  'infrastructure/content-update-cursors.migration'
);
const { EditorialErasureCompletion1791840014000 } = load(
  'account-erasure/editorial-erasure-completion.migration'
);
const { ApplicationDrafts1791676810000 } = load(
  'application-drafts/application-drafts.migration'
);
const { ApplicationPublication1791676811000 } = load(
  'application-publication/application-publication.migration'
);
const { ApplicationOwnership1791676812000 } = load(
  'application-ownership/application-ownership.migration'
);
const { ApplicationEditing1791676813000 } = load(
  'application-drafts/application-editing.migration'
);
const { ApplicationImages1791676814000 } = load(
  'application-media/application-images.migration'
);
const { ApplicationImageBindings1791676815000 } = load(
  'application-media/application-image-bindings.migration'
);
const { ApplicationImageCleanup1791676816000 } = load(
  'application-media/application-image-cleanup.migration'
);
const { ReleaseWorkspace1791676817000 } = load(
  'releases/release-workspace.migration'
);
const { ArticleWorkspace1791676818000 } = load(
  'articles/article-workspace.migration'
);
const { ArticleCovers1791676819000 } = load(
  'article-covers/article-covers.migration'
);
const { ArticleCoverReferences1791676820000 } = load(
  'article-covers/article-cover-references.migration'
);
const { ArticleCoverCleanup1791676821000 } = load(
  'article-covers/article-cover-cleanup.migration'
);
const { MysqlSuiteWorkspace } = load('suites/mysql-suite-workspace');
const { SuiteWorkspace } = load('suites/suite-workspace');
const { OpaEditorialPolicy } = load('infrastructure/opa-editorial-policy');
const { EditorialCommands } = load('application/editorial-commands');
const { MysqlEditorialWrites } = load('infrastructure/mysql-editorial-writes');
const { MysqlEditorialSnapshotReader } = load(
  'infrastructure/mysql-editorial-snapshot'
);
const { MongoEditorialProjections } = load(
  'infrastructure/mongo-editorial-projections'
);
const { projectEditorialSnapshot } = load(
  'application/editorial-materialization'
);

async function main() {
  const notificationWorkflows = [
    '--reply-notifications',
    '--favorite-updates',
    '--mention-notifications',
    '--explore',
    '--digest',
    '--timeline',
    '--favorites-content-preferences',
  ].filter((flag) => process.argv.includes(flag));
  if (notificationWorkflows.length > 1)
    throw new Error('Qualify one notification workflow per run');
  if (
    notificationWorkflows.length &&
    (!process.argv.includes('--account-export-runtime') ||
      process.argv.includes('--account-erasure-coordinator'))
  )
    throw new Error(
      'Notification qualification requires --account-export-runtime and runs separately from --account-erasure-coordinator'
    );
  const run = randomUUID();
  const password = randomUUID();
  const containers = [];
  const output =
    process.env.WAPPS_SUITES_OUTPUT ?? '/tmp/wapps-readiness/suites';
  fs.mkdirSync(output, { recursive: true });
  let source, mongo, editorial, opa;
  let failure;
  let failed = false;
  const cleanupFailures = [];
  const checks = [];
  const pass = (name) => {
    checks.push(name);
    console.log('PASS:', name);
  };
  function start(
    name,
    image,
    port,
    environment,
    args = [],
    dockerOptions = []
  ) {
    const container = `wapps-suites-${name}-${run}`;
    execFileSync(
      'docker',
      [
        'run',
        '-d',
        '--pull=never',
        '--name',
        container,
        '--memory=768m',
        '--cpus=1',
        '-p',
        `127.0.0.1::${port}`,
        ...Object.keys(environment).flatMap((key) => ['-e', key]),
        ...dockerOptions,
        image,
        ...args,
      ],
      { env: { ...process.env, ...environment }, stdio: 'pipe', timeout: 30000 }
    );
    containers.push(container);
    return Number(
      execFileSync(
        'docker',
        [
          'inspect',
          '--format',
          `{{(index (index .NetworkSettings.Ports "${port}/tcp") 0).HostPort}}`,
          container,
        ],
        { encoding: 'utf8' }
      ).trim()
    );
  }
  async function ready(probe) {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        return await probe();
      } catch {
        await delay(500);
      }
    }
    throw new Error('Temporary store did not become ready');
  }
  try {
    const sqlPort = start('mysql', 'mysql:8.4', 3306, {
      MYSQL_ROOT_PASSWORD: password,
    });
    const mongoPort = start(
      'mongo',
      'mongo:7',
      27017,
      {
        MONGO_INITDB_ROOT_USERNAME: 'wapps',
        MONGO_INITDB_ROOT_PASSWORD: password,
      },
      ['mongod', '--wiredTigerCacheSizeGB', '0.25']
    );
    const queuePort =
      process.argv.includes('--delivery') ||
      process.argv.includes('--account-export-runtime')
        ? start('rabbitmq', 'rabbitmq:4-management', 5672, {
            RABBITMQ_DEFAULT_USER: 'wapps',
            RABBITMQ_DEFAULT_PASS: password,
            RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS: '+S 2:2',
          })
        : null;
    if (queuePort)
      await ready(async () => {
        const connection = await require('amqplib').connect(
          `amqp://wapps:${encodeURIComponent(
            password
          )}@127.0.0.1:${queuePort}/`,
          { timeout: 1000 }
        );
        await connection.close();
      });
    const sql = {
      host: '127.0.0.1',
      port: sqlPort,
      user: 'root',
      password,
      connectTimeout: 1000,
    };
    await ready(async () => {
      const connection = await createConnection(sql);
      await connection.query(
        'CREATE DATABASE IF NOT EXISTS suites CHARACTER SET utf8mb4 COLLATE utf8mb4_bin'
      );
      await connection.end();
    });
    mongo = new MongoClient(
      `mongodb://wapps:${password}@127.0.0.1:${mongoPort}/?authSource=admin`,
      { serverSelectionTimeoutMS: 500 }
    );
    await ready(() => mongo.connect());
    source = await new DataSource({
      type: 'mysql',
      host: sql.host,
      port: sql.port,
      username: sql.user,
      password,
      database: 'suites',
      timezone: 'Z',
      synchronize: false,
      migrations: [
        EditorialOwnership1791676802000,
        EditorialBackfill1791676803000,
        SuiteWorkspace1791676808000,
        SuitePublication1791676809000,
        ApplicationDrafts1791676810000,
        ApplicationPublication1791676811000,
        ApplicationOwnership1791676812000,
        ApplicationEditing1791676813000,
        ApplicationImages1791676814000,
        ApplicationImageBindings1791676815000,
        ApplicationImageCleanup1791676816000,
        ReleaseWorkspace1791676817000,
        ArticleWorkspace1791676818000,
        ArticleCovers1791676819000,
        ArticleCoverReferences1791676820000,
        ArticleCoverCleanup1791676821000,
        IdentityWriteBarrier1791840000000,
        AccountErasureRequests1791840001000,
        SuitePublicationSnapshots1791840009000,
        EditorialAuthorErasure1791840010000,
        EditorialMediaAssets1791840011000,
        EditorialWorkspaceErasure1791840012000,
        EditorialAuditErasure1791840013000,
        EditorialErasureCompletion1791840014000,
        EditorialContentUpdates1791840017000,
        HealthObservations1791840018000,
        ContentClassification1791886000000,
      ],
      migrationsRun: true,
      migrationsTransactionMode: 'none',
      migrationsTableName: 'editorial_migrations',
    }).initialize();
    const policyBundle = path.join(
      root,
      'sdk/features/identity/packages/infrastructure/opa/bundles/editorial'
    );
    const reservation = net.createServer();
    await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    let opaPort = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    if (process.env.WAPPS_SUITES_OPA_DOCKER === '1') {
      opaPort = start(
        'opa',
        'openpolicyagent/opa:1.4.2-static',
        8181,
        {},
        ['run', '--server', '--addr', '0.0.0.0:8181', '/policy'],
        ['--mount', `type=bind,source=${policyBundle},target=/policy,readonly`]
      );
      const container = containers[containers.length - 1];
      opa = {
        stop: async () => {
          execFileSync('docker', ['stop', container], {
            stdio: 'pipe',
            timeout: 20000,
          });
        },
      };
      await ready(async () => {
        const response = await fetch(`http://127.0.0.1:${opaPort}/health`, {
          signal: AbortSignal.timeout(1000),
        });
        assert.equal(response.status, 200);
        await response.arrayBuffer();
      });
    }
    const opaOrigin = `http://127.0.0.1:${opaPort}`;
    const opaBinary =
      process.env.OPA_BINARY ?? '/tmp/wapps-readiness/opa-1.4.2';
    if (!opa)
      opa = await processService(
        opaBinary,
        ['run', '--server', '--addr', `127.0.0.1:${opaPort}`, policyBundle],
        { cwd: root },
        () => opaOrigin,
        '/health'
      );
    const secret = randomUUID();
    const erasureSecret = randomUUID();
    const environment = {
      ...process.env,
      NODE_ENV: 'test',
      EDITORIAL_PORT: '0',
      EDITORIAL_HOST: '127.0.0.1',
      EDITORIAL_SEED_DEMO_DATA: 'false',
      EDITORIAL_PUBLIC_TENANT: 'default',
      EDITORIAL_DATABASE_HOST: sql.host,
      EDITORIAL_DATABASE_PORT: String(sql.port),
      EDITORIAL_DATABASE_USERNAME: sql.user,
      EDITORIAL_DATABASE_PASSWORD: password,
      EDITORIAL_DATABASE_NAME: 'suites',
      MONGO_HOST: '127.0.0.1',
      MONGO_PORT: String(mongoPort),
      MONGO_USERNAME: 'wapps',
      MONGO_PASSWORD: password,
      MONGO_DATABASE: 'suites',
      QUEUE_HOST: '127.0.0.1',
      QUEUE_PORT: '1',
      QUEUE_USERNAME: 'unavailable',
      QUEUE_PASSWORD: 'unavailable',
      INGRESS_AUTH_SECRET: secret,
      EXPLORE_SERVICE_SECRET: 'qualification-explore-secret-2026-only',
      ACCOUNT_ERASURE_SECRET: erasureSecret,
      NOTIFICATION_SERVICE_SECRET:
        'qualification-notification-secret-2026-only',
      EDITORIAL_ERASURE_WORKERS_FENCED: 'false',
      EDITORIAL_MEDIA_CLEANUP_ENABLED: 'false',
      EDITORIAL_HEALTH_MONITOR_ENABLED: 'false',
      OPA_URL: opaOrigin,
    };
    const restart = async () => {
      await editorial?.stop();
      editorial = await processService(
        process.execPath,
        [path.join(root, 'dist/apps/services/editorial/main.js')],
        { cwd: root, env: environment },
        (diagnostic) =>
          diagnostic.match(/is running on: (http:\/\/[^\s]+)\/api/)?.[1],
        '/api/health'
      );
    };
    const discoveryTags = process.argv.includes('--discovery-tags');
    if (process.argv.includes('--discovery') || discoveryTags) {
      await restart();
      await require(discoveryTags
        ? './discovery-tags-runtime-checks.cjs'
        : './discovery-runtime-checks.cjs')({
        root,
        source,
        origin: () => editorial.origin,
        secret,
        restart,
        stop: () => editorial.stop(),
        pass,
        output,
        reader: new MysqlEditorialSnapshotReader(source, 'default'),
        projections: new MongoEditorialProjections(
          mongo.db('suites').collection('editorial_projections_v1')
        ),
        collection: mongo.db('suites').collection('editorial_projections_v1'),
        browser: !process.argv.includes('--no-browser'),
      });
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            workflow: discoveryTags ? 'article-tag-discovery' : 'grouped-discovery',
            checks,
            node: process.version,
            authority: discoveryTags
              ? 'Real MySQL/Mongo/OPA and compiled Editorial/BFF'
              : 'Real MySQL/Mongo/OPA and compiled Editorial/BFF/portal',
            substitutions: [
              discoveryTags
                ? 'Trusted author/reviewer identity claims; pure production preference selector with fixture choices, no Account persistence or browser'
                : 'Trusted ingress identities and browser shell/profile/preferences fixtures',
              'Direct production materializer invocation without broker delivery',
            ],
            exclusions: [
              'Deployed identity/ingress',
              'Production restart/restore/rollback/load/soak',
            ],
          },
          null,
          2
        )
      );
    } else if (process.argv.includes('--health')) {
      await restart();
      await require('./health-runtime-checks.cjs')({
        root,
        source,
        origin: () => editorial.origin,
        secret,
        restart,
        stop: () => editorial.stop(),
        stopPolicy: () => opa.stop(),
        pass,
        output,
        policy: new OpaEditorialPolicy(opaOrigin),
        reader: new MysqlEditorialSnapshotReader(source, 'default'),
        projections: new MongoEditorialProjections(
          mongo.db('suites').collection('editorial_projections_v1')
        ),
        browser: !process.argv.includes('--no-browser'),
      });
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            workflow: 'http-application-health',
            checks,
            node: process.version,
            authority:
              'Real MySQL/Mongo/OPA, HTTP transport, compiled Editorial/BFF and both Nginx API route sets',
            browser: !process.argv.includes('--no-browser'),
            substitutions: [
              'Logical public DNS and pinned HTTP transport route to a local endpoint fixture; production private-address rejection stays enabled',
              'Elapsed stale/retry times are controlled in disposable SQL fixtures',
              'Trusted staff authentication subrequests are controlled fixtures; optional browser shell profile/preferences are fixtures',
            ],
            exclusions: [
              'Deployed egress, real public DNS/TLS endpoints and deployed authentication/ingress',
              'Production restart/restore/rollback/load/soak',
            ],
          },
          null,
          2
        )
      );
    } else if (
      process.argv.includes('--editorial-media-assets') ||
      process.argv.includes('--editorial-media-retirement') ||
      process.argv.includes('--editorial-workspace-erasure') ||
      process.argv.includes('--editorial-audit-erasure') ||
      process.argv.includes('--editorial-erasure-participant')
    ) {
      const participantErasure = process.argv.includes(
        '--editorial-erasure-participant'
      );
      const retirement = process.argv.includes('--editorial-media-retirement');
      const auditErasure = process.argv.includes('--editorial-audit-erasure');
      const workspaceErasure =
        auditErasure || process.argv.includes('--editorial-workspace-erasure');
      const objectPort = start(
        'minio',
        'minio/minio:RELEASE.2025-04-22T22-12-26Z',
        9000,
        { MINIO_ROOT_USER: 'qualification', MINIO_ROOT_PASSWORD: password },
        ['server', '/data']
      );
      const endpoint = `http://127.0.0.1:${objectPort}`;
      await ready(async () => {
        const response = await fetch(endpoint + '/minio/health/ready', {
          signal: AbortSignal.timeout(1000),
        });
        assert.equal(response.status, 200);
      });
      Object.assign(environment, {
        EDITORIAL_MEDIA_ENDPOINT: endpoint,
        EDITORIAL_MEDIA_BUCKET: 'retained-media',
        EDITORIAL_MEDIA_ACCESS_KEY: 'qualification',
        EDITORIAL_MEDIA_SECRET_KEY: password,
        EDITORIAL_MEDIA_PUBLIC_ORIGIN: 'https://retained.example.test',
      });
      const { S3Client, CreateBucketCommand } = require('@aws-sdk/client-s3');
      const storage = {
        endpoint,
        region: 'us-east-1',
        forcePathStyle: true,
        credentials: {
          accessKeyId: 'qualification',
          secretAccessKey: password,
        },
      };
      const client = new S3Client(storage);
      try {
        await client.send(
          new CreateBucketCommand({ Bucket: 'retained-media' })
        );
      } finally {
        client.destroy();
      }
      await restart();
      await require('./editorial-media-assets-checks.cjs')({
        storage,
        source,
        origin: () => editorial.origin,
        secret,
        restart,
        pass,
        policy: new OpaEditorialPolicy(opaOrigin),
        reader: new MysqlEditorialSnapshotReader(source, 'default'),
        projections: new MongoEditorialProjections(
          mongo.db('suites').collection('editorial_projections_v1')
        ),
        qualifyParticipant: participantErasure
          ? async (context) =>
              require('./editorial-erasure-participant-checks.cjs')({
                ...context,
                source,
                storage,
                restart,
                pass,
                erasureSecret,
                policy: new OpaEditorialPolicy(opaOrigin),
                origin: () => editorial.origin,
                environment: { ...environment },
                restartWith: async (patch) => {
                  Object.assign(environment, patch);
                  await restart();
                },
                reader: new MysqlEditorialSnapshotReader(source, 'default'),
                projections: new MongoEditorialProjections(
                  mongo.db('suites').collection('editorial_projections_v1')
                ),
              })
          : undefined,
        qualifyWorkspaceErasure: workspaceErasure
          ? async (context) => {
              const dependencies = {
                ...context,
                source,
                storage,
                restart,
                pass,
              };
              const audit = auditErasure
                ? await require('./editorial-audit-erasure-checks.cjs')(
                    dependencies
                  )
                : null;
              const workspace =
                await require('./editorial-workspace-erasure-checks.cjs')(
                  dependencies
                );
              if (audit) {
                const { MysqlEditorialAuditErasure } = load(
                  'account-erasure/mysql-editorial-audit-erasure'
                );
                assert.equal(
                  await new MysqlEditorialAuditErasure(source).advance({
                    identityId: context.owner.identityId,
                    revision: 11,
                  }),
                  'pending'
                );
              }
              return async (input) => {
                if (audit) {
                  const { MysqlEditorialAuditErasure } = load(
                    'account-erasure/mysql-editorial-audit-erasure'
                  );
                  assert.equal(
                    await new MysqlEditorialAuditErasure(source).advance(input),
                    'pending'
                  );
                }
                await workspace(input);
                if (audit) await audit(input);
              };
            }
          : undefined,
        qualifyRetirement: retirement
          ? async (retained) =>
              require('./editorial-media-retirement-checks.cjs')({
                source,
                storage,
                retained,
                restart,
                pass,
                maintenance: (args) =>
                  execFileSync(
                    process.execPath,
                    [
                      path.join(root, 'dist/apps/services/editorial/main.js'),
                      ...args,
                    ],
                    {
                      cwd: root,
                      env: environment,
                      encoding: 'utf8',
                      timeout: 60000,
                    }
                  ),
              })
          : undefined,
        qualifyBrowser: process.argv.includes('--no-browser')
          ? undefined
          : async ({ fields, articleId, coverId, bytes }) => {
              await require('./application-draft-browser.cjs').applicationDraftBrowser(
                {
                  root,
                  output,
                  source,
                  restart,
                  origin: () => editorial.origin,
                  workflowOnly: true,
                  articleWorkflow: async ({ session, go, text, capture }) => {
                    for (const name of [
                      'retained-media',
                      'retained-media-independent-restart',
                    ]) {
                      if (name.includes('restart')) await restart();
                      const page = await session('');
                      await go('/articles/' + fields.slug, page);
                      await text('Deleted account', page);
                      await text(fields.sections[0].paragraphs[0], page);
                      const selector = 'article-cover-image img';
                      await page.waitForFunction(
                        (selector) => {
                          const img = document.querySelector(selector);
                          return img?.complete && img.naturalWidth > 0;
                        },
                        {},
                        selector
                      );
                      const loaded = await page.evaluate(
                        async (route) =>
                          Array.from(
                            new Uint8Array(
                              await (await fetch(route)).arrayBuffer()
                            )
                          ),
                        `/api/media/articles/${articleId}/${coverId}`
                      );
                      assert.deepEqual(Buffer.from(loaded), bytes);
                      await capture(name, page);
                    }
                    return [
                      'anonymous public article and decoded real cover bytes after private history removal',
                      'independent public session and Editorial restart',
                    ];
                  },
                }
              );
              pass(
                'compiled article portal decodes retained MinIO cover bytes with anonymous text in independent sessions/restart at mobile/tablet/desktop light/dark layouts'
              );
            },
      });
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            workflow: participantErasure
              ? 'editorial-erasure-participant'
              : auditErasure
              ? 'editorial-audit-erasure'
              : workspaceErasure
              ? 'editorial-workspace-erasure'
              : retirement
              ? 'editorial-media-retirement'
              : 'editorial-media-assets',
            browser: !process.argv.includes('--no-browser'),
            checks,
            node: process.version,
            authority:
              'Real MySQL/Mongo/OPA/MinIO, Sharp and compiled Editorial HTTP; immutable media descriptors and reference authority',
            substitutions: [
              'Controlled DNS proof port; independent approval uses real OPA/MySQL',
              ...(auditErasure
                ? [
                    'Production audit-erasure adapter driven directly; legacy grant and large receipt/outbox histories use validated SQL fixtures',
                  ]
                : []),
              participantErasure
                ? 'Compiled Editorial participant drives all production cleanup phases; fixture setup reuses real publication, upload and ownership APIs'
                : workspaceErasure
                ? 'Production workspace-erasure adapter driven directly; full Account erasure orchestration remains uncomposed'
                : 'Original private history is removed explicitly in a disposable fixture; production erasure cleanup is not yet composed',
              'Browser shell account/profile/preferences and trusted ingress are fixtures',
              'Legacy backfill uses descriptor metadata fixtures without object bytes',
              ...(workspaceErasure
                ? [
                    'Large private histories and corrupt-row cases are SQL fixtures; ordinary publication, uploads and workspace cleanup use production paths',
                  ]
                : []),
              ...(retirement || workspaceErasure
                ? [
                    'Lease/retention clocks advance in selected recovery checks; compiled maintenance uses wall clock',
                  ]
                : []),
            ],
            exclusions: [
              participantErasure
                ? 'Enabled Account coordination and erasure portal journey'
                : auditErasure
                ? 'Exact projection completion and production participant composition'
                : workspaceErasure
                ? 'Ownership/proof/audit erasure, projection completion and production participant composition'
                : 'Production private-history erasure and participant completion',
              ...(retirement ? [] : ['Registry-only orphan retirement']),
              'Account erasure portal',
              'Discussion comments are unavailable in this browser harness',
              'Production fencing, deployment, restore, rollback, load and soak',
            ],
          },
          null,
          2
        )
      );
    } else if (
      process.argv.includes('--editorial-author-erasure') ||
      process.argv.includes('--editorial-projection-erasure')
    ) {
      const projectionErasure = process.argv.includes(
        '--editorial-projection-erasure'
      );
      await restart();
      await require('./editorial-author-erasure-checks.cjs')({
        source,
        origin: () => editorial.origin,
        secret,
        restart,
        pass,
        policy: new OpaEditorialPolicy(opaOrigin),
        reader: new MysqlEditorialSnapshotReader(source, 'default'),
        projections: new MongoEditorialProjections(
          mongo.db('suites').collection('editorial_projections_v1')
        ),
        qualifyProjections: projectionErasure
          ? (context) =>
              require('./editorial-projection-erasure-checks.cjs')({
                ...context,
                collection: mongo
                  .db('suites')
                  .collection('editorial_projections_v1'),
              })
          : undefined,
        qualifyBrowser: process.argv.includes('--no-browser')
          ? undefined
          : async ({ fields, materialize }) => {
              await require('./application-draft-browser.cjs').applicationDraftBrowser(
                {
                  root,
                  output,
                  source,
                  restart,
                  origin: () => editorial.origin,
                  workflowOnly: true,
                  articleWorkflow: async ({ session, go, text, capture }) => {
                    const reader = await session('');
                    const independent = await session('');
                    const route = '/articles/' + fields.slug;
                    await go(route, reader);
                    await text('Articles are unavailable or updating', reader);
                    await capture('anonymous-article-pending', reader);
                    await materialize();
                    await go(route, reader);
                    await text('Deleted account', reader);
                    await text(fields.sections[0].paragraphs[0], reader);
                    assert.equal(
                      await reader.$eval(
                        'app-article-catalog',
                        (el, byline) => el.textContent.includes(byline),
                        fields.byline
                      ),
                      false
                    );
                    await capture('anonymous-article-retained', reader);
                    await restart();
                    await go(route, independent);
                    await text('Deleted account', independent);
                    await text(fields.sections[0].paragraphs[0], independent);
                    await capture(
                      'anonymous-article-independent-restart',
                      independent
                    );
                    return [
                      'canonical revision hides old attributed projection',
                      'retained anonymous article and public text',
                      'independent public session after Editorial restart',
                    ];
                  },
                }
              );
              pass(
                'compiled public article portal shows truthful projection lag and anonymous retained text across independent sessions/restart in mobile/tablet/desktop light/dark layouts'
              );
            },
      });
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            workflow: projectionErasure
              ? 'editorial-projection-erasure'
              : 'editorial-author-erasure',
            checks,
            node: process.version,
            authority:
              'Real MySQL/Mongo/OPA and compiled Editorial HTTP; existing exact erasure participant request and bounded production adapter',
            substitutions: [
              'Domain proof port is controlled; independent approval uses real OPA and MySQL',
              'Article cover ready metadata and complete processing receipt are fixtures; object delivery is excluded',
              ...(projectionErasure
                ? [
                    'Invalid/stale/missing Mongo documents and corrupted SQL authority are controlled failure fixtures; current edits and cleanup use production adapters',
                  ]
                : []),
              'Browser shell account/profile/preferences and trusted ingress use local fixtures',
            ],
            exclusions: [
              'Editorial private/audit/media cleanup and participant completion',
              'Account erasure portal',
              'Production fencing, deployment, restore, rollback, load and soak',
            ],
          },
          null,
          2
        )
      );
    } else if (process.argv.includes('--identity-write-barriers')) {
      await restart();
      await require('./editorial-erasure-barrier-checks.cjs')({
        source,
        origin: () => editorial.origin,
        secret,
        restart,
        pass,
      });
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            workflow: 'editorial-identity-write-barriers',
            checks,
            node: process.version,
            authority:
              'Compiled Editorial HTTP, real MySQL and OPA; trusted ingress identities and internal erasure markers supplied by the harness',
            exclusions: [
              'Account erasure orchestration, anonymization and private data cleanup',
              'Erasure portal',
              'Production ingress, deployment, restore, rollback, load and soak',
            ],
          },
          null,
          2
        )
      );
    } else if (
      process.argv.includes('--account-export-editorial') ||
      process.argv.includes('--account-export-runtime')
    ) {
      const integrated = process.argv.includes('--account-export-runtime');
      const objectPort = start(
        'minio',
        'minio/minio:RELEASE.2025-04-22T22-12-26Z',
        9000,
        { MINIO_ROOT_USER: 'qualification', MINIO_ROOT_PASSWORD: password },
        ['server', '/data']
      );
      const endpoint = `http://127.0.0.1:${objectPort}`;
      await ready(async () => {
        const response = await fetch(endpoint + '/minio/health/ready', {
          signal: AbortSignal.timeout(1000),
        });
        assert.equal(response.status, 200);
      });
      const exportSecret =
        randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
      Object.assign(environment, {
        ACCOUNT_EXPORT_SOURCE_SECRET: exportSecret,
        ACCOUNT_ERASURE_SECRET: 'qualification-erasure-secret-2026-only',
        NOTIFICATION_SERVICE_SECRET:
          'qualification-notification-secret-2026-only',
        EDITORIAL_MEDIA_ENDPOINT: endpoint,
        EDITORIAL_MEDIA_BUCKET: 'export-images',
        EDITORIAL_MEDIA_ACCESS_KEY: 'qualification',
        EDITORIAL_MEDIA_SECRET_KEY: password,
      });
      await require('./account-export-editorial-checks.cjs').qualifyEditorialAccountExport(
        {
          source,
          endpoint,
          password,
          exportSecret,
          restart,
          origin: () => editorial.origin,
          stopPolicy: () => opa.stop(),
          qualifyArchive: integrated
            ? ({ owner }) =>
                require('./account-export-runtime-checks.cjs').qualifyAccountExportRuntime(
                  {
                    root,
                    source,
                    sql,
                    queuePort,
                    mongoPort,
                    endpoint,
                    password,
                    exportSecret,
                    editorialOrigin: () => editorial.origin,
                    restartEditorial: async (configuration = {}) => {
                      Object.assign(environment, configuration);
                      await restart();
                    },
                    secret,
                    opaBinary,
                    owner,
                    pass,
                    browser: !process.argv.includes('--no-browser'),
                    erasure: process.argv.includes(
                      '--account-erasure-coordinator'
                    ),
                    favoriteUpdates:
                      process.argv.includes('--favorite-updates'),
                    mentions: process.argv.includes('--mention-notifications'),
                    explore: process.argv.includes('--explore'),
                    digest: process.argv.includes('--digest'),
                    timeline: process.argv.includes('--timeline'),
                    favoritesContentPreferences: process.argv.includes(
                      '--favorites-content-preferences'
                    ),
                    notifications: process.argv.includes(
                      '--reply-notifications'
                    ),
                    output,
                  }
                )
            : undefined,
          pass,
        }
      );
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            checks,
            node: process.version,
            workflow: process.argv.includes('--favorites-content-preferences')
              ? 'favorites-content-preferences'
              : process.argv.includes('--timeline')
              ? 'application-timeline-digest-and-explore'
              : process.argv.includes('--digest')
              ? 'digest-and-explore'
              : process.argv.includes('--explore')
              ? 'explore'
              : process.argv.includes('--mention-notifications')
              ? 'mention-notifications'
              : process.argv.includes('--favorite-updates')
              ? 'favorite-updates'
              : process.argv.includes('--reply-notifications')
              ? 'reply-notifications'
              : process.argv.includes('--account-erasure-coordinator')
              ? 'account-export-and-complete-erasure'
              : 'account-export',
            stores: integrated
              ? [
                  'mysql:8.4',
                  'mongo:7',
                  'rabbitmq:4-management',
                  'minio/minio:RELEASE.2025-04-22T22-12-26Z',
                  'Firebase Auth emulator',
                ]
              : ['mysql:8.4', 'minio/minio:RELEASE.2025-04-22T22-12-26Z'],
            authority: integrated
              ? 'Canonical Editorial fixtures, real Discussion commands, MySQL, MinIO, Firebase Auth emulator, compiled Account/Editorial/Discussion HTTP and real OPA'
              : 'Canonical SQL fixtures; real source adapter, S3 storage, compiled Editorial HTTP and OPA',
            exclusions: [
              integrated
                ? process.argv.includes('--no-browser')
                  ? 'Portal export and erasure journeys'
                  : 'Deployed ingress authentication; local browser gateway substitutes authenticated identity headers'
                : 'Full Account job/API/portal export',
              'Production credentials and deployment',
              'Database restart/restore/rollback, load and soak',
            ],
          },
          null,
          2
        )
      );
    } else if (
      process.argv.includes('--article-comments') ||
      process.argv.includes('--application-discussions')
    ) {
      assert.ok(queuePort, 'Article comment qualification requires --delivery');
      const objectPort = start(
        'minio',
        'minio/minio:RELEASE.2025-04-22T22-12-26Z',
        9000,
        { MINIO_ROOT_USER: 'qualification', MINIO_ROOT_PASSWORD: password },
        ['server', '/data']
      );
      const endpoint = `http://127.0.0.1:${objectPort}`;
      await ready(async () => {
        const response = await fetch(endpoint + '/minio/health/ready', {
          signal: AbortSignal.timeout(1000),
        });
        assert.equal(response.status, 200);
      });
      await restart();
      const discussionChecks = {
        root,
        sql,
        source,
        mongo,
        mongoPort,
        queuePort,
        password,
        endpoint,
        output,
        editorialOrigin: () => editorial.origin,
        restartEditorial: restart,
        secret,
        opaBinary,
        pass,
        policy: new OpaEditorialPolicy(opaOrigin),
        reader: new MysqlEditorialSnapshotReader(source, 'default'),
        projections: new MongoEditorialProjections(
          mongo.db('suites').collection('editorial_projections_v1')
        ),
      };
      if (process.argv.includes('--application-discussions'))
        await require('./application-discussions-checks.cjs').applicationDiscussionsChecks(
          discussionChecks
        );
      if (process.argv.includes('--article-comments'))
        await require('./article-comments-checks.cjs').articleCommentsChecks(
          discussionChecks
        );
      if (process.argv.includes('--discussion-regression')) {
        const regression = execFileSync(
          process.execPath,
          ['--test', 'tools/readiness/discussion-recovery.test.cjs'],
          {
            cwd: root,
            timeout: 180000,
            encoding: 'utf8',
            env: {
              ...process.env,
              WAPPS_DISCUSSION_INTEGRATION: '1',
              LOCAL_PASSWORD: password,
              DISCUSSION_TEST_MYSQL_PORT: String(sql.port),
              DISCUSSION_TEST_MYSQL_USERNAME: sql.user,
              DISCUSSION_TEST_MONGO_PORT: String(mongoPort),
              DISCUSSION_TEST_QUEUE_PORT: String(queuePort),
              DISCUSSION_TEST_MINIO_PORT: String(objectPort),
              DISCUSSION_TEST_MINIO_USERNAME: 'qualification',
            },
          }
        );
        fs.writeFileSync(
          path.join(output, 'discussion-recovery.log'),
          regression
        );
        pass(
          'existing generic discussion real-store regression: legacy backfill, atomic writes, duplicate/reordered generations, retained deletion, rebuild and reconciliation'
        );
      }
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            workflow: process.argv.includes('--discussion-previews')
              ? 'discussion-previews'
              : process.argv.includes('--member-reviews')
              ? 'member-reviews'
              : process.argv.includes('--discussion-pins')
              ? 'discussion-pins'
              : process.argv.includes('--discussion-votes')
              ? 'discussion-votes'
              : process.argv.includes('--discussion-favorites')
              ? 'discussion-favorites'
              : process.argv.includes('--quick-discussion-browser')
              ? 'quick-discussion-portal'
              : process.argv.includes('--my-discussions')
              ? 'my-discussions'
              : process.argv.includes('--application-discussions')
              ? 'application-discussions'
              : process.argv.includes('--comment-browser')
              ? 'article-comments-portal'
              : 'article-comments-backend',
            checks,
            node: process.version,
            stores: [
              'mysql:8.4',
              'mongo:7',
              'rabbitmq:4-management',
              'minio/minio:RELEASE.2025-04-22T22-12-26Z',
            ],
            authority:
              'Compiled Editorial/Discussion APIs and real OPA; trusted ingress identities are controlled local fixtures',
            exclusions: [
              ...(process.argv.includes('--comment-browser') ||
              process.argv.includes('--topic-browser') ||
              process.argv.includes('--my-discussions-browser') ||
              process.argv.includes('--quick-discussion-browser') ||
              process.argv.includes('--discussion-favorites') ||
              process.argv.includes('--discussion-votes') ||
              process.argv.includes('--discussion-pins') ||
              process.argv.includes('--discussion-previews') ||
              process.argv.includes('--member-reviews')
                ? []
                : ['Portal comments']),
              'Production identity/ingress',
              'Database restore/rollback, load and soak',
            ],
          },
          null,
          2
        )
      );
    } else if (process.argv.includes('--article-covers')) {
      const objectPort = start(
        'minio',
        'minio/minio:RELEASE.2025-04-22T22-12-26Z',
        9000,
        { MINIO_ROOT_USER: 'qualification', MINIO_ROOT_PASSWORD: password },
        ['server', '/data']
      );
      const endpoint = `http://127.0.0.1:${objectPort}`;
      await ready(async () => {
        const response = await fetch(endpoint + '/minio/health/ready', {
          signal: AbortSignal.timeout(1000),
        });
        assert.equal(response.status, 200);
      });
      const objects = {
        endpoint,
        accessKeyId: 'qualification',
        secretAccessKey: password,
      };
      Object.assign(environment, {
        EDITORIAL_MEDIA_ENDPOINT: endpoint,
        EDITORIAL_MEDIA_BUCKET: 'private-article-covers',
        EDITORIAL_MEDIA_ACCESS_KEY: 'qualification',
        EDITORIAL_MEDIA_SECRET_KEY: password,
      });
      await require('./article-cover-upload-checks.cjs').articleCoverUploadChecks(
        {
          root,
          source,
          policy: new OpaEditorialPolicy(opaOrigin),
          pass,
          objects,
          stopPolicy: () => opa.stop(),
          qualifyHttp: async () => {
            await restart();
            await require('./article-cover-publication-checks.cjs').articleCoverPublicationChecks(
              {
                source,
                broker: queuePort
                  ? {
                      port: queuePort,
                      password,
                      collection: mongo
                        .db('suites')
                        .collection('editorial_projections_v1'),
                    }
                  : undefined,
                origin: () => editorial.origin,
                restart,
                secret,
                pass,
                objects,
                policy: new OpaEditorialPolicy(opaOrigin),
                reader: new MysqlEditorialSnapshotReader(source, 'default'),
                projections: new MongoEditorialProjections(
                  mongo.db('suites').collection('editorial_projections_v1')
                ),
              }
            );
            if (process.argv.includes('--cover-browser')) {
              await require('./article-cover-browser.cjs').articleCoverBrowser({
                root,
                source,
                restart,
                output,
                origin: () => editorial.origin,
                reader: new MysqlEditorialSnapshotReader(source, 'default'),
                projections: new MongoEditorialProjections(
                  mongo.db('suites').collection('editorial_projections_v1')
                ),
                headers: (uid, tenantId = 'default', roles = []) => ({
                  'content-type': 'application/json',
                  'x-user-id': uid,
                  'x-user-claims': JSON.stringify({ tenantId, roles }),
                  'x-ingress-auth': secret,
                }),
              });
              pass(
                'compiled cover portal: saved upload/description, reload recovery, independent sessions, frozen review, public reads, conflicts, withdrawal and responsive themes'
              );
            }
          },
        }
      );
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            workflow: process.argv.includes('--cover-browser')
              ? 'article-cover-portal'
              : 'article-cover-backend',
            checks,
            node: process.version,
            stores: [
              ...(queuePort ? ['rabbitmq:4-management'] : []),
              'mysql:8.4',
              'mongo:7',
              'minio/minio:RELEASE.2025-04-22T22-12-26Z',
            ],
            authority:
              'Real OPA and compiled HTTP service; trusted ingress identities supplied by the local harness',
            exclusions: [
              ...(process.argv.includes('--cover-browser')
                ? []
                : ['Portal cover controls']),
              'Article comments',
              'Production identity/ingress',
              ...(queuePort ? [] : ['Broker delivery of cover payloads']),
              'Database restart/restore/rollback, load and soak',
            ],
          },
          null,
          2
        )
      );
    } else if (process.argv.includes('--articles')) {
      const browser = process.argv.includes('--article-browser');
      await restart();
      await require('./article-publication-checks.cjs').articlePublicationChecks(
        {
          source,
          origin: () => editorial.origin,
          secret,
          restart,
          stopPolicy: () => opa.stop(),
          qualifyBrowser: browser
            ? async () => {
                await require('./article-publication-browser.cjs').articlePublicationBrowser(
                  {
                    root,
                    source,
                    sql,
                    restart,
                    output,
                    origin: () => editorial.origin,
                    policy: new OpaEditorialPolicy(opaOrigin),
                    reader: new MysqlEditorialSnapshotReader(source, 'default'),
                    projections: new MongoEditorialProjections(
                      mongo.db('suites').collection('editorial_projections_v1')
                    ),
                    headers: (uid, tenantId = 'default', roles = []) => ({
                      'content-type': 'application/json',
                      'x-user-id': uid,
                      'x-user-claims': JSON.stringify({ tenantId, roles }),
                      'x-ingress-auth': secret,
                    }),
                  }
                );
                pass(
                  'compiled article portal and real account favorites: independent sessions, immutable review, retries, conflicts, pagination, withdrawal, API restart and responsive themes'
                );
              }
            : undefined,
          pass,
          broker: queuePort ? { port: queuePort, password } : null,
          reader: new MysqlEditorialSnapshotReader(source, 'default'),
          projections: new MongoEditorialProjections(
            mongo.db('suites').collection('editorial_projections_v1')
          ),
          collection: mongo.db('suites').collection('editorial_projections_v1'),
        }
      );
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            workflow: browser
              ? 'article-text-publication-portal'
              : 'article-text-publication-backend',
            checks,
            node: process.version,
            stores: [
              'mysql:8.4',
              'mongo:7',
              ...(queuePort ? ['rabbitmq:4-management'] : []),
            ],
            authority:
              'Real OPA and compiled HTTP service; trusted ingress identities supplied by the local harness',
            exclusions: [
              ...(browser
                ? []
                : ['Portal workflow', 'Account favorite commands']),
              'Article covers and comments',
              'Production identity/ingress',
              ...(queuePort ? [] : ['Broker delivery']),
              'Database restart/restore/rollback, load and soak',
            ],
          },
          null,
          2
        )
      );
    } else if (process.argv.includes('--releases')) {
      const browser = process.argv.includes('--release-browser');
      await restart();
      await require('./release-publication-checks.cjs').releasePublicationChecks(
        {
          source,
          policy: new OpaEditorialPolicy(opaOrigin),
          origin: () => editorial.origin,
          secret,
          restart,
          stopPolicy: () => opa.stop(),
          qualifyBrowser: browser
            ? async () => {
                await require('./release-publication-browser.cjs').releasePublicationBrowser(
                  {
                    root,
                    source,
                    restart,
                    output,
                    origin: () => editorial.origin,
                    policy: new OpaEditorialPolicy(opaOrigin),
                    reader: new MysqlEditorialSnapshotReader(source, 'default'),
                    projections: new MongoEditorialProjections(
                      mongo.db('suites').collection('editorial_projections_v1')
                    ),
                    headers: (uid, tenantId = 'default', roles = []) => ({
                      'content-type': 'application/json',
                      'x-user-id': uid,
                      'x-user-claims': JSON.stringify({ tenantId, roles }),
                      'x-ingress-auth': secret,
                    }),
                  }
                );
                pass(
                  'compiled release portal: independent owner/reviewer/public sessions, retries, conflicts, explicit merge, immutable review, withdrawal, pagination, API restart and responsive themes'
                );
              }
            : undefined,
          pass,
          broker: queuePort ? { port: queuePort, password } : null,
          reader: new MysqlEditorialSnapshotReader(source, 'default'),
          projections: new MongoEditorialProjections(
            mongo.db('suites').collection('editorial_projections_v1')
          ),
          collection: mongo.db('suites').collection('editorial_projections_v1'),
        }
      );
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            workflow: browser
              ? 'release-publication-portal'
              : 'release-publication-backend',
            checks,
            node: process.version,
            stores: [
              'mysql:8.4',
              'mongo:7',
              ...(queuePort ? ['rabbitmq:4-management'] : []),
            ],
            authority:
              'Real OPA and compiled HTTP service; trusted ingress identities and successful DNS proof supplied by the local harness',
            exclusions: [
              ...(browser ? [] : ['Portal workflow']),
              'Public DNS and production identity/ingress',
              ...(queuePort ? [] : ['Broker delivery']),
              'Database restart/restore/rollback, load and soak',
            ],
          },
          null,
          2
        )
      );
    } else if (process.argv.includes('--application-media')) {
      const browser = process.argv.includes('--media-browser');
      const retention = process.argv.includes('--media-retention');
      const publication = process.argv.includes('--media-publication');
      const http =
        process.argv.includes('--media-http') ||
        publication ||
        retention ||
        browser;
      const objectPort = start(
        'minio',
        'minio/minio:RELEASE.2025-04-22T22-12-26Z',
        9000,
        {
          MINIO_ROOT_USER: 'qualification',
          MINIO_ROOT_PASSWORD: password,
        },
        ['server', '/data']
      );
      const endpoint = `http://127.0.0.1:${objectPort}`;
      await ready(async () => {
        const response = await fetch(endpoint + '/minio/health/ready', {
          signal: AbortSignal.timeout(1000),
        });
        assert.equal(response.status, 200);
      });
      await require('./application-media-checks.cjs').applicationMediaChecks({
        root,
        source,
        policy: new OpaEditorialPolicy(opaOrigin),
        pass,
        stopPolicy: () => opa.stop(),
        objects: {
          endpoint,
          accessKeyId: 'qualification',
          secretAccessKey: password,
        },
        qualifyHttp: http
          ? async () => {
              Object.assign(environment, {
                EDITORIAL_MEDIA_ENDPOINT: endpoint,
                EDITORIAL_MEDIA_BUCKET: 'private-application-images',
                EDITORIAL_MEDIA_ACCESS_KEY: 'qualification',
                EDITORIAL_MEDIA_SECRET_KEY: password,
              });
              const [migration] = await source.query(
                'SELECT * FROM editorial_migrations WHERE name = ?',
                ['ApplicationImages1791676814000']
              );
              assert.ok(migration);
              await source.query(
                'DELETE FROM editorial_migrations WHERE id = ?',
                [migration.id]
              );
              try {
                await assert.rejects(restart(), /migrations are pending/);
                assert.equal(
                  (
                    await source.query(
                      'SELECT id FROM editorial_migrations WHERE name = ?',
                      [migration.name]
                    )
                  ).length,
                  0
                );
              } finally {
                await source.query(
                  'INSERT INTO editorial_migrations (id, timestamp, name) VALUES (?, ?, ?)',
                  [migration.id, migration.timestamp, migration.name]
                );
              }
              pass(
                'compiled API refuses a pending migration and leaves migration history unchanged until explicit maintenance'
              );
              await restart();
              await require('./application-media-http-checks.cjs').applicationMediaHttpChecks(
                {
                  source,
                  restart,
                  origin: () => editorial.origin,
                  secret,
                  pass,
                }
              );
              if (publication)
                await require('./application-media-publication-checks.cjs').applicationMediaPublicationChecks(
                  {
                    source,
                    restart,
                    origin: () => editorial.origin,
                    secret,
                    pass,
                    configurePublicOrigin: async (origin) => {
                      if (origin === undefined)
                        delete environment.EDITORIAL_MEDIA_PUBLIC_ORIGIN;
                      else environment.EDITORIAL_MEDIA_PUBLIC_ORIGIN = origin;
                      await restart();
                    },
                  }
                );
              if (retention)
                await require('./application-media-retention-checks.cjs').applicationMediaRetentionChecks(
                  {
                    root,
                    source,
                    policy: new OpaEditorialPolicy(opaOrigin),
                    pass,
                    origin: () => editorial.origin,
                    secret,
                    restart,
                    objects: {
                      endpoint,
                      accessKeyId: 'qualification',
                      secretAccessKey: password,
                    },
                    configureCleanup: async (enabled) => {
                      environment.EDITORIAL_MEDIA_CLEANUP_ENABLED =
                        String(enabled);
                      await restart();
                    },
                    maintenance: (args) =>
                      execFileSync(
                        process.execPath,
                        [
                          path.join(
                            root,
                            'dist/apps/services/editorial/main.js'
                          ),
                          ...args,
                        ],
                        {
                          cwd: root,
                          env: environment,
                          encoding: 'utf8',
                          timeout: 60000,
                        }
                      ),
                  }
                );
              if (browser) {
                await require('./application-media-browser.cjs').applicationMediaBrowser(
                  {
                    root,
                    source,
                    output,
                    restart,
                    origin: () => editorial.origin,
                    headers: (uid, tenantId = 'default', roles = []) => ({
                      'content-type': 'application/json',
                      'x-user-id': uid,
                      'x-user-claims': JSON.stringify({ tenantId, roles }),
                      'x-ingress-auth': secret,
                    }),
                    reader: new MysqlEditorialSnapshotReader(source, 'default'),
                    projections: new MongoEditorialProjections(
                      mongo.db('suites').collection('editorial_projections_v1')
                    ),
                    configurePublicOrigin: async (origin) => {
                      environment.EDITORIAL_MEDIA_PUBLIC_ORIGIN = origin;
                      await restart();
                    },
                  }
                );
                pass(
                  'compiled media portal: upload/retry/preview/association/publication/rebase/recovery in independent browser sessions'
                );
              }
            }
          : undefined,
      });
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            workflow: browser
              ? 'application-media-portal'
              : retention
              ? 'application-media-retention'
              : publication
              ? 'application-media-publication'
              : http
              ? 'application-media-http'
              : 'application-media-reservations',
            checks,
            node: process.version,
            stores: [
              'mysql:8.4',
              'minio/minio:RELEASE.2025-04-22T22-12-26Z',
              ...(browser ? ['mongo:7'] : []),
            ],
            authority: 'Real OPA; actors supplied by the qualification harness',
            exclusions: [
              ...(http ? [] : ['HTTP workflow']),
              ...(browser ? [] : ['Portal workflow']),
              ...(publication || browser
                ? [
                    'Ownership grants, suspension and direct URL replacement in media checks use controlled SQL fixtures',
                  ]
                : ['Draft attachment and publication']),
              ...(retention ? [] : ['Retention/cleanup']),
              'Production ingress/session validation',
              ...(http ? [] : ['API process restart']),
              'Database restart, backup, rollback, load and soak',
            ],
          },
          null,
          2
        )
      );
    } else if (process.argv.includes('--application-ownership')) {
      const browser = process.argv.includes('--ownership-browser');
      const http = process.argv.includes('--ownership-http') || browser;
      const reader = new MysqlEditorialSnapshotReader(source, 'default');
      const projections = new MongoEditorialProjections(
        mongo.db('suites').collection('editorial_projections_v1')
      );
      await require('./application-ownership-checks.cjs').applicationOwnershipChecks(
        {
          source,
          policy: new OpaEditorialPolicy(opaOrigin),
          reader,
          projections,
          stopPolicy: () => opa.stop(),
          pass,
          qualifyHttp: http
            ? async ({ dnsServer, records }) => {
                environment.EDITORIAL_OWNERSHIP_DNS_SERVERS = dnsServer;
                await restart();
                const afterPolicyStop =
                  await require('./application-ownership-http-checks.cjs').applicationOwnershipHttpChecks(
                    {
                      source,
                      records,
                      restart,
                      origin: () => editorial.origin,
                      secret,
                      pass,
                    }
                  );
                if (browser) {
                  const browserOutput = path.join(output, 'browser');
                  fs.mkdirSync(browserOutput, { recursive: true });
                  await require('./application-ownership-browser.cjs').applicationOwnershipBrowser(
                    {
                      root,
                      source,
                      reader,
                      projections,
                      records,
                      restart,
                      origin: () => editorial.origin,
                      headers: (uid, tenantId = 'default', roles = []) => ({
                        'content-type': 'application/json',
                        'x-user-id': uid,
                        'x-user-claims': JSON.stringify({ tenantId, roles }),
                        'x-ingress-auth': secret,
                      }),
                      output: browserOutput,
                    }
                  );
                  pass(
                    'compiled ownership and verified-editing portal completes real-service browser workflow, independent sessions, retries, revision conflicts, projection lag, grant changes and responsive layouts'
                  );
                }
                return afterPolicyStop;
              }
            : undefined,
        }
      );
      fs.writeFileSync(
        path.join(output, 'qualification.json'),
        JSON.stringify(
          {
            workflow: browser
              ? 'application-ownership-portal'
              : http
              ? 'application-ownership-http'
              : 'application-ownership-backend',
            checks,
            node: process.version,
            stores: ['mysql:8.4', 'mongo:7'],
            authority:
              'Real OPA; application-boundary actors and trusted ingress identities supplied by the qualification harness',
            proof:
              'Real node:dns/promises resolver against controlled local UDP TXT server',
            exclusions: [
              ...(http ? [] : ['HTTP workflow and process restart']),
              ...(browser ? [] : ['Portal workflow']),
              'Public authoritative DNS deployment',
              'Production identity/ingress, database restart/restore/rollback',
            ],
          },
          null,
          2
        )
      );
    } else {
      await restart();
      const headers = (uid = 'Alice', tenantId = 'default', roles = []) => ({
        'content-type': 'application/json',
        'x-user-id': uid,
        'x-user-claims': JSON.stringify({ tenantId, roles }),
        'x-ingress-auth': secret,
      });
      if (
        process.argv.includes('--application-drafts') ||
        process.argv.includes('--application-publication')
      ) {
        const publishing = process.argv.includes('--application-publication');
        const qualify = publishing
          ? require('./application-publication-checks.cjs')
              .applicationPublicationChecks
          : require('./application-draft-checks.cjs').applicationDraftChecks;
        await qualify({
          root,
          source,
          origin: () => editorial.origin,
          headers,
          restart,
          stopPolicy: () => opa.stop(),
          output,
          pass,
          browser: !process.argv.includes('--no-browser'),
          delivery:
            publishing && queuePort
              ? () =>
                  require('./suite-publication-delivery.cjs').suitePublicationDelivery(
                    {
                      source,
                      reader: new MysqlEditorialSnapshotReader(
                        source,
                        'default'
                      ),
                      projections: new MongoEditorialProjections(
                        mongo
                          .db('suites')
                          .collection('editorial_projections_v1')
                      ),
                      collection: mongo
                        .db('suites')
                        .collection('editorial_projections_v1'),
                      policy: new OpaEditorialPolicy(opaOrigin),
                      port: queuePort,
                      password,
                      kind: 'app',
                      pass,
                    }
                  )
              : null,
          reader: new MysqlEditorialSnapshotReader(source, 'default'),
          projections: new MongoEditorialProjections(
            mongo.db('suites').collection('editorial_projections_v1')
          ),
        });
        fs.writeFileSync(
          path.join(output, 'qualification.json'),
          JSON.stringify(
            {
              workflow: publishing
                ? 'application-publication'
                : 'application-drafts',
              checks,
              node: process.version,
              browser: !process.argv.includes('--no-browser'),
              stores: [
                'mysql:8.4',
                'mongo:7',
                ...(queuePort ? ['rabbitmq:4-management'] : []),
              ],
              authority:
                'Real OPA; trusted ingress identities supplied by local qualification harness',
              exclusions: [
                'Production ingress/session validation',
                'Database restart, backup and rollback',
                ...(publishing
                  ? ['Ownership verification and media']
                  : ['Submission, publication and ownership verification']),
              ],
            },
            null,
            2
          )
        );
      } else {
        const request = async (
          method,
          route,
          body,
          key = randomUUID(),
          uid = 'Alice',
          tenantId = 'default'
        ) => {
          const response = await fetch(
            editorial.origin + '/api/me/suites' + route,
            {
              method,
              headers: { ...headers(uid, tenantId), 'idempotency-key': key },
              ...(body === undefined ? {} : { body: JSON.stringify(body) }),
              signal: AbortSignal.timeout(8000),
            }
          );
          const json = await response.json();
          return { status: response.status, json };
        };
        const actor = {
          identityId: 'catalog-owner',
          tenantId: 'default',
          roles: ['editorial:publisher'],
        };
        const commands = new EditorialCommands(
          new MysqlEditorialWrites(source, 'default'),
          new OpaEditorialPolicy(opaOrigin),
          { generate: randomUUID }
        );
        const reader = new MysqlEditorialSnapshotReader(source, 'default');
        const projections = new MongoEditorialProjections(
          mongo.db('suites').collection('editorial_projections_v1')
        );
        const createTarget = async (name) => {
          const target = await commands.create(
            'app',
            {
              name,
              slug: name.toLowerCase().replaceAll(' ', '-'),
              description: 'A real suite qualification application.',
            },
            actor,
            randomUUID()
          );
          await projections.publish(
            projectEditorialSnapshot(await reader.read('app', target.id))
          );
          return target;
        };
        const first = await createTarget('Suite Alpha');
        const second = await createTarget('Suite Beta');
        const fields = {
          title: 'My work',
          description: 'A private collection',
          applicationIds: [first.id],
        };
        const created = await request('POST', '', fields, 'first');
        assert.equal(created.status, 201);
        const id = created.json.id;
        assert.deepEqual(
          (await request('POST', '', fields, 'first')).json,
          created.json
        );
        assert.equal(
          (await request('POST', '', { ...fields, title: 'Other' }, 'first'))
            .status,
          409
        );
        assert.equal((await request('GET', '')).json.length, 1);
        pass('create and idempotent retry commit once');
        for (const [uid, tenant] of [
          ['Bob', 'default'],
          ['alice', 'default'],
          ['Alice', 'other'],
        ]) {
          assert.deepEqual(
            (await request('GET', '', undefined, undefined, uid, tenant)).json,
            []
          );
          for (const method of ['GET', 'PUT', 'DELETE'])
            assert.equal(
              (
                await request(
                  method,
                  '/' + id,
                  method === 'GET'
                    ? undefined
                    : {
                        ...(method === 'PUT' ? fields : {}),
                        expectedRevision: 1,
                      },
                  undefined,
                  uid,
                  tenant
                )
              ).status,
              404
            );
        }
        assert.equal(
          (await fetch(editorial.origin + '/api/me/suites')).status,
          401
        );
        assert.equal(
          (
            await fetch(editorial.origin + '/api/me/suites', {
              headers: { 'x-user-id': 'Alice' },
            })
          ).status,
          401
        );
        pass(
          'anonymous, forged-header, cross-account, case and tenant isolation'
        );
        const concurrent = await Promise.all(
          ['One', 'Two'].map((title) =>
            request('PUT', '/' + id, { ...fields, title, expectedRevision: 1 })
          )
        );
        assert.deepEqual(
          concurrent.map((item) => item.status).sort(),
          [200, 409]
        );
        const beforeFailure = (await request('GET', '/' + id)).json;
        await source.query(
          "CREATE TRIGGER fail_suite_receipt BEFORE INSERT ON suite_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected suite receipt failure'"
        );
        assert.equal(
          (
            await request(
              'PUT',
              '/' + id,
              { ...fields, title: 'Rollback', expectedRevision: 2 },
              'atomic'
            )
          ).status,
          503
        );
        assert.deepEqual((await request('GET', '/' + id)).json, beforeFailure);
        await source.query('DROP TRIGGER fail_suite_receipt');
        assert.equal(
          (
            await request(
              'PUT',
              '/' + id,
              { ...fields, title: 'Recovered', expectedRevision: 2 },
              'atomic'
            )
          ).status,
          200
        );
        pass(
          'concurrent edits conflict and receipt failure rolls back the entire mutation'
        );
        await commands.remove(
          'app',
          first.id,
          { expectedRevision: 1 },
          actor,
          randomUUID()
        );
        assert.equal((await request('POST', '', fields)).status, 400);
        assert.equal(
          (
            await request('PUT', '/' + id, {
              ...fields,
              title: 'Still editable',
              expectedRevision: 3,
            })
          ).status,
          200
        );
        assert.equal(
          (
            await request('PUT', '/' + id, {
              ...fields,
              applicationIds: [second.id],
              expectedRevision: 4,
            })
          ).status,
          200
        );
        pass(
          'deleted targets cannot be newly added but existing references remain editable and removable'
        );
        await restart();
        assert.equal((await request('GET', '/' + id)).json.revision, 5);
        const deletion = await request(
          'DELETE',
          '/' + id,
          { expectedRevision: 5 },
          'delete'
        );
        assert.equal(deletion.status, 200);
        assert.deepEqual(
          (await request('DELETE', '/' + id, { expectedRevision: 5 }, 'delete'))
            .json,
          deletion.json
        );
        assert.deepEqual(
          (await request('POST', '', fields, 'first')).json,
          created.json
        );
        assert.equal((await request('GET', '/' + id)).status, 404);
        assert.deepEqual((await request('GET', '')).json, []);
        const [tombstone] = await source.query(
          'SELECT title, applicationIds, revision, deletedAt FROM private_suites WHERE id = ?',
          [id]
        );
        assert.equal(Number(tombstone.revision), 6);
        assert.ok(tombstone.deletedAt);
        assert.equal(tombstone.title, '');
        pass(
          'process restart persistence, retained tombstone and old retry cannot resurrect deletion'
        );
        const workspace = new SuiteWorkspace(
          new MysqlSuiteWorkspace(source, 'default'),
          new OpaEditorialPolicy(opaOrigin),
          { generate: randomUUID }
        );
        const capacity = {
          identityId: 'Capacity',
          tenantId: 'default',
          roles: [],
        };
        for (let i = 0; i < 99; i++)
          await workspace.change(
            capacity,
            'create',
            null,
            { ...fields, applicationIds: [second.id] },
            randomUUID()
          );
        const last = await Promise.allSettled(
          [1, 2].map(() =>
            workspace.change(
              capacity,
              'create',
              null,
              { ...fields, applicationIds: [second.id] },
              randomUUID()
            )
          )
        );
        assert.equal(
          last.filter((item) => item.status === 'fulfilled').length,
          1
        );
        assert.equal((await workspace.list(capacity)).length, 100);
        const runner = source.createQueryRunner();
        try {
          await new SuiteWorkspace1791676808000().up(runner);
        } finally {
          await runner.release();
        }
        pass(
          'owner capacity is serialized and the additive migration preserves existing data'
        );
        await require('./suite-publication-checks.cjs').suitePublicationChecks({
          origin: () => editorial.origin,
          headers,
          source,
          reader,
          projections,
          restart,
          applicationId: second.id,
          pass,
        });
        if (queuePort)
          await require('./suite-publication-delivery.cjs').suitePublicationDelivery(
            {
              source,
              reader,
              projections,
              collection: mongo
                .db('suites')
                .collection('editorial_projections_v1'),
              policy: new OpaEditorialPolicy(opaOrigin),
              port: queuePort,
              password,
              applicationId: second.id,
              pass,
            }
          );
        if (process.argv.includes('--favorites'))
          await require('./account-favorites-journey.cjs').accountFavoritesJourney(
            {
              root,
              sql,
              editorialOrigin: editorial.origin,
              catalogOrigin: editorial.origin,
              createTarget,
              renameTarget: (id, slug) =>
                commands.update(
                  'app',
                  id,
                  { slug, expectedRevision: 1 },
                  actor,
                  randomUUID()
                ),
              deleteTarget: (id, revision) =>
                commands.remove(
                  'app',
                  id,
                  { expectedRevision: revision },
                  actor,
                  randomUUID()
                ),
              publishTarget: async (id) =>
                projections.publish(
                  projectEditorialSnapshot(await reader.read('app', id))
                ),
              hiddenTarget: randomUUID(),
              browser: !process.argv.includes('--no-browser'),
              output: path.join(output, 'favorites-browser'),
              suiteQualification: (account) =>
                require('./suite-favorites-checks.cjs').suiteFavoritesChecks({
                  ...account,
                  editorialOrigin: () => editorial.origin,
                  editorialHeaders: headers,
                  applicationId: second.id,
                  reader,
                  projections,
                  pass,
                }),
            }
          );
        if (!process.argv.includes('--no-browser'))
          await require('./suite-workspace-browser.cjs').suiteWorkspaceBrowser({
            root,
            origin: () => editorial.origin,
            headers,
            restart,
            source,
            createTarget,
            projectSuite: async (id) =>
              projections.publish(
                projectEditorialSnapshot(await reader.read('suite', id))
              ),
            output,
          });
        await opa.stop();
        opa = undefined;
        const count = (
          await source.query('SELECT COUNT(*) AS total FROM private_suites')
        )[0].total;
        assert.equal(
          (
            await request('POST', '', {
              ...fields,
              applicationIds: [second.id],
            })
          ).status,
          503
        );
        assert.equal(
          (
            await source.query('SELECT COUNT(*) AS total FROM private_suites')
          )[0].total,
          count
        );
        pass('policy outage denies new writes');
        fs.writeFileSync(
          path.join(output, 'qualification.json'),
          JSON.stringify(
            {
              checks,
              browser: !process.argv.includes('--no-browser'),
              node: process.version,
              stores: ['mysql:8.4', 'mongo:7'],
              authority:
                'Real OPA; trusted ingress identities supplied by local qualification harness',
              exclusions: [
                'Production ingress/session validation',
                'Database restart, backup and rollback',
              ],
            },
            null,
            2
          )
        );
      }
    }
  } catch (error) {
    failure = error;
    failed = true;
  } finally {
    const cleanup = await Promise.allSettled([
      editorial?.stop(),
      opa?.stop(),
      source?.isInitialized ? source.destroy() : undefined,
      mongo?.close(),
    ]);
    const failures = cleanup.filter((item) => item.status === 'rejected');
    for (const container of containers.reverse()) {
      try {
        execFileSync('docker', ['rm', '-f', '-v', container], {
          stdio: 'pipe',
          timeout: 20000,
        });
      } catch (error) {
        failures.push(error);
      }
    }
    cleanupFailures.push(...failures);
  }
  if (failed || cleanupFailures.length)
    throw new AggregateError(
      [...(failed ? [failure] : []), ...cleanupFailures],
      'Suite qualification failed'
    );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
