const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const http = require('node:http');
const { createPool } = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const { MinioClient } = require('../../sdk/extras/minio/src');
const materializer =
  '../../sdk/features/discussion/applications/materializer/service/src/';
const { MysqlDiscussionSnapshotReader } = require(materializer +
  'mysql-snapshot-reader');
const { MinioImmutablePayloadReader } = require(materializer +
  'immutable-payload-reader');
const { MongoGenerationStore } = require(materializer +
  'mongo-generation-store');
const { materializeDiscussion } = require(materializer + 'materialization');
const editorial = '../../apps/services/editorial/src/app/';
const { MysqlEditorialSnapshotReader } = require(editorial +
  'infrastructure/mysql-editorial-snapshot');
const { MongoEditorialProjections } = require(editorial +
  'infrastructure/mongo-editorial-projections');
const { projectEditorialSnapshot } = require(editorial +
  'application/editorial-materialization');

module.exports = async function qualifyReplyNotificationRuntime(options) {
  const {
    accountSource,
    editorialSource,
    discussionEnv,
    accountEnv,
    owner,
    other,
    accountOrigin,
    discussionOrigin,
    discussionServiceOrigin,
    headers,
    until,
    restartAccount,
    restartDiscussion,
    stopAccount,
    stopDiscussion,
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
  let proxy;
  const accepted = async (response, status = 200) => {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return body;
  };
  const call = (
    origin,
    route,
    uid = owner,
    method = 'GET',
    body,
    key = randomUUID()
  ) =>
    fetch(origin() + '/api/' + route, {
      method,
      headers: { ...headers(uid), 'idempotency-key': key },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  const inbox = (uid = owner) =>
    call(accountOrigin, 'me/notifications', uid).then(accepted);
  async function allInbox() {
    const entries = [];
    let cursor = null;
    for (let page = 0; page < 10; page++) {
      const value = await accepted(
        await call(
          accountOrigin,
          'me/notifications' + (cursor ? `?cursor=${cursor}` : '')
        )
      );
      entries.push(...value.items);
      if (value.next === null) return entries;
      cursor = value.next;
    }
    throw new Error('Fixture inbox exceeded expected page bound');
  }
  const rows = async (sql, values = []) => (await pool.query(sql, values))[0];
  const settled = (id) =>
    until(
      () =>
        rows('SELECT * FROM discussion_reply_notifications WHERE id=?', [id]),
      (value) => value.length === 1 && value[0].deliveredAt !== null,
      'Notification did not settle'
    );
  async function preferences(enabled) {
    const value = await accepted(await call(accountOrigin, 'me/preferences'));
    value.preferences.notifications.inApp.discussionReplies = enabled;
    return accepted(
      await call(accountOrigin, 'me/preferences', owner, 'PUT', {
        expectedRevision: value.revision,
        preferences: value.preferences,
      })
    );
  }
  try {
    await mongo.connect();
    const [application] = await editorialSource.query(
      'SELECT id,slug FROM app_records WHERE slug=?',
      ['export-application']
    );
    const [article] = await editorialSource.query(
      'SELECT articleId id,slug FROM article_publications WHERE slug=?',
      ['export-article']
    );
    assert.ok(application && article);
    const reader = new MysqlEditorialSnapshotReader(editorialSource, 'default');
    const projection = new MongoEditorialProjections(
      mongo.db('suites').collection('editorial_projections_v1')
    );
    await projection.publish(
      projectEditorialSnapshot(await reader.read('app', application.id))
    );
    await projection.publish(
      projectEditorialSnapshot(await reader.read('article', article.id))
    );
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
    const base = `application-discussions/${application.id}`;
    const topic = await accepted(
      await call(discussionOrigin, base, owner, 'POST', {
        title: 'Notification qualification topic',
        tags: ['community'],
        displayName: 'Topic owner',
        text: 'A real public topic.',
      }),
      201
    );
    const reply = (uid = other, key = randomUUID(), parent = topic.id) =>
      call(
        discussionOrigin,
        `${base}/${parent}/replies`,
        uid,
        'POST',
        {
          displayName: 'Reply author',
          text: 'A real reply from another member.',
        },
        key
      ).then((r) => accepted(r, 201));
    const key = randomUUID(),
      first = await reply(other, key);
    assert.deepEqual(await reply(other, key), first);
    const {
      EditorialProfileDiscussionParents,
    } = require('../../apps/services/community/src/app/discussions/infrastructure/editorial-profile-discussion-parents');
    assert.equal(
      (
        await new EditorialProfileDiscussionParents(
          options.editorialOrigin()
        ).select([{ kind: 'application', id: application.id }])
      ).length,
      1
    );
    const resolved = await accepted(
      await fetch(discussionOrigin() + '/api/internal/reply-notifications', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-notification-worker': discussionEnv.NOTIFICATION_SERVICE_SECRET,
        },
        body: JSON.stringify({
          operation: 'resolve',
          recipientId: owner,
          ids: [first.id],
        }),
        signal: AbortSignal.timeout(10000),
      })
    );
    assert.equal(resolved.items.length, 1);
    await settled(first.id);
    const initial = await inbox();
    assert.match(
      (await call(accountOrigin, 'me/notifications')).headers.get(
        'cache-control'
      ),
      /no-store/
    );
    assert.equal(initial.items.length, 1);
    assert.equal(initial.items[0].id, first.id);
    assert.equal(initial.items[0].slug, application.slug);
    assert.equal(initial.items[0].readAt, null);
    assert.equal((await inbox(other)).items.length, 0);
    assert.equal(
      (
        await call(accountOrigin, 'me/notifications/read', other, 'PUT', {
          id: first.id,
        })
      ).status,
      400
    );
    assert.equal(
      (await call(accountOrigin, 'me/notifications?identityId=' + other))
        .status,
      400
    );
    assert.equal(
      (await fetch(accountOrigin() + '/api/me/notifications')).status,
      401
    );
    assert.equal(
      (
        await call(
          discussionOrigin,
          'internal/reply-notifications',
          owner,
          'POST',
          { operation: 'claim' }
        )
      ).status,
      401
    );
    const own = await reply(owner);
    assert.equal(
      (
        await rows('SELECT id FROM discussion_reply_notifications WHERE id=?', [
          own.id,
        ])
      ).length,
      0
    );
    await project(topic.id);
    const artTopic = await accepted(
      await call(
        discussionOrigin,
        `article-comments/${article.id}`,
        owner,
        'POST',
        {
          displayName: 'Article reader',
          text: 'A real article comment.',
        }
      ),
      201
    );
    const artReply = await accepted(
      await call(
        discussionOrigin,
        `article-comments/${article.id}/${artTopic.id}/replies`,
        other,
        'POST',
        {
          displayName: 'Article peer',
          text: 'A real article reply.',
        }
      ),
      201
    );
    await settled(artReply.id);
    await project(artTopic.id);
    assert.ok(
      (await inbox()).items.some(
        (item) => item.target.kind === 'article' && item.id === artReply.id
      )
    );
    pass(
      'Compiled reply commands and worker deliver application/article inbox entries through real OPA; exact command replay, self exclusion, no-store and cross-account denial hold'
    );

    await preferences(false);
    const suppressed = await reply();
    await settled(suppressed.id);
    assert.deepEqual(await inbox(), { enabled: false, items: [], next: null });
    await preferences(true);
    assert.equal(
      (await inbox()).items.some((item) => item.id === suppressed.id),
      false
    );
    assert.equal(
      (
        await accountSource.query(
          'SELECT delivered FROM identity_reply_notifications WHERE identityId=? AND id=?',
          [owner, suppressed.id]
        )
      )[0].delivered,
      0
    );
    await project(topic.id);
    await restartDiscussion();
    await restartAccount();
    assert.equal((await inbox()).items.length, 2);
    await stopDiscussion();
    assert.equal((await call(accountOrigin, 'me/notifications')).status, 503);
    await restartDiscussion();
    await restartAccount();
    pass(
      'Saved reply opt-out suppresses delivery permanently; service restart preserves receipts and a Discussion outage returns unavailable'
    );

    // Drop settlement before the source receives it, then expire only this disposable lease.
    await stopAccount();
    let settlements = 0;
    proxy = http.createServer(async (request, response) => {
      try {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = Buffer.concat(chunks),
          action = JSON.parse(body.toString());
        if (['ack', 'defer'].includes(action.operation)) {
          settlements++;
          response.writeHead(503, { 'content-type': 'application/json' });
          response.end('{}');
          return;
        }
        const upstream = await fetch(discussionServiceOrigin() + request.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-notification-worker': discussionEnv.NOTIFICATION_SERVICE_SECRET,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });
        response.writeHead(upstream.status, {
          'content-type': 'application/json',
        });
        response.end(Buffer.from(await upstream.arrayBuffer()));
      } catch {
        response.writeHead(503);
        response.end('{}');
      }
    });
    await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
    accountEnv.DISCUSSION_URL = `http://127.0.0.1:${proxy.address().port}`;
    const interrupted = await reply();
    await restartAccount();
    await until(
      () =>
        accountSource.query(
          'SELECT id FROM identity_reply_notifications WHERE identityId=? AND id=?',
          [owner, interrupted.id]
        ),
      (value) => value.length === 1 && settlements > 0,
      'Inbox did not commit before lost acknowledgement'
    );
    await stopAccount();
    await rows(
      'UPDATE discussion_reply_notifications SET leasedUntil=? WHERE id=? AND deliveredAt IS NULL',
      [Date.now() - 1, interrupted.id]
    );
    accountEnv.DISCUSSION_URL = discussionServiceOrigin();
    await restartAccount();
    await settled(interrupted.id);
    assert.equal(
      Number(
        (
          await accountSource.query(
            'SELECT COUNT(*) total FROM identity_reply_notifications WHERE identityId=? AND id=?',
            [owner, interrupted.id]
          )
        )[0].total
      ),
      1
    );
    const receipt = await accepted(
      await call(accountOrigin, 'me/notifications/read', owner, 'PUT', {
        id: interrupted.id,
      })
    );
    assert.deepEqual(
      await accepted(
        await call(accountOrigin, 'me/notifications/read', owner, 'PUT', {
          id: interrupted.id,
        })
      ),
      receipt
    );
    await restartAccount();
    assert.equal(
      (await inbox()).items.find((item) => item.id === interrupted.id).readAt,
      receipt.readAt
    );
    pass(
      'Lost source acknowledgements after durable inbox commit recover after Account restart with one receipt; read acknowledgement is idempotent and persists'
    );

    await project(topic.id);
    if (options.browser)
      await require('./reply-notification-browser.cjs')({
        ...options,
        application,
        article,
        topic,
        artTopic,
        first,
        artReply,
        preferences,
        inbox,
        accepted,
        call,
        project,
        reply,
        settled,
      });
    const exported = await accepted(
      await call(accountOrigin, 'me/exports', owner, 'POST', {}),
      202
    );
    await until(
      async () =>
        accepted(await call(accountOrigin, `me/exports/${exported.id}`)),
      (value) => value.status === 'ready',
      'Notification archive did not complete'
    );
    const download = await call(
      accountOrigin,
      `me/exports/${exported.id}/download`
    );
    assert.equal(download.status, 200);
    const archive = gunzipSync(Buffer.from(await download.arrayBuffer()))
      .toString('utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    for (const source of ['account', 'discussion']) {
      const notifications = archive.filter(
        (row) =>
          row.source === source && row.collection === 'reply-notifications'
      );
      assert.ok(notifications.some((row) => row.data.event.id === first.id));
      assert.equal(JSON.stringify(notifications).includes('leaseToken'), false);
    }
    await accepted(
      await call(accountOrigin, `me/exports/${exported.id}`, owner, 'DELETE')
    );
    pass(
      'The compiled four-source account archive includes owned notification receipts and source events without delivery credentials'
    );
    const revision = (
      await rows(
        'SELECT revision FROM discussion_write_aggregates WHERE id=?',
        [topic.id]
      )
    )[0].revision;
    await accepted(
      await call(discussionOrigin, `${base}/${first.id}`, other, 'DELETE', {
        expectedRevision: Number(revision),
      })
    );
    assert.equal(
      (await allInbox()).some((item) => item.id === first.id),
      false
    );
    await editorialSource.query(
      'UPDATE editorial_resource_states SET deletedAt=? WHERE resourceKind=? AND resourceId=?',
      [Date.now(), 'article', article.id]
    );
    try {
      assert.equal(
        (await allInbox()).some((item) => item.id === artReply.id),
        false
      );
    } finally {
      await editorialSource.query(
        'UPDATE editorial_resource_states SET deletedAt=NULL WHERE resourceKind=? AND resourceId=?',
        ['article', article.id]
      );
    }
    accountEnv.REPLY_NOTIFICATION_WORKER_ENABLED = 'false';
    await restartAccount();
    assert.equal((await call(accountOrigin, 'me/notifications')).status, 503);
    assert.equal(
      (await call(accountOrigin, 'me/notifications', other)).status,
      503
    );
    pass(
      'Current canonical reply deletion and parent withdrawal hide notifications despite old projections; disabled delivery is unavailable even for an empty inbox'
    );
  } finally {
    if (proxy)
      await new Promise((resolve) => {
        proxy.close(resolve);
        proxy.closeAllConnections();
      });
    await pool.end();
    await mongo.close();
  }
};
