/* Built Editorial -> built BFF -> real SQL/Mongo, using disposable qualification stores. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { catalogPortalBrowser } = require('./catalog-portal-browser.cjs');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');
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
const load = (name) =>
  require(path.join(root, 'apps/services/editorial/src/app', name));
const { EditorialCommands } = load('application/editorial-commands');
const { EditorialCatalog } = load('application/editorial-catalog');
const { MysqlCatalogAuthority } = load(
  'infrastructure/mysql-catalog-authority'
);
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
const { ContentClassification1791886000000 } = load(
  'content-classification/content-classification.migration'
);
const { EditorialContentUpdates1791840017000 } = load(
  'infrastructure/content-update-cursors.migration'
);

async function startService(project, environment) {
  const child = spawn(
    process.execPath,
    [path.join(root, 'dist/apps/services', project, 'main.js')],
    {
      cwd: root,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  let diagnostic = '';
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) => {
      diagnostic = (diagnostic + chunk).slice(-4000);
    });
  let spawnFailure;
  child.on('error', (error) => {
    spawnFailure = error;
  });
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null || spawnFailure)
      return;
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const deadline = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {
      await exited;
    } finally {
      clearTimeout(deadline);
    }
  };
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (spawnFailure || child.exitCode !== null || child.signalCode !== null)
        throw new Error(`${project} exited during startup: ${diagnostic}`);
      try {
        const match = diagnostic.match(/is running on: (http:\/\/[^\s]+)\/api/);
        if (!match) {
          await delay(100);
          continue;
        }
        const origin = match[1];
        const response = await fetch(`${origin}/api/health`, {
          signal: AbortSignal.timeout(500),
        });
        await response.arrayBuffer();
        if (response.ok) return { stop, origin };
      } catch {
        /* Wait for the actual HTTP listener, with a bounded startup deadline. */
      }
      await delay(100);
    }
    throw new Error(`${project} startup timed out: ${diagnostic}`);
  } catch (error) {
    await stop();
    throw error;
  }
}

