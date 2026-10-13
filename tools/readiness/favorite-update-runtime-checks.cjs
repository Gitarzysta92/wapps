const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { MongoClient } = require('mongodb');
const { createPool } = require('mysql2/promise');
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

module.exports = async function qualifyFavoriteUpdateRuntime(options) {
  const {
    accountSource,
    editorialSource,
    discussionEnv,
    accountEnv,
    owner,
    other,
    accountOrigin,
    editorialOrigin,
    discussionOrigin,
    headers,
    until,
    restartAccount,
    restartDiscussion,
    stopDiscussion,
    pass,
  } = options;
  const accepted = async (response, status = 200) => {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return body;
  };
  const call = (
    origin,
    route,
    method = 'GET',
    body,
    uid = owner,
    roles = [],
    key = randomUUID()
  ) =>
    fetch(origin() + '/api/' + route, {
      method,
      headers: {
        ...headers(uid),
        'x-user-claims': JSON.stringify({ tenantId: 'default', roles }),
        'idempotency-key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  const inbox = (uid = owner) =>
    call(
      accountOrigin,
      'me/notifications/favorites',
      'GET',
      undefined,
      uid
    ).then(accepted);
  const due = () =>
    accountSource.query(
      'UPDATE identity_favorite_watches SET availableAt=0 WHERE identityId=? AND failedAt IS NULL',
      [owner]
    );
  const observe = async (kind, minimum) => {
    await due();
    return until(
      inbox,
      (page) =>
        page.items.filter((item) => item.target.kind === kind).length >=
        minimum,
      `${kind} update was not delivered`
    );
  };
  const sourceState = (target) =>
    fetch(
      (target.kind === 'discussions' ? discussionOrigin() : editorialOrigin()) +
        '/api/internal/favorite-updates',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-notification-worker': accountEnv.NOTIFICATION_SERVICE_SECRET,
        },
        body: JSON.stringify(target),
        signal: AbortSignal.timeout(10000),
      }
    ).then(accepted);
  const save = async (target, saved = true) => {
    const current = await accepted(await call(accountOrigin, 'me/favorites'));
    return accepted(
      await call(accountOrigin, 'me/favorites', 'PUT', {
        expectedRevision: current.revision,
        target,
        saved,
      })
    );
  };
  const preferences = async (enabled) => {
    const current = await accepted(await call(accountOrigin, 'me/preferences'));
    current.preferences.notifications.inApp.favoriteUpdates = enabled;
    return accepted(
      await call(accountOrigin, 'me/preferences', 'PUT', {
        expectedRevision: current.revision,
        preferences: current.preferences,
      })
    );
  };
  const mongo = new MongoClient(
    `mongodb://127.0.0.1:${discussionEnv.MONGO_PORT}`,
    {
      auth: {
        username: discussionEnv.MONGO_USERNAME,
        password: discussionEnv.MONGO_PASSWORD,
      },
    }
  );
  const pool = createPool({
    host: discussionEnv.MYSQL_HOST,
    port: Number(discussionEnv.MYSQL_PORT),
    user: discussionEnv.MYSQL_USERNAME,
    password: discussionEnv.MYSQL_PASSWORD,
    database: discussionEnv.MYSQL_DATABASE,
  });
  try {
    await mongo.connect();
    const reader = new MysqlEditorialSnapshotReader(editorialSource, 'default');
    const projections = new MongoEditorialProjections(
      mongo.db('suites').collection('editorial_projections_v1')
    );
    const project = async (kind, id) =>
      projections.publish(
        projectEditorialSnapshot(await reader.read(kind, id))
      );
    const [app] = await editorialSource.query(
      "SELECT id,slug FROM app_records WHERE slug='export-application'"
    );
    assert.ok(app);
    await project('app', app.id);
    const appTarget = { kind: 'applications', id: app.id };
    const suiteFields = {
      title: 'Favorite suite',
      description: 'A real approved suite.',
      applicationIds: [app.id],
    };
    const suite = await accepted(
      await call(editorialOrigin, 'me/suites', 'POST', suiteFields),
      201
    );
    const articleFields = {
      title: 'Favorite article',
      slug: 'favorite-update-article',
      excerpt: 'A public article for notification qualification.',
      byline: 'Favorite author',
      category: 'Guides',
      tags: [],
      sections: [
        {
          heading: 'Details',
          paragraphs: ['This is the public body of the favorite article.'],
        },
      ],
    };
    const article = await accepted(
      await call(editorialOrigin, 'me/articles', 'POST', articleFields),
      201
    );
    const publish = async (kind, id) => {
      const status = await accepted(
        await call(editorialOrigin, `me/${kind}/${id}/publication`)
      );
      const submission = await accepted(
        await call(editorialOrigin, `me/${kind}/${id}/submit`, 'POST', {
          expectedRevision: status.revision,
          ...(kind === 'articles'
            ? { expectedPublicationRevision: status.publicationRevision }
            : {}),
        }),
        201
      );
      const route = `editorial/${
        kind === 'articles' ? 'article' : 'suite'
      }-reviews/${id}/decision`;
      const body = {
        decision: 'approve',
        expectedRevision: submission.revision,
        submittedRevision: submission.submittedRevision,
        reason: '',
        ...(kind === 'articles'
          ? { expectedPublicationRevision: status.publicationRevision }
          : {}),
      };
      const key = randomUUID(),
        result = await accepted(
          await call(
            editorialOrigin,
            route,
            'POST',
            body,
            other,
            ['editorial:reviewer'],
            key
          ),
          201
        );
      const stamp = await sourceState({ kind, id });
      assert.deepEqual(
        await accepted(
          await call(
            editorialOrigin,
            route,
            'POST',
            body,
            other,
            ['editorial:reviewer'],
            key
          ),
          201
        ),
        result
      );
      assert.deepEqual(
        await sourceState({ kind, id }),
        stamp,
        'Approval replay cannot advance the update cursor twice'
      );
      return result;
    };
    await publish('suites', suite.id);
    await project('suite', suite.id);
    await publish('articles', article.id);
    await project('article', article.id);
    const base = `application-discussions/${app.id}`;
    const topic = await accepted(
      await call(discussionOrigin, base, 'POST', {
        title: 'Favorite discussion',
        tags: ['community'],
        displayName: 'Author',
        text: 'A public favorite topic.',
      }),
      201
    );
    const generations = new MongoGenerationStore(
      mongo.db('export_discussion').collection('discussion_generation_nodes'),
      mongo.db('export_discussion').collection('discussion_generation_heads')
    );
    await generations.ensureIndexes();
    const payloads = new MinioImmutablePayloadReader(
      new MinioClient({
        host: discussionEnv.DISCUSSION_STORAGE_HOST,
        accessKey: discussionEnv.DISCUSSION_STORAGE_ACCESSKEY,
        secretKey: discussionEnv.DISCUSSION_STORAGE_SECRETKEY,
      })
    );
    const projectTopic = () =>
      materializeDiscussion(
        topic.id,
        new MysqlDiscussionSnapshotReader(pool),
        payloads,
        generations
      );
    await projectTopic();
    const targets = [
      appTarget,
      { kind: 'suites', id: suite.id },
      { kind: 'articles', id: article.id },
      { kind: 'discussions', id: topic.id },
    ];
    for (const target of targets) await save(target);
    assert.equal((await inbox()).items.length, 0);
    for (const origin of [editorialOrigin, discussionOrigin]) {
      assert.equal(
        (
          await call(
            origin,
            'internal/favorite-updates',
            'POST',
            targets[origin === discussionOrigin ? 3 : 0]
          )
        ).status,
        401
      );
      assert.equal(
        (
          await fetch(origin() + '/api/internal/favorite-updates', {
            method: 'POST',
            headers: {
              ...headers(owner),
              'x-notification-worker': accountEnv.NOTIFICATION_SERVICE_SECRET,
            },
            body: JSON.stringify(appTarget),
          })
        ).status,
        401
      );
    }
    pass(
      'favorite subscriptions capture canonical baselines; source APIs reject member and mixed credentials'
    );

    for (const [kind, entity, fields] of [
      ['suites', suite, suiteFields],
      ['articles', article, articleFields],
    ]) {
      const before = await sourceState({ kind, id: entity.id });
      const draft = await accepted(
        await call(editorialOrigin, `me/${kind}/${entity.id}`)
      );
      await accepted(
        await call(editorialOrigin, `me/${kind}/${entity.id}`, 'PUT', {
          ...fields,
          title: fields.title + ' updated',
          expectedRevision: draft.revision,
        })
      );
      assert.deepEqual(
        await sourceState({ kind, id: entity.id }),
        before,
        'Private edits cannot generate public updates'
      );
      await publish(kind, entity.id);
      await observe(kind, 1);
      await project(kind === 'suites' ? 'suite' : 'article', entity.id);
    }
    const updateApp = async () => {
      const [state] = await editorialSource.query(
        "SELECT revision FROM editorial_resource_states WHERE resourceKind='app' AND resourceId=?",
        [app.id]
      );
      return accepted(
        await call(
          editorialOrigin,
          `apps/${app.id}`,
          'PUT',
          {
            expectedRevision: Number(state.revision),
            description: `Approved public change ${state.revision}`,
          },
          owner,
          ['editorial:publisher']
        )
      );
    };
    const beforeRelease = await sourceState(appTarget);
    const [grant] = await editorialSource.query(
      'SELECT claimId FROM application_ownership_grants WHERE applicationId=? AND revokedAt IS NULL',
      [app.id]
    );
    const release = await accepted(
      await call(editorialOrigin, 'me/releases', 'POST', {
        applicationId: app.id,
        claimId: grant.claimId,
        fields: {
          version: '2.0.0',
          title: 'Favorite application release',
          description: 'Public release notes notify application followers.',
          channel: 'stable',
          type: 'major',
          releasedOn: '2026-10-13',
          changes: [
            { type: 'feature', description: 'A newly published capability.' },
          ],
        },
      }),
      201
    );
    assert.deepEqual(
      await sourceState(appTarget),
      beforeRelease,
      'Private release drafts cannot notify'
    );
    const releaseStatus = await accepted(
      await call(editorialOrigin, `me/releases/${release.id}/publication`)
    );
    const submittedRelease = await accepted(
      await call(editorialOrigin, `me/releases/${release.id}/submit`, 'POST', {
        expectedRevision: releaseStatus.revision,
        expectedPublicationRevision: releaseStatus.publicationRevision,
      }),
      201
    );
    const releaseDecision = {
      decision: 'approve',
      expectedRevision: submittedRelease.revision,
      expectedPublicationRevision: releaseStatus.publicationRevision,
      submittedRevision: submittedRelease.submittedRevision,
      reason: '',
    };
    const releaseKey = randomUUID(),
      releaseRoute = `editorial/release-reviews/${release.id}/decision`;
    const releaseReceipt = await accepted(
      await call(
        editorialOrigin,
        releaseRoute,
        'POST',
        releaseDecision,
        other,
        ['editorial:reviewer'],
        releaseKey
      ),
      201
    );
    const afterRelease = await sourceState(appTarget);
    assert.equal(afterRelease.version, beforeRelease.version + 1);
    assert.deepEqual(
      await accepted(
        await call(
          editorialOrigin,
          releaseRoute,
          'POST',
          releaseDecision,
          other,
          ['editorial:reviewer'],
          releaseKey
        ),
        201
      ),
      releaseReceipt
    );
    assert.deepEqual(await sourceState(appTarget), afterRelease);
    await observe('applications', 1);
    await project('app', app.id);
    const reply = () =>
      call(
        discussionOrigin,
        `${base}/${topic.id}/replies`,
        'POST',
        { displayName: 'Peer', text: 'A new public reply.' },
        other
      ).then((r) => accepted(r, 201));
    await reply();
    await observe('discussions', 1);
    await projectTopic();
    const initial = await inbox();
    assert.equal(initial.items.length, 4);
    assert.equal((await inbox(other)).items.length, 0);
    assert.equal(
      (await call(accountOrigin, 'me/notifications/favorites?identityId=Other'))
        .status,
      400
    );
    assert.match(
      (await call(accountOrigin, 'me/notifications/favorites')).headers.get(
        'cache-control'
      ),
      /no-store/
    );
    const selected = initial.items[0];
    assert.equal(
      (
        await call(
          accountOrigin,
          'me/notifications/favorites/read',
          'PUT',
          { id: selected.id },
          other
        )
      ).status,
      400
    );
    const read = await accepted(
      await call(accountOrigin, 'me/notifications/favorites/read', 'PUT', {
        id: selected.id,
      })
    );
    await restartAccount();
    assert.deepEqual(
      await accepted(
        await call(accountOrigin, 'me/notifications/favorites/read', 'PUT', {
          id: selected.id,
        })
      ),
      read
    );
    assert.equal(
      (await inbox()).items.find((row) => row.id === selected.id).readAt,
      read.readAt
    );
    pass(
      'all four favorite kinds deliver through compiled workers; private edits and replay stay silent; reads persist across restart'
    );

    await preferences(false);
    await reply();
    await due();
    await until(
      () =>
        accountSource.query(
          'SELECT delivered FROM identity_favorite_notifications WHERE identityId=? AND targetKind=? ORDER BY createdAt DESC LIMIT 1',
          [owner, 'discussions']
        ),
      (rows) => rows.length === 1 && rows[0].delivered === 0,
      'Opt-out was not durably suppressed'
    );
    assert.equal((await inbox()).enabled, false);
    await preferences(true);
    await due();
    await save(targets[3], false);
    const lagging = await accepted(await call(accountOrigin, 'me/favorites'));
    assert.equal(
      (
        await call(accountOrigin, 'me/favorites', 'PUT', {
          expectedRevision: lagging.revision,
          target: targets[3],
          saved: true,
        })
      ).status,
      503,
      'A stale discussion selection stays unavailable until materialization'
    );
    await projectTopic();
    await save(targets[3]);
    assert.ok(
      !(await inbox()).items.some((row) => row.target.kind === 'discussions')
    );
    await reply();
    await observe('discussions', 1);
    await projectTopic();
    await stopDiscussion();
    assert.equal(
      (await call(accountOrigin, 'me/notifications/favorites')).status,
      503
    );
    await restartDiscussion();
    await restartAccount();
    assert.equal((await inbox()).items.length, 4);
    pass(
      'opt-out, remove/re-add, dependency outage and restart preserve suppression and current membership'
    );

    for (let n = 0; n < 8; n++) {
      await updateApp();
      await due();
      await until(
        () =>
          accountSource.query(
            "SELECT COUNT(*) total FROM identity_favorite_notifications WHERE identityId=? AND targetKind='applications' AND delivered=1",
            [owner]
          ),
        (rows) => Number(rows[0].total) === n + 2,
        'Application update did not settle'
      );
    }
    await project('app', app.id);
    const latest = await inbox();
    assert.equal(latest.items.length, 10);
    assert.ok(latest.next);
    const older = await accepted(
      await call(
        accountOrigin,
        `me/notifications/favorites?cursor=${latest.next}`
      )
    );
    assert.equal(older.items.length, 2);
    if (options.browser)
      await require('./favorite-update-browser.cjs')({
        ...options,
        preferences,
        app,
        article: { ...article, slug: articleFields.slug },
        suite,
        topic,
      });
    const exported = await accepted(
      await call(accountOrigin, 'me/exports', 'POST', {}),
      202
    );
    await until(
      async () =>
        accepted(await call(accountOrigin, `me/exports/${exported.id}`)),
      (job) => job.status === 'ready',
      'Favorite notification archive did not complete'
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
    for (const collection of ['favorite-subscriptions', 'favorite-updates']) {
      const rows = archive.filter(
        (row) => row.source === 'account' && row.collection === collection
      );
      assert.ok(rows.length >= 4, collection);
      assert.equal(JSON.stringify(rows).includes('leaseToken'), false);
      const key = collection === 'favorite-subscriptions' ? 'generation' : 'id';
      const table =
        collection === 'favorite-subscriptions'
          ? 'identity_favorite_watches'
          : 'identity_favorite_notifications';
      const owned = await accountSource.query(
        `SELECT ${key} FROM ${table} WHERE identityId=?`,
        [owner]
      );
      assert.deepEqual(
        rows.map((row) => row.data[key]).sort(),
        owned.map((row) => row[key]).sort()
      );
    }
    assert.equal(archive[0].identityId, owner);
    assert.deepEqual(archive[0].sources, [
      'account',
      'credentials',
      'editorial',
      'discussion',
    ]);
    assert.equal(archive.at(-1).type, 'complete');
    await accepted(
      await call(accountOrigin, `me/exports/${exported.id}`, 'DELETE')
    );
    pass(
      'Published releases notify application favorites once; four-source compiled archive includes private watches and receipts without lease credentials'
    );
    const status = await accepted(
      await call(editorialOrigin, `me/articles/${article.id}/publication`)
    );
    await accepted(
      await call(
        editorialOrigin,
        `me/articles/${article.id}/withdraw`,
        'POST',
        {
          expectedRevision: status.revision,
          expectedPublicationRevision: status.publicationRevision,
        }
      ),
      201
    );
    let cursor = null;
    do {
      const current = await accepted(
        await call(
          accountOrigin,
          'me/notifications/favorites' + (cursor ? `?cursor=${cursor}` : '')
        )
      );
      assert.ok(
        current.items.every((row) => row.target.id !== article.id),
        'Withdrawal hides updates despite stale projections'
      );
      cursor = current.next;
    } while (cursor);
    accountEnv.FAVORITE_UPDATE_WORKER_ENABLED = 'false';
    await restartAccount();
    assert.equal(
      (await call(accountOrigin, 'me/notifications/favorites')).status,
      503
    );
    assert.equal(
      (
        await call(
          accountOrigin,
          'me/notifications/favorites',
          'GET',
          undefined,
          other
        )
      ).status,
      503
    );
    pass(
      'bounded pages, current withdrawal despite stale projections and disabled-worker unavailability are explicit'
    );
  } finally {
    await pool.end();
    await mongo.close();
  }
};
