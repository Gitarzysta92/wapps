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

module.exports = async function qualifyMentionNotificationRuntime(options) {
  const {
    accountSource,
    editorialSource,
    discussionEnv,
    accountEnv,
    owner,
    other,
    accountOrigin,
    discussionOrigin,
    headers,
    until,
    restartAccount,
    restartDiscussion,
    stopAccount,
    stopDiscussion,
    pass,
  } = options;
  const {
    MysqlCanonicalIdentities,
  } = require('../../sdk/features/identity/packages/infrastructure/mysql/src');
  const identities = new MysqlCanonicalIdentities(accountSource);
  const profileIds = {};
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
    call(accountOrigin, 'me/notifications/mentions', uid).then(accepted);
  async function allInbox() {
    const entries = [];
    let cursor = null;
    for (let page = 0; page < 10; page++) {
      const value = await accepted(
        await call(
          accountOrigin,
          'me/notifications/mentions' + (cursor ? `?cursor=${cursor}` : '')
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
        rows('SELECT * FROM discussion_mention_notifications WHERE id=?', [id]),
      (value) => value.length === 1 && value[0].deliveredAt !== null,
      'Notification did not settle'
    );
  async function visibility(uid, value) {
    const current = await accepted(
      await call(accountOrigin, 'me/preferences', uid)
    );
    current.preferences.privacy.profileVisibility = value;
    return accepted(
      await call(accountOrigin, 'me/preferences', uid, 'PUT', {
        expectedRevision: current.revision,
        preferences: current.preferences,
      })
    );
  }
  async function eventFor(nodeId, recipientId = owner) {
    const [event] = await rows(
      'SELECT * FROM discussion_mention_notifications WHERE nodeId=? AND recipientId=?',
      [nodeId, recipientId]
    );
    assert.ok(event, 'Mention intent missing for ' + nodeId);
    assert.notEqual(event.id, nodeId);
    return event;
  }
  async function preferences(enabled) {
    const value = await accepted(await call(accountOrigin, 'me/preferences'));
    value.preferences.notifications.inApp.discussionMentions = enabled;
    return accepted(
      await call(accountOrigin, 'me/preferences', owner, 'PUT', {
        expectedRevision: value.revision,
        preferences: value.preferences,
      })
    );
  }
  try {
    for (const uid of [owner, other]) {
      profileIds[uid] = (await identities.find(uid)).subjectId;
      await visibility(uid, 'public');
    }
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
    const reply = async (
      uid = other,
      key = randomUUID(),
      parent = topic.id
    ) => {
      const result = await call(
        discussionOrigin,
        `${base}/${parent}/replies`,
        uid,
        'POST',
        {
          displayName: 'Reply author',
          text: 'A real reply from another member.',
          mentions: [profileIds[owner]],
        },
        key
      ).then((r) => accepted(r, 201));
      return {
        ...result,
        eventId: uid === owner ? null : (await eventFor(result.id)).id,
      };
    };
    const key = randomUUID(),
      first = await reply(other, key);
    assert.deepEqual(await reply(other, key), first);
    const {
      EditorialProfileDiscussionParents,
    } = require('../../sdk/features/discussion/applications/management/service/src/app/discussions/infrastructure/editorial-profile-discussion-parents');
    assert.equal(
      (
        await new EditorialProfileDiscussionParents(
          options.editorialOrigin()
        ).select([{ kind: 'application', id: application.id }])
      ).length,
      1
    );
    const resolved = await accepted(
      await fetch(discussionOrigin() + '/api/internal/mention-notifications', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-notification-worker': discussionEnv.NOTIFICATION_SERVICE_SECRET,
        },
        body: JSON.stringify({
          operation: 'resolve',
          recipientId: owner,
          ids: [first.eventId],
        }),
        signal: AbortSignal.timeout(10000),
      })
    );
    assert.equal(resolved.items.length, 1);
    await settled(first.eventId);
    const initial = await inbox();
    assert.match(
      (await call(accountOrigin, 'me/notifications/mentions')).headers.get(
        'cache-control'
      ),
      /no-store/
    );
    assert.equal(initial.items.length, 1);
    assert.equal(initial.items[0].id, first.eventId);
    assert.equal(initial.items[0].slug, application.slug);
    assert.equal(initial.items[0].readAt, null);
    assert.equal((await inbox(other)).items.length, 0);
    assert.equal(
      (
        await call(
          accountOrigin,
          'me/notifications/mentions/read',
          other,
          'PUT',
          {
            id: first.eventId,
          }
        )
      ).status,
      400
    );
    assert.equal(
      (
        await call(
          accountOrigin,
          'me/notifications/mentions?identityId=' + other
        )
      ).status,
      400
    );
    assert.equal(
      (await fetch(accountOrigin() + '/api/me/notifications/mentions')).status,
      401
    );
    assert.equal(
      (
        await call(
          discussionOrigin,
          'internal/mention-notifications',
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
        await rows(
          'SELECT id FROM discussion_mention_notifications WHERE nodeId=?',
          [own.id]
        )
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
          mentions: [profileIds[owner]],
        }
      ),
      201
    );
    artReply.eventId = (await eventFor(artReply.id)).id;
    await settled(artReply.eventId);
    await project(artTopic.id);
    assert.ok(
      (await inbox()).items.some(
        (item) => item.target.kind === 'article' && item.id === artReply.eventId
      )
    );
    pass(
      'Compiled mention commands and worker deliver application/article inbox entries through real OPA; exact command replay, self exclusion, no-store and cross-account denial hold'
    );

    await preferences(false);
    const suppressed = await reply();
    await settled(suppressed.eventId);
    assert.deepEqual(await inbox(), { enabled: false, items: [], next: null });
    await preferences(true);
    assert.equal(
      (await inbox()).items.some((item) => item.id === suppressed.eventId),
      false
    );
    assert.equal(
      (
        await accountSource.query(
          'SELECT delivered FROM identity_mention_notifications WHERE identityId=? AND id=?',
          [owner, suppressed.eventId]
        )
      )[0].delivered,
      0
    );
    await project(topic.id);
    await restartDiscussion();
    await restartAccount();
    assert.equal((await inbox()).items.length, 2);
    await stopDiscussion();
    assert.equal(
      (await call(accountOrigin, 'me/notifications/mentions')).status,
      503
    );
    await restartDiscussion();
    await restartAccount();
    pass(
      'Saved mention opt-out suppresses delivery permanently; service restart preserves receipts and a Discussion outage returns unavailable'
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
        const upstream = await fetch(discussionOrigin() + request.url, {
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
    await restartAccount();
    const interrupted = await reply();
    await until(
      () =>
        accountSource.query(
          'SELECT id FROM identity_mention_notifications WHERE identityId=? AND id=?',
          [owner, interrupted.eventId]
        ),
      (value) => value.length === 1 && settlements > 0,
      'Inbox did not commit before lost acknowledgement'
    );
    await stopAccount();
    await rows(
      'UPDATE discussion_mention_notifications SET leasedUntil=? WHERE id=? AND deliveredAt IS NULL',
      [Date.now() - 1, interrupted.eventId]
    );
    accountEnv.DISCUSSION_URL = discussionOrigin();
    await restartAccount();
    await settled(interrupted.eventId);
    assert.equal(
      Number(
        (
          await accountSource.query(
            'SELECT COUNT(*) total FROM identity_mention_notifications WHERE identityId=? AND id=?',
            [owner, interrupted.eventId]
          )
        )[0].total
      ),
      1
    );
    const receipt = await accepted(
      await call(
        accountOrigin,
        'me/notifications/mentions/read',
        owner,
        'PUT',
        {
          id: interrupted.eventId,
        }
      )
    );
    assert.deepEqual(
      await accepted(
        await call(
          accountOrigin,
          'me/notifications/mentions/read',
          owner,
          'PUT',
          {
            id: interrupted.eventId,
          }
        )
      ),
      receipt
    );
    await restartAccount();
    assert.equal(
      (await inbox()).items.find((item) => item.id === interrupted.eventId)
        .readAt,
      receipt.readAt
    );
    pass(
      'Lost source acknowledgements after durable inbox commit recover after Account restart with one receipt; read acknowledgement is idempotent and persists'
    );

    async function editMentions(ids) {
      const [aggregate] = await rows(
        'SELECT revision FROM discussion_write_aggregates WHERE id=?',
        [topic.id]
      );
      return accepted(
        await call(
          discussionOrigin,
          `${base}/${interrupted.id}`,
          other,
          'PUT',
          {
            expectedRevision: Number(aggregate.revision),
            content: {
              displayName: 'Reply author',
              text: 'A real reply from another member.',
              mentions: ids,
            },
          }
        )
      );
    }
    await editMentions([]);
    assert.equal(
      (await inbox()).items.some((item) => item.id === interrupted.eventId),
      false
    );
    await editMentions([profileIds[owner]]);
    assert.equal((await eventFor(interrupted.id)).id, interrupted.eventId);
    assert.equal(
      (await inbox()).items.find((item) => item.id === interrupted.eventId)
        .readAt,
      receipt.readAt
    );
    await visibility(owner, 'private');
    assert.equal((await inbox()).items.length, 0);
    const hidden = await accepted(
      await call(
        discussionOrigin,
        `${base}/${topic.id}/replies`,
        other,
        'POST',
        {
          displayName: 'Reply author',
          text: 'Private profiles receive no mention.',
          mentions: [profileIds[owner]],
        }
      ),
      201
    );
    assert.equal(
      (
        await rows(
          'SELECT id FROM discussion_mention_notifications WHERE nodeId=?',
          [hidden.id]
        )
      ).length,
      0
    );
    await visibility(owner, 'public');
    await stopAccount();
    // A durable write receipt remains replayable when recipient resolution is unavailable.
    assert.deepEqual(await reply(other, key), first);
    assert.equal(
      (
        await call(
          discussionOrigin,
          `${base}/${topic.id}/replies`,
          other,
          'POST',
          {
            displayName: 'Reply author',
            text: 'Unconfirmed mention during outage.',
            mentions: [profileIds[owner]],
          }
        )
      ).status,
      503
    );
    await restartAccount();
    assert.equal((await inbox()).items.length, 3);
    pass(
      'Remove/re-add retains the event and read receipt; current profile privacy hides old notifications and prevents new intents; exact writes replay during Account outage'
    );

    await project(topic.id);
    if (options.browser)
      await require('./mention-notification-browser.cjs')({
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
        eventFor,
        profileIds,
        visibility,
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
          row.source === source && row.collection === 'mention-notifications'
      );
      assert.ok(
        notifications.some((row) => row.data.event.id === first.eventId)
      );
      assert.equal(JSON.stringify(notifications).includes('leaseToken'), false);
    }
    await accepted(
      await call(accountOrigin, `me/exports/${exported.id}`, owner, 'DELETE')
    );
    pass(
      'The compiled four-source account archive includes owned notification receipts and source events without delivery credentials'
    );
    const third = 'MentionThird';
    await identities.ensure({
      uid: third,
      provider: 'email',
      kind: 'user',
      activate: true,
    });
    await identities.enrollAccount(third, 'Third mention member', randomUUID());
    profileIds[third] = (await identities.find(third)).subjectId;
    await visibility(third, 'public');
    const multi = await accepted(
      await call(discussionOrigin, base, other, 'POST', {
        title: 'Multiple mentioned recipients',
        tags: [],
        displayName: 'Mention author',
        text: 'A public root can notify two different members.',
        mentions: [
          profileIds[owner],
          profileIds[third],
          profileIds[other],
        ].sort(),
      }),
      201
    );
    const events = await rows(
      'SELECT * FROM discussion_mention_notifications WHERE nodeId=?',
      [multi.id]
    );
    assert.equal(events.length, 2);
    assert.equal(new Set(events.map((event) => event.id)).size, 2);
    for (const event of events) {
      assert.notEqual(event.id, multi.id);
      await settled(event.id);
    }
    assert.ok(
      (await inbox(third)).items.some((item) => item.nodeId === multi.id)
    );
    pass(
      'One root mentioning multiple members creates distinct durable events per recipient; the author remains excluded'
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
      (await allInbox()).some((item) => item.id === first.eventId),
      false
    );
    await editorialSource.query(
      'UPDATE editorial_resource_states SET deletedAt=? WHERE resourceKind=? AND resourceId=?',
      [Date.now(), 'article', article.id]
    );
    try {
      assert.equal(
        (await allInbox()).some((item) => item.id === artReply.eventId),
        false
      );
    } finally {
      await editorialSource.query(
        'UPDATE editorial_resource_states SET deletedAt=NULL WHERE resourceKind=? AND resourceId=?',
        ['article', article.id]
      );
    }
    accountEnv.MENTION_NOTIFICATION_WORKER_ENABLED = 'false';
    await restartAccount();
    assert.equal(
      (await call(accountOrigin, 'me/notifications/mentions')).status,
      503
    );
    assert.equal(
      (await call(accountOrigin, 'me/notifications/mentions', other)).status,
      503
    );
    pass(
      'Current canonical mentioned-post deletion and parent withdrawal hide notifications despite old projections; disabled delivery is unavailable even for an empty inbox'
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