test(
  'built catalog services expose current public revisions and recover across process restarts',
  { timeout: process.env.WAPPS_CATALOG_BROWSER === '1' ? 240_000 : 90_000 },
  async () => {
    assert.equal(
      process.env.WAPPS_CATALOG_INTEGRATION,
      '1',
      'Requires isolated MySQL, MongoDB and RabbitMQ; never report unavailable dependencies as a pass.'
    );
    const database = `catalog_${randomUUID().replaceAll('-', '')}`;
    const sql = {
      host: '127.0.0.1',
      port: Number(process.env.EDITORIAL_TEST_MYSQL_PORT),
      user: process.env.EDITORIAL_TEST_MYSQL_USERNAME,
      password: process.env.EDITORIAL_TEST_MYSQL_PASSWORD,
    };
    const admin = await createConnection(sql);
    const mongo = new MongoClient(
      `mongodb://${encodeURIComponent(
        process.env.EDITORIAL_TEST_MONGO_USERNAME
      )}:${encodeURIComponent(
        process.env.EDITORIAL_TEST_MONGO_PASSWORD
      )}@127.0.0.1:${process.env.EDITORIAL_TEST_MONGO_PORT}/?authSource=admin`,
      { serverSelectionTimeoutMS: 3000 }
    );
    let source;
    let sqlCreated = false;
    let mongoCreated = false;
    let stopEditorial;
    let stopBff;
    let portal;
    const cleanupErrors = [];
    let failure;
    let failed = false;
    try {
      await admin.query(
        `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
      );
      sqlCreated = true;
      source = await new DataSource({
        type: 'mysql',
        host: sql.host,
        port: sql.port,
        username: sql.user,
        password: sql.password,
        database,
        synchronize: false,
        migrations: [
          EditorialOwnership1791676802000,
          EditorialBackfill1791676803000,
          IdentityWriteBarrier1791840000000,
          AccountErasureRequests1791840001000,
          SuiteWorkspace1791676808000,
          SuitePublication1791676809000,
          ApplicationDrafts1791676810000,
          ApplicationPublication1791676811000,
          ApplicationOwnership1791676812000,
          ApplicationEditing1791676813000,
          ApplicationImages1791676814000,
          ApplicationImageBindings1791676815000,
          ApplicationImageCleanup1791676816000,
          ContentClassification1791886000000,
          EditorialContentUpdates1791840017000,
        ],
        migrationsRun: true,
        migrationsTransactionMode: 'none',
        migrationsTableName: 'editorial_migrations',
      }).initialize();
      await mongo.connect();
      mongoCreated = true;
      const collection = mongo
        .db(database)
        .collection('editorial_projections_v1');
      const projections = new MongoEditorialProjections(collection);
      const reader = new MysqlEditorialSnapshotReader(source, 'default');
      const commands = new EditorialCommands(
        new MysqlEditorialWrites(source, 'default'),
        { evaluate: async () => ({ ok: true, value: true }) },
        { generate: randomUUID },
        () => Date.parse('2026-10-25T01:30:00.123Z')
      );
      const actor = {
        identityId: 'qualification-owner',
        tenantId: 'default',
        roles: ['editorial:publisher', 'editorial:taxonomy'],
      };
      const create = async (kind, values, scope = actor) => {
        const created = await commands.create(
          kind,
          values,
          scope,
          randomUUID()
        );
        // This catalog fixture is General; author/staff classification is qualified separately.
        if (kind === 'app')
          await source.query(
            "UPDATE app_records SET classification='general' WHERE id=?",
            [created.id]
          );
        return created;
      };
      const rootCategory = await create('category', {
        name: 'Tools',
        slug: 'tools',
      });
      const childCategory = await create('category', {
        name: 'Editors',
        slug: 'editors',
        parentId: rootCategory.id,
      });
      const free = await create('tag', { name: 'Free', slug: 'free' });
      const open = await create('tag', {
        name: 'Open source',
        slug: 'open-source',
      });
      const platform = randomUUID();
      const device = randomUUID();
      const monetization = randomUUID();
      await source.query(
        'INSERT INTO platforms(id, name, slug) VALUES (?, ?, ?)',
        [platform, 'Browser', 'web']
      );
      await source.query(
        'INSERT INTO devices(id, name, slug) VALUES (?, ?, ?)',
        [device, 'Desktop', 'desktop']
      );
      await source.query(
        'INSERT INTO monetization_models(id, name, slug) VALUES (?, ?, ?)',
        [monetization, 'Free', 'free']
      );
      const app = await create('app', {
        name: 'Alpha 50%_!',
        slug: 'alpha',
        description: 'Fast editor',
        categoryId: childCategory.id,
        tagIds: [free.id, open.id],
        platformIds: [platform],
        deviceIds: [device],
        monetizationModelIds: [monetization],
      });
      const other = await create('app', {
        name: 'Beta',
        slug: 'beta',
        description: 'Editor for writing',
        categoryId: rootCategory.id,
        tagIds: [free.id],
      });
      const privateApp = await create(
        'app',
        { name: 'Private', slug: 'private' },
        { ...actor, tenantId: 'private' }
      );
      const suspended = await create('app', {
        name: 'Suspended',
        slug: 'suspended',
      });
      // Moderation commands remain a separate release gap; seed this visibility fixture explicitly.
      await source.query(
        'UPDATE app_records SET isSuspended = 1 WHERE id = ?',
        [suspended.id]
      );
      const publish = async (id) =>
        projections.publish(
          projectEditorialSnapshot(await reader.read('app', id))
        );
      for (const value of [other, privateApp, suspended])
        await publish(value.id);
      let bffUrl;
      let editorialUrl;
      const editorialEnvironment = {
        NODE_ENV: 'test',
        EDITORIAL_PORT: '0',
        EDITORIAL_HOST: '127.0.0.1',
        EDITORIAL_SEED_DEMO_DATA: 'false',
        EDITORIAL_PUBLIC_TENANT: 'default',
        EDITORIAL_DATABASE_HOST: sql.host,
        EDITORIAL_DATABASE_PORT: String(sql.port),
        EDITORIAL_DATABASE_USERNAME: sql.user,
        EDITORIAL_DATABASE_PASSWORD: sql.password,
        EDITORIAL_DATABASE_NAME: database,
        MONGO_HOST: '127.0.0.1',
        MONGO_PORT: process.env.EDITORIAL_TEST_MONGO_PORT,
        MONGO_USERNAME: process.env.EDITORIAL_TEST_MONGO_USERNAME,
        MONGO_PASSWORD: process.env.EDITORIAL_TEST_MONGO_PASSWORD,
        MONGO_DATABASE: database,
        QUEUE_HOST: '127.0.0.1',
        QUEUE_PORT: process.env.EDITORIAL_TEST_QUEUE_PORT,
        QUEUE_USERNAME: process.env.EDITORIAL_TEST_QUEUE_USERNAME,
        QUEUE_PASSWORD: process.env.EDITORIAL_TEST_QUEUE_PASSWORD,
        INGRESS_AUTH_SECRET: randomUUID(),
        ACCOUNT_EXPORT_SOURCE_SECRET: randomUUID(),
        ACCOUNT_ERASURE_SECRET: randomUUID(),
        NOTIFICATION_SERVICE_SECRET:
          'qualification-notification-secret-2026-only',
      };
      // Apply the compiled service's full migration list before qualifying its startup contract.
      await promisify(execFile)(
        process.execPath,
        [path.join(root, 'dist/apps/services/editorial/main.js'), '--migrate'],
        {
          cwd: root,
          env: { ...process.env, ...editorialEnvironment },
          timeout: 30_000,
        }
      );
      async function startPair() {
        const editorial = await startService('editorial', editorialEnvironment);
        editorialUrl = editorial.origin;
        stopEditorial = editorial.stop;
        const bff = await startService('catalog-bff', {
          NODE_ENV: 'test',
          PORT: '0',
          HOST: '127.0.0.1',
          EDITORIAL_URL: editorial.origin,
        });
        stopBff = bff.stop;
        bffUrl = bff.origin;
      }
      await startPair();
      const request = (path) =>
        fetch(`${bffUrl}/api/catalog/${path}`, {
          signal: AbortSignal.timeout(20_000),
        });
      const page = async (query = '') => {
        const response = await request(`apps${query}`);
        assert.equal(response.status, 200, await response.clone().text());
        assert.match(response.headers.get('content-type'), /application\/json/);
        return response.json();
      };
      const selectionPath = (ids) => `app-selection?ids=${ids.join(',')}`;
      const selection = async (ids) => {
        const response = await request(selectionPath(ids));
        assert.equal(response.status, 200, await response.clone().text());
        assert.equal(response.headers.get('cache-control'), 'no-store');
        return response.json();
      };
      assert.equal(
        (await request('apps/alpha')).status,
        503,
        'Unmaterialized committed data must be retryable'
      );
      assert.equal(
        (await request('apps')).status,
        503,
        'A missing projected item must not shrink a successful page'
      );
      assert.equal(
        (await request(selectionPath([other.id, app.id]))).status,
        503,
        'One pending visible projection must fail the whole selection'
      );
      assert.deepEqual(
        (await selection([privateApp.id, suspended.id, randomUUID()])).items,
        [],
        'Private, suspended and absent IDs disclose no projected metadata'
      );
      await publish(app.id);
      assert.deepEqual(
        (
          await selection([other.id, privateApp.id, app.id, other.id])
        ).items.map((item) => item.id),
        [other.id, app.id],
        'Canonical selections preserve requested order and deduplicate IDs'
      );
      assert.deepEqual(
        (
          await selection([
            app.id,
            ...Array.from({ length: 49 }, () => randomUUID()),
          ])
        ).items.map((item) => item.id),
        [app.id],
        'The maximum permitted selection is bounded and complete'
      );
      for (const query of [
        '',
        'ids=alpha',
        `ids=${app.id}%0A`,
        `ids=${app.id}&tenantId=private`,
        `ids=${app.id}&ids=${other.id}`,
        `ids=${new Array(51).fill(app.id).join(',')}`,
      ]) {
        for (const origin of [bffUrl, editorialUrl]) {
          const response = await fetch(
            `${origin}/api/catalog/app-selection?${query}`,
            { signal: AbortSignal.timeout(20_000) }
          );
          assert.equal(
            response.status,
            400,
            'Both HTTP boundaries validate the selection'
          );
          await response.arrayBuffer();
        }
      }
      let result = await page();
      assert.deepEqual(
        result.items.map((value) => value.id),
        [app.id, other.id]
      );
      assert.equal(result.items[0].reviews, null);
      assert.equal(
        result.items[0].createdAt,
        '2026-10-25T01:30:00.123Z',
        'Timestamp encoding is UTC even around timezone/DST transitions'
      );
      assert.deepEqual(
        result.items[0].categories.map((value) => value.slug),
        ['editors', 'tools']
      );
      assert.equal(result.total, 2);
      assert.equal(
        (
          await page(
            '?category=tools&tags=free,open-source&platform=web&device=desktop&monetization=free'
          )
        ).total,
        1
      );
      assert.equal((await page('?tags=free,unknown')).total, 0);
      assert.equal((await page('?category=unknown')).total, 0);
      assert.equal(
        (await page('?search=ALPHA%20EDITOR')).total,
        1,
        'Search words must be case-insensitive and conjunctive'
      );
      assert.equal(
        (await page('?search=50%25_%21')).total,
        1,
        'LIKE wildcards must be literal'
      );
      result = await page('?page=99&pageSize=1&sort=name-desc');
      assert.equal(result.page, 2);
      assert.equal(result.items[0].slug, 'alpha');
      for (const slug of ['private', 'suspended', 'absent'])
        assert.equal((await request(`apps/${slug}`)).status, 404);
      for (const query of ['page=1bad', 'pageSize=101', 'tenantId=private'])
        assert.equal((await request(`apps?${query}`)).status, 400);
      console.log(
        'Catalog filters, literal search, canonical IDs, pagination, scope and projection-lag HTTP states pass.'
      );

      if (process.env.WAPPS_CATALOG_BROWSER === '1') {
        const paginationApps = [];
        for (const name of ['Gamma', 'Delta']) {
          const extra = await create('app', { name, slug: name.toLowerCase() });
          paginationApps.push(extra);
          await publish(extra.id);
        }
        portal = await catalogPortalBrowser({
          root,
          bffOrigin: () => bffUrl,
          output:
            process.env.WAPPS_CATALOG_BROWSER_OUTPUT ??
            '/tmp/wapps-readiness/catalog-browser',
        });
        await portal.qualifyLayouts();
        for (const extra of paginationApps) {
          await commands.remove(
            'app',
            extra.id,
            { expectedRevision: 1 },
            actor,
            randomUUID()
          );
        }
        console.log(
          'Real catalog browser listing/filter/directory/detail journeys pass in both themes at 390, 768 and 1440 pixels.'
        );
      }

      await commands.update(
        'tag',
        free.id,
        { name: 'Gratis', expectedRevision: 1 },
        actor,
        randomUUID()
      );
      assert.equal(
        (await page()).items[0].tags.find((value) => value.id === free.id).name,
        'Gratis',
        'Taxonomy labels use current SQL metadata'
      );
      await commands.update(
        'app',
        app.id,
        { name: 'Changed', expectedRevision: 1 },
        actor,
        randomUUID()
      );
      assert.equal(
        (await request('apps/alpha')).status,
        503,
        'Old projection cannot impersonate the current revision'
      );
      assert.equal(
        (await request(selectionPath([app.id, other.id]))).status,
        503
      );
      await portal?.detailState('Unable to load application');
      await portal?.previewState(
        'Changed',
        'Discover is temporarily unavailable'
      );
      // Restore the controlled General fixture after the privileged edit invalidates classification.
      await source.query(
        "UPDATE app_records SET classification='general' WHERE id=?",
        [app.id]
      );
      await publish(app.id);
      await portal?.detailState('Changed');
      await portal?.previewState('Changed', 'Changed');
      assert.equal(
        (await (await request('apps/alpha')).json()).name,
        'Changed'
      );
      await stopBff();
      stopBff = undefined;
      await stopEditorial();
      stopEditorial = undefined;
      await startPair();
      assert.equal(
        (await (await request('apps/alpha')).json()).revision,
        2,
        'Service restarts preserve committed content'
      );
      assert.equal((await selection([app.id])).items[0].revision, 2);
      await portal?.detailState('Changed');
      await collection.deleteMany({});
      await portal?.detailState('Unable to load application');
      await portal?.previewState(
        'Changed',
        'Discover is temporarily unavailable'
      );
      assert.equal(
        (await request('apps/alpha')).status,
        503,
        'Projection loss cannot produce fixture fallback'
      );
      assert.equal((await request(selectionPath([app.id]))).status, 503);
      for (const value of [app, other]) await publish(value.id);
      assert.equal(
        (await page()).total,
        2,
        'Read recovery uses authoritative snapshots without old Mongo data'
      );
      assert.equal((await selection([app.id])).items[0].revision, 2);
      await portal?.detailState('Changed');
      await commands.remove(
        'app',
        app.id,
        { expectedRevision: 2 },
        actor,
        randomUUID()
      );
      assert.equal(
        (await request('apps/alpha')).status,
        404,
        'Deletion hides content before projection catches up'
      );
      assert.equal((await page()).total, 1);
      assert.deepEqual(
        (await selection([app.id, other.id])).items.map((item) => item.id),
        [other.id],
        'A retained projection cannot expose a deleted target'
      );
      await portal?.detailState('Application not found');
      await portal?.previewState('Changed', 'No results');

      await commands.update(
        'app',
        other.id,
        { slug: 'renamed-beta', expectedRevision: 1 },
        actor,
        randomUUID()
      );
      assert.equal((await request(selectionPath([other.id]))).status, 503);
      await publish(other.id);
      const replacement = await create('app', {
        name: 'Replacement',
        slug: 'beta',
      });
      await publish(replacement.id);
      const renamed = (await selection([other.id])).items[0];
      assert.equal(renamed.slug, 'renamed-beta');
      assert.equal(renamed.revision, 2);
      assert.notEqual(
        renamed.id,
        replacement.id,
        'Reusing a slug must never redirect a saved canonical relation'
      );
      assert.equal(
        (await (await request('apps/beta')).json()).id,
        replacement.id
      );

      const racingCatalog = new EditorialCatalog(
        new MysqlCatalogAuthority(source, 'default'),
        {
          find: async (kind, id) => {
            const projection = await projections.find(kind, id);
            await commands.remove(
              'app',
              replacement.id,
              { expectedRevision: 1 },
              actor,
              randomUUID()
            );
            return projection;
          },
        }
      );
      await assert.rejects(
        () => racingCatalog.select([replacement.id]),
        /Catalog changed during reading/,
        'A delete committed during Mongo I/O must invalidate the whole response'
      );
      assert.deepEqual(await selection([replacement.id]), { items: [] });

      if (process.env.WAPPS_FAVORITES_INTEGRATION === '1') {
        await require('./account-favorites-journey.cjs').accountFavoritesJourney(
          {
            root,
            sql,
            editorialOrigin: editorialUrl,
            catalogOrigin: bffUrl,
            hiddenTarget: privateApp.id,
            createTarget: (slug) => create('app', { name: slug, slug }),
            renameTarget: (id, slug) =>
              commands.update(
                'app',
                id,
                { slug, expectedRevision: 1 },
                actor,
                randomUUID()
              ),
            deleteTarget: (id, expectedRevision) =>
              commands.remove(
                'app',
                id,
                { expectedRevision },
                actor,
                randomUUID()
              ),
            publishTarget: publish,
          }
        );
      }

      await stopEditorial();
      stopEditorial = undefined;
      assert.equal(
        (await request('apps')).status,
        503,
        'Upstream outage cannot return an empty catalog'
      );
      assert.equal(
        (await request(selectionPath([other.id]))).status,
        503,
        'An upstream outage is not authoritative absence'
      );
      await portal?.unavailableCatalog();
      await portal?.previewState('Beta', 'Discover is temporarily unavailable');
      console.log(
        'Catalog edits, canonical ID selections, slug rename/reuse, live taxonomy, deletion, service restarts, projection loss/rebuild and upstream outage pass.'
      );
    } catch (error) {
      failed = true;
      failure = error;
    } finally {
      for (const cleanup of [
        async () => portal?.stop(),
        async () => stopBff?.(),
        async () => stopEditorial?.(),
        async () => {
          if (mongoCreated) await mongo.db(database).dropDatabase();
        },
        async () => mongo.close(),
        async () => {
          if (source?.isInitialized) await source.destroy();
        },
        async () => {
          if (sqlCreated) await admin.query(`DROP DATABASE \`${database}\``);
        },
        async () => admin.end(),
      ]) {
        try {
          await cleanup();
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
    }
    if (cleanupErrors.length)
      throw new AggregateError(
        [...(failed ? [failure] : []), ...cleanupErrors],
        'Catalog qualification cleanup failed'
      );
    if (failed) throw failure;
  }
);
