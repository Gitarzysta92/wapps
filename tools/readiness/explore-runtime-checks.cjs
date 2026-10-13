const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { createPool } = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const { processService } = require('./qualification-process.cjs');
const { MinioClient } = require('../../sdk/extras/minio/src');
const editorial = '../../apps/services/editorial/src/app/';
const { MysqlEditorialSnapshotReader } = require(editorial +
  'infrastructure/mysql-editorial-snapshot');
const { MongoEditorialProjections } = require(editorial +
  'infrastructure/mongo-editorial-projections');
const { projectEditorialSnapshot } = require(editorial +
  'application/editorial-materialization');
const materializer =
  '../../sdk/features/discussion/applications/materializer/service/src/';
const { MysqlDiscussionSnapshotReader } = require(materializer +
  'mysql-snapshot-reader');
const { MinioImmutablePayloadReader } = require(materializer +
  'immutable-payload-reader');
const { MongoGenerationStore } = require(materializer +
  'mongo-generation-store');
const { materializeDiscussion } = require(materializer + 'materialization');

module.exports = async function qualifyExplore(options) {
  const {
    root,
    editorialSource,
    discussionEnv,
    discussionOrigin,
    editorialOrigin,
    headers,
    owner,
    pass,
  } = options;
  const pool = createPool({
    host: discussionEnv.MYSQL_HOST,
    port: Number(discussionEnv.MYSQL_PORT),
    user: discussionEnv.MYSQL_USERNAME,
    password: discussionEnv.MYSQL_PASSWORD,
    database: discussionEnv.MYSQL_DATABASE,
  });
  const mongo = new MongoClient(
    `mongodb://127.0.0.1:${discussionEnv.MONGO_PORT}`,
    {
      auth: {
        username: discussionEnv.MONGO_USERNAME,
        password: discussionEnv.MONGO_PASSWORD,
      },
    }
  );
  let bff;
  const accepted = async (response, status = 200) => {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return body;
  };
  const call = (origin, route, uid = owner, method = 'GET', body) =>
    fetch(origin() + '/api/' + route, {
      method,
      headers: { ...headers(uid), 'idempotency-key': randomUUID() },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
  const restartBff = async (secret = discussionEnv.EXPLORE_SERVICE_SECRET) => {
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
          EDITORIAL_URL: editorialOrigin(),
          DISCUSSION_URL: discussionOrigin(),
          EXPLORE_SERVICE_SECRET: secret,
        },
      },
      (log) =>
        log.match(/Catalog BFF is running on: (http:\/\/[^\s]+)\/api/)?.[1],
      '/api/health'
    );
  };
  const feed = (after) =>
    fetch(
      bff.origin +
        '/api/explore' +
        (after ? '?after=' + encodeURIComponent(after) : ''),
      { signal: AbortSignal.timeout(20000) }
    );
  const digest = () =>
    fetch(bff.origin + '/api/digest', { signal: AbortSignal.timeout(20000) });
  let timeline;
  async function pages() {
    const items = [],
      cursors = [];
    let after = null;
    for (let page = 0; page < 30; page++) {
      const response = await feed(after);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const value = await accepted(response);
      assert.ok(value.items.length <= 10);
      assert.deepEqual(Object.keys(value).sort(), ['after', 'items']);
      items.push(...value.items);
      cursors.push(value.after);
      if (!value.after) {
        assert.equal(
          new Set(items.map((i) => i.kind + ':' + i.id)).size,
          items.length
        );
        return { items, cursors };
      }
      assert.notEqual(value.after, after);
      after = value.after;
    }
    throw new Error('Explore fixture paging exceeded bounds');
  }
  try {
    await mongo.connect();
    const snapshots = new MysqlEditorialSnapshotReader(
      editorialSource,
      'default'
    );
    const projections = new MongoEditorialProjections(
      mongo.db('suites').collection('editorial_projections_v1')
    );
    const resources = await editorialSource.query(
      "SELECT resourceKind,resourceId FROM editorial_resource_states WHERE tenantId='default' AND deletedAt IS NULL AND resourceKind IN ('app','suite','article','release')"
    );
    for (const row of resources)
      await projections.publish(
        projectEditorialSnapshot(
          await snapshots.read(row.resourceKind, row.resourceId)
        )
      );
    const [application] = await editorialSource.query(
      'SELECT id,slug FROM app_records WHERE slug=?',
      ['export-application']
    );
    assert.ok(application);
    const store = new MongoGenerationStore(
      mongo.db('export_discussion').collection('discussion_generation_nodes'),
      mongo.db('export_discussion').collection('discussion_generation_heads')
    );
    await store.ensureIndexes();
    const payloads = new MinioImmutablePayloadReader(
      new MinioClient({
        host: discussionEnv.DISCUSSION_STORAGE_HOST,
        accessKey: discussionEnv.DISCUSSION_STORAGE_ACCESSKEY,
        secretKey: discussionEnv.DISCUSSION_STORAGE_SECRETKEY,
      })
    );
    const project = (id) =>
      materializeDiscussion(
        id,
        new MysqlDiscussionSnapshotReader(pool),
        payloads,
        store
      );
    const topics = [];
    for (let i = 0; i < 12; i++)
      topics.push(
        await accepted(
          await call(
            discussionOrigin,
            `application-discussions/${application.id}`,
            owner,
            'POST',
            {
              title: 'Explore topic ' + i,
              tags: ['community'],
              displayName: 'Explore member',
              text: 'A current public discussion for the Explore feed.',
            }
          ),
          201
        )
      );
    const review = await accepted(
      await call(
        discussionOrigin,
        `application-reviews/${application.id}/mine`,
        owner,
        'PUT',
        {
          expectedRevision: 0,
          content: {
            displayName: 'Explore reviewer',
            rating: 4,
            text: 'A real public review in the activity feed.',
          },
        }
      )
    );
    await restartBff();
    assert.equal(
      (await feed()).status,
      503,
      'Unmaterialized content must be unavailable'
    );
    if (options.timeline)
      assert.equal(
        (
          await fetch(
            bff.origin + '/api/applications/export-application/timeline'
          )
        ).status,
        503
      );
    if (options.digest) assert.equal((await digest()).status, 503);
    for (const topic of topics) await project(topic.id);
    const legacy = randomUUID();
    await editorialSource.query(
      'INSERT INTO app_records (id,name,slug) VALUES (?,?,?)',
      [legacy, 'Unverified legacy application', 'explore-legacy-' + legacy]
    );
    try {
      assert.equal(
        (await feed()).status,
        503,
        'An eligible legacy application without a canonical revision must fail closed'
      );
      if (options.digest) assert.equal((await digest()).status, 503);
    } finally {
      await editorialSource.query('DELETE FROM app_records WHERE id=?', [
        legacy,
      ]);
    }
    const initial = await pages();
    for (const kind of [
      'application',
      'suite',
      'article',
      'release',
      'discussion',
      'review',
    ])
      assert.ok(
        initial.items.some((item) => item.kind === kind),
        'Missing Explore kind: ' + kind
      );
    assert.ok(initial.items.some((item) => item.id === review.id));
    assert.equal(
      initial.items.filter((item) => item.kind === 'discussion').length,
      topics.length
    );
    assert.equal(
      JSON.stringify(initial.items).includes('Runtime private discussion'),
      false
    );
    assert.equal(
      JSON.stringify(initial.items).includes('ownerIdentityId'),
      false
    );
    assert.ok(initial.cursors[0]);
    if (options.digest) {
      const response = await digest();
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const value = await accepted(response);
      assert.deepEqual(Object.keys(value).sort(), [
        'applications',
        'articles',
        'discussions',
        'latest',
      ]);
      for (const [key, max] of Object.entries({
        latest: 10,
        discussions: 10,
        applications: 10,
        articles: 20,
      })) {
        assert.ok(value[key].items.length <= max);
        assert.deepEqual(Object.keys(value[key]).sort(), ['items', 'more']);
      }
      assert.equal(value.articles.items[0].excerpt, 'Article summary.');
      assert.ok(value.articles.items[0].cover.imageId);
      assert.equal(
        value.applications.items.find((item) => item.id === application.id)
          .name,
        'Reviewed application'
      );
      assert.equal(value.discussions.items.length, 10);
      assert.ok(
        value.discussions.items.every((item) => item.kind === 'discussion')
      );
      assert.ok(value.latest.items.some((item) => item.kind === 'review'));
      const serialized = JSON.stringify(value);
      for (const privateField of [
        'through',
        'ownerIdentityId',
        'payloadRef',
        'Runtime private discussion',
      ])
        assert.equal(serialized.includes(privateField), false);
      for (const query of ['tenantId=foreign', 'page=2', 'limit=1000'])
        assert.equal(
          (await fetch(bff.origin + '/api/digest?' + query)).status,
          400
        );
      pass(
        'Digest: four independent bounded public selections preserve real article summaries/covers and applications despite dense discussion/review activity; private source boundaries and caller scope are rejected'
      );
    }
    const expected = await accepted(await feed(initial.cursors[0]));
    await restartBff();
    const resumed = await accepted(await feed(initial.cursors[0]));
    assert.deepEqual(resumed.items, expected.items);
    assert.equal(
      (await feed(initial.cursors[0].slice(0, -5) + 'wrong')).status,
      400
    );
    assert.equal(
      (await fetch(bff.origin + '/api/explore?tenantId=foreign')).status,
      400
    );
    for (const origin of [editorialOrigin, discussionOrigin]) {
      const route = origin() + '/api/internal/explore';
      for (const credentials of [
        {},
        headers(owner),
        {
          'x-explore-reader': discussionEnv.EXPLORE_SERVICE_SECRET,
          'x-user-id': owner,
        },
        {
          'x-explore-reader': discussionEnv.EXPLORE_SERVICE_SECRET,
          'x-tenant-id': 'foreign',
        },
      ]) {
        assert.equal(
          (
            await fetch(route, {
              method: 'POST',
              headers: { 'content-type': 'application/json', ...credentials },
              body: '{"after":null}',
            })
          ).status,
          401
        );
      }
    }
    pass(
      'Explore: six real public content kinds merge without duplicates through bounded pages; legacy authority gaps, projection lag, private content, foreign scope, mixed credentials and forged cursors are denied; encrypted continuation survives BFF restart'
    );
    if (options.timeline)
      timeline = await require('./timeline-runtime-checks.cjs')({
        ...options,
        application,
        topics,
        review,
        restartBff,
        bffOrigin: () => bff.origin,
        exploreCursor: initial.cursors[0],
        projectSuite: async (id) =>
          projections.publish(
            projectEditorialSnapshot(await snapshots.read('suite', id))
          ),
      });
    if (options.browser)
      await require('./explore-browser.cjs')({
        ...options,
        bffOrigin: () => bff.origin,
        application,
        topics,
        project,
        restartBff,
        projectPublication: async (kind, id) =>
          projections.publish(
            projectEditorialSnapshot(await snapshots.read(kind, id))
          ),
      });
    await accepted(
      await call(
        discussionOrigin,
        `application-discussions/${application.id}/${topics[0].id}`,
        owner,
        'DELETE',
        { expectedRevision: topics[0].revision }
      )
    );
    assert.equal(
      (await pages()).items.some((item) => item.id === topics[0].id),
      false
    );
    if (timeline)
      assert.equal(
        (await timeline.pages()).items.some((item) => item.id === topics[0].id),
        false
      );
    const [state] = await editorialSource.query(
      "SELECT revision FROM editorial_resource_states WHERE resourceKind='app' AND resourceId=?",
      [application.id]
    );
    await editorialSource.query(
      "UPDATE editorial_resource_states SET deletedAt=1,revision=revision+1 WHERE resourceKind='app' AND resourceId=?",
      [application.id]
    );
    const hidden = await pages();
    if (timeline) assert.equal((await timeline.read()).status, 404);
    assert.equal(
      hidden.items.some(
        (item) =>
          item.id === application.id ||
          item.target.applicationId === application.id
      ),
      false
    );
    if (options.digest) {
      const value = await accepted(await digest());
      assert.equal(
        value.applications.items.some((item) => item.id === application.id),
        false
      );
      assert.equal(
        value.discussions.items.some(
          (item) => item.target.applicationId === application.id
        ),
        false
      );
      assert.equal(
        value.latest.items.some(
          (item) =>
            item.id === application.id ||
            item.target.applicationId === application.id
        ),
        false
      );
    }
    await editorialSource.query(
      "UPDATE editorial_resource_states SET deletedAt=NULL,revision=? WHERE resourceKind='app' AND resourceId=?",
      [state.revision, application.id]
    );
    await options.stopDiscussion();
    assert.equal((await feed()).status, 503);
    if (timeline) assert.equal((await timeline.read()).status, 503);
    if (options.digest) assert.equal((await digest()).status, 503);
    await options.restartDiscussion();
    await restartBff();
    await pages();
    if (timeline) await timeline.pages();
    if (options.digest) await accepted(await digest());
    await restartBff('');
    assert.equal((await feed()).status, 503);
    if (timeline) {
      assert.equal((await timeline.read()).status, 503);
      pass(
        'Application timeline: current deletion and parent withdrawal hide stale projections; source outage and missing service credentials fail closed; service restart restores scoped activity'
      );
    }
    if (options.digest) {
      assert.equal((await digest()).status, 503);
      pass(
        'Digest: authority gaps and projection lag fail closed; current parent withdrawal hides stale content; source outage/absent credentials remain unavailable and restart restores real selections'
      );
    }
    pass(
      'Explore: current topic deletion and canonical parent withdrawal hide stale projected content, hidden scan pages remain traversable, source outages remain unavailable, and service restart recovers without rebuilding a separate feed'
    );
  } finally {
    await bff?.stop();
    await pool.end();
    await mongo.close();
  }
};
