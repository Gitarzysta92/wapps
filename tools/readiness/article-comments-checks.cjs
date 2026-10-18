const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { DataSource } = require('typeorm');
const { processService } = require('./qualification-process.cjs');
const { discussionProcessService } = require('./discussion-portal-fixture.cjs');

async function articleCommentsChecks(options) {
  const {
    root,
    sql,
    mongo,
    mongoPort,
    queuePort,
    password,
    endpoint,
    output,
    editorialOrigin,
    secret,
    opaBinary,
    pass,
  } = options;
  const management = path.join(
    root,
    'apps/services/community/src/app/discussions'
  );
  const load = (name) => require(path.join(management, name));
  const { DiscussionArticleTargets1791676822000 } = load(
    'infrastructure/discussion-article-targets.migration'
  );
  const database = 'article_comments';
  const actor = { identityId: 'CommentAlice', tenantId: 'default', roles: [] };
  const other = { ...actor, identityId: 'CommentBob' };
  const moderator = {
    ...actor,
    identityId: 'CommentModerator',
    roles: ['admin'],
  };
  const staff = {
    ...actor,
    identityId: 'IndependentArticleReviewer',
    roles: ['editorial:reviewer'],
  };
  const headers = (user) => ({
    'content-type': 'application/json',
    ...(user
      ? {
          'x-user-id': user.identityId,
          'x-user-claims': JSON.stringify({
            tenantId: user.tenantId,
            roles: user.roles,
          }),
          'x-ingress-auth': secret,
        }
      : {}),
  });
  let source, api, opa, worker;
  let workerLog = '';
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    DISCUSSION_PORT: '0',
    DISCUSSION_HOST: '127.0.0.1',
    DISCUSSION_SEED_DEMO_DATA: 'false',
    DISCUSSION_PUBLIC_TENANT: 'default',
    DISCUSSION_DATABASE_HOST: sql.host,
    DISCUSSION_DATABASE_PORT: String(sql.port),
    DISCUSSION_DATABASE_USERNAME: sql.user,
    DISCUSSION_DATABASE_PASSWORD: password,
    DISCUSSION_DATABASE_NAME: database,
    MYSQL_HOST: sql.host,
    MYSQL_PORT: String(sql.port),
    MYSQL_USERNAME: sql.user,
    MYSQL_PASSWORD: password,
    MYSQL_DATABASE: database,
    MONGO_HOST: '127.0.0.1',
    MONGO_PORT: String(mongoPort),
    MONGO_USERNAME: 'wapps',
    MONGO_PASSWORD: password,
    MONGO_DATABASE: database,
    QUEUE_HOST: '127.0.0.1',
    QUEUE_PORT: String(queuePort),
    QUEUE_USERNAME: 'wapps',
    QUEUE_PASSWORD: password,
    DISCUSSION_STORAGE_HOST: endpoint,
    DISCUSSION_STORAGE_ACCESSKEY: 'qualification',
    DISCUSSION_STORAGE_SECRETKEY: password,
    INGRESS_AUTH_SECRET: secret,
  };
  async function request(
    origin,
    method,
    route,
    body,
    user = actor,
    key = randomUUID()
  ) {
    const response = await fetch(origin + '/api/' + route, {
      method,
      headers: { ...headers(user), 'idempotency-key': key },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    return { status: response.status, body: await response.json() };
  }
  const editorial = (method, route, body, user = actor, key) =>
    request(editorialOrigin(), method, route, body, user, key);
  const discussion = (method, route, body, user = actor, key) =>
    request(api.origin, method, route, body, user, key);
  const accepted = (result, code = 200) => {
    assert.equal(result.status, code, JSON.stringify(result.body));
    return result.body;
  };
  const content = {
    displayName: 'Public Alice',
    text: 'A comment stored through the real service.',
  };
  const fields = {
    title: 'Article comments qualification',
    slug: 'comment-article-' + randomUUID(),
    excerpt: 'Public comments follow current article visibility.',
    byline: 'Public author',
    category: 'Guides',
    tags: ['community'],
    sections: [
      {
        heading: 'Comments',
        paragraphs: ['An independently reviewed article.'],
      },
    ],
  };
  const publish = async (id) => {
    const current = accepted(
      await editorial('GET', `me/articles/${id}/publication`)
    );
    accepted(
      await editorial('POST', `me/articles/${id}/submit`, {
        expectedRevision: current.revision,
        expectedPublicationRevision: current.publicationRevision,
      }),
      201
    );
    const submission = accepted(
      await editorial(
        'GET',
        `editorial/article-reviews/${id}`,
        undefined,
        staff
      )
    );
    accepted(
      await editorial(
        'POST',
        `editorial/article-reviews/${id}/decision`,
        {
          decision: 'approve',
          expectedRevision: submission.revision,
          expectedPublicationRevision: submission.publicationRevision,
          submittedRevision: submission.latestSubmission.submittedRevision,
          reason: '',
        },
        staff
      ),
      201
    );
  };
  const withdraw = async (id) => {
    const current = accepted(
      await editorial('GET', `me/articles/${id}/publication`)
    );
    accepted(
      await editorial('POST', `me/articles/${id}/withdraw`, {
        expectedRevision: current.revision,
        expectedPublicationRevision: current.publicationRevision,
      }),
      201
    );
  };
  const restart = async () => {
    await api?.stop();
    api = await discussionProcessService(
      process.execPath,
      [
        path.join(
          root,
          'dist/sdk/features/discussion/applications/management/main.js'
        ),
      ],
      { cwd: root, env: { ...environment, EDITORIAL_URL: editorialOrigin() } },
      (diagnostic) =>
        diagnostic.match(
          /Discussion API is running on: (http:\/\/[^\s]+)\/api/
        )?.[1],
      '/api/health'
    );
  };
  const startWorker = () => {
    worker = spawn(
      process.execPath,
      [
        path.join(
          root,
          'dist/sdk/features/discussion/applications/materializer/main.js'
        ),
      ],
      { cwd: root, env: environment, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    for (const stream of [worker.stdout, worker.stderr])
      stream.on('data', (bytes) => {
        workerLog = (workerLog + bytes).slice(-16000);
      });
  };
  const stopWorker = async () => {
    if (!worker || worker.exitCode !== null || worker.signalCode !== null)
      return;
    const done = once(worker, 'exit');
    worker.kill('SIGTERM');
    const timer = setTimeout(() => worker.kill('SIGKILL'), 5000);
    try {
      await done;
    } finally {
      clearTimeout(timer);
    }
  };
  const waitThread = async (articleId, id, revision, user = null) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (worker?.exitCode !== null && worker?.exitCode !== undefined)
        throw new Error('Materializer exited: ' + workerLog);
      const result = await discussion(
        'GET',
        `article-comments/${articleId}/${id}`,
        undefined,
        user
      );
      if (result.status === 200 && result.body.revision === revision)
        return result.body;
      assert.ok(
        result.status === 503 || result.status === 200,
        JSON.stringify(result)
      );
      await delay(100);
    }
    throw new Error('Comment generation did not become visible: ' + workerLog);
  };
  try {
    await options.source.query(
      `CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
    );
    const reservation = net.createServer();
    await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    environment.OPA_URL = `http://127.0.0.1:${port}`;
    opa = await processService(
      opaBinary,
      [
        'run',
        '--server',
        '--addr',
        `127.0.0.1:${port}`,
        path.join(
          root,
          'sdk/features/identity/packages/infrastructure/opa/bundles/discussion'
        ),
      ],
      { cwd: root },
      () => environment.OPA_URL,
      '/health'
    );
    const binary = path.join(
      root,
      'dist/sdk/features/discussion/applications/management/main.js'
    );
    execFileSync(process.execPath, [binary, '--migrate'], {
      cwd: root,
      env: environment,
      stdio: 'pipe',
      timeout: 30000,
    });
    source = await new DataSource({
      type: 'mysql',
      host: sql.host,
      port: sql.port,
      username: sql.user,
      password,
      database,
      synchronize: false,
    }).initialize();
    await restart();
    const draft = accepted(await editorial('POST', 'me/articles', fields), 201);
    const base = `article-comments/${draft.id}`;
    assert.equal((await discussion('GET', base, undefined, null)).status, 404);
    assert.equal((await discussion('POST', base, content)).status, 404);
    await publish(draft.id);
    assert.equal(
      (
        await editorial(
          'GET',
          `catalog/articles/${fields.slug}`,
          undefined,
          null
        )
      ).status,
      503
    );
    accepted(
      await editorial(
        'GET',
        `catalog/article-visibility/${draft.id}`,
        undefined,
        null
      )
    );
    assert.deepEqual(accepted(await discussion('GET', base, undefined, null)), {
      items: [],
      next: null,
    });
    pass(
      'comment eligibility comes from current canonical publication even with no article projection; private/unpublished parents are denied'
    );

    const key = randomUUID();
    const [a, b] = await Promise.all([
      discussion('POST', base, content, actor, key),
      discussion('POST', base, content, actor, key),
    ]);
    const created = accepted(a, 201);
    assert.deepEqual(accepted(b, 201), created);
    assert.equal(created.projection, 'pending');
    assert.equal(
      Number(
        (
          await source.query(
            'SELECT COUNT(*) total FROM discussion_write_aggregates'
          )
        )[0].total
      ),
      1
    );
    assert.equal(
      (await discussion('GET', `${base}/${created.id}`, undefined, null))
        .status,
      503
    );
    await restart();
    assert.deepEqual(
      accepted(await discussion('POST', base, content, actor, key), 201),
      created
    );
    assert.equal(
      (
        await discussion(
          'POST',
          base,
          { ...content, text: 'different intent' },
          actor,
          key
        )
      ).status,
      409
    );
    startWorker();
    let thread = await waitThread(draft.id, created.id, 1, actor);
    assert.equal(thread.comments[0].editable, true);
    assert.equal(thread.comments[0].content.text, content.text);
    const publicThread = accepted(
      await discussion('GET', `${base}/${created.id}`, undefined, null)
    );
    assert.equal(publicThread.comments[0].editable, false);
    assert.ok(!JSON.stringify(publicThread).includes(actor.identityId));
    pass(
      'concurrent exact command replay converges, survives API restart, and real outbox/broker/materializer delivery exposes only public content'
    );

    assert.equal((await discussion('POST', base, content, null)).status, 401);
    assert.equal(
      (
        await discussion('GET', base, undefined, {
          ...moderator,
          tenantId: 'other',
        })
      ).status,
      404
    );
    assert.equal(
      (
        await discussion('POST', base, {
          ...content,
          ownerIdentityId: 'forged',
        })
      ).status,
      400
    );
    for (const [method, route, body] of [
      ['GET', `discussions/${created.id}`, undefined],
      ['POST', `discussions/${created.id}/comments`, { content }],
      ['PUT', `discussions/${created.id}`, { content, expectedRevision: 1 }],
      ['DELETE', `discussions/${created.id}`, { expectedRevision: 1 }],
      [
        'POST',
        `article-comments/${randomUUID()}/${created.id}/replies`,
        content,
      ],
    ])
      assert.equal(
        (await discussion(method, route, body, moderator)).status,
        404
      );
    assert.ok(
      !JSON.stringify(
        accepted(await discussion('GET', 'discussions', undefined, null))
      ).includes(created.id)
    );
    assert.equal(
      (
        await discussion(
          'PUT',
          `${base}/${created.id}`,
          { content, expectedRevision: 1 },
          other
        )
      ).status,
      403
    );
    assert.equal(
      (
        await discussion(
          'PUT',
          `${base}/${created.id}`,
          { content, expectedRevision: 1 },
          moderator
        )
      ).status,
      403
    );
    pass(
      'anonymous writes, cross-tenant/admin scope, forged fields, wrong article links and direct discussion-route bypasses are denied'
    );

    const reply = accepted(
      await discussion(
        'POST',
        `${base}/${created.id}/replies`,
        { displayName: 'Public Bob', text: 'A persisted reply' },
        other
      ),
      201
    );
    thread = await waitThread(draft.id, created.id, reply.revision, actor);
    assert.equal(thread.comments.length, 2);
    assert.equal(thread.comments[1].editable, false);
    assert.equal(
      (
        await discussion('PUT', `${base}/${created.id}`, {
          content: { ...content, text: 'stale' },
          expectedRevision: 1,
        })
      ).status,
      409
    );
    const edit = accepted(
      await discussion('PUT', `${base}/${created.id}`, {
        content: { ...content, text: 'An edited comment' },
        expectedRevision: thread.revision,
      })
    );
    thread = await waitThread(draft.id, created.id, edit.revision);
    assert.equal(thread.comments[0].content.text, 'An edited comment');
    const removalKey = randomUUID();
    const removed = accepted(
      await discussion(
        'DELETE',
        `${base}/${reply.id}`,
        { expectedRevision: thread.revision },
        moderator,
        removalKey
      )
    );
    thread = await waitThread(draft.id, created.id, removed.revision);
    assert.equal(thread.comments[1].content, null);
    assert.equal(thread.replyCount, 1, 'Redacted replies remain discoverable');
    assert.deepEqual(
      accepted(
        await discussion(
          'DELETE',
          `${base}/${reply.id}`,
          { expectedRevision: edit.revision },
          moderator,
          removalKey
        )
      ),
      removed
    );
    pass(
      'author edits detect conflicts; replies persist; moderation creates redacted structural placeholders and durable historical receipts'
    );

    const totals = async () =>
      (
        await source.query(
          'SELECT (SELECT COUNT(*) FROM discussion_write_aggregates) roots, (SELECT COUNT(*) FROM discussion_commands) commands, (SELECT COUNT(*) FROM discussion_outbox) outbox'
        )
      )[0];
    const before = await totals();
    await source.query(
      "CREATE TRIGGER reject_comment_receipt BEFORE INSERT ON discussion_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification rollback'"
    );
    const rollbackKey = randomUUID();
    try {
      assert.equal(
        (
          await discussion(
            'POST',
            base,
            { ...content, text: 'Rollback and retry' },
            actor,
            rollbackKey
          )
        ).status,
        503
      );
    } finally {
      await source.query('DROP TRIGGER reject_comment_receipt');
    }
    assert.deepEqual(await totals(), before);
    const recovered = accepted(
      await discussion(
        'POST',
        base,
        { ...content, text: 'Rollback and retry' },
        actor,
        rollbackKey
      ),
      201
    );
    await waitThread(draft.id, recovered.id, 1);
    pass(
      'a failed receipt insert rolls back the root, target binding, revision and outbox; exact retry recovers without a partial visible write'
    );

    for (let index = 0; index < 10; index++) {
      const added = accepted(
        await discussion('POST', base, {
          ...content,
          text: `Pagination comment ${index}`,
        }),
        201
      );
      await waitThread(draft.id, added.id, 1);
    }
    const page = accepted(await discussion('GET', base, undefined, null));
    assert.equal(page.items.length, 10);
    assert.ok(page.next);
    assert.ok(page.items.every((item) => item.comments.length === 1));
    const second = accepted(
      await discussion(
        'GET',
        `${base}?cursor=${encodeURIComponent(page.next)}`,
        undefined,
        null
      )
    );
    assert.equal(second.items.length, 2);
    assert.equal(second.next, null);
    assert.equal(
      new Set([...page.items, ...second.items].map((item) => item.id)).size,
      12
    );
    assert.equal(
      (await discussion('GET', `${base}?cursor=invalid`, undefined, null))
        .status,
      400
    );
    pass(
      'canonical bounded keyset pagination returns distinct roots and loads reply bodies only when a thread is opened'
    );

    await stopWorker();
    await mongo
      .db(database)
      .collection('discussion_generation_nodes')
      .deleteMany({});
    await mongo
      .db(database)
      .collection('discussion_generation_heads')
      .deleteMany({});
    assert.equal((await discussion('GET', base, undefined, null)).status, 503);
    execFileSync(
      process.execPath,
      [
        path.join(
          root,
          'dist/sdk/features/discussion/applications/materializer/main.js'
        ),
        '--rebuild',
      ],
      { cwd: root, env: environment, stdio: 'pipe', timeout: 30000 }
    );
    startWorker();
    thread = await waitThread(draft.id, created.id, removed.revision);
    assert.equal(thread.comments[1].content, null);
    await options.restartEditorial();
    await restart();
    assert.equal(
      (await waitThread(draft.id, created.id, removed.revision)).comments[0]
        .content.text,
      'An edited comment'
    );
    pass(
      'dropping every discussion projection and rebuilding through the real broker restores edited text and deletion placeholders across both API restarts'
    );

    await withdraw(draft.id);
    assert.equal((await discussion('GET', base, undefined, null)).status, 404);
    assert.equal(
      (await discussion('GET', `${base}/${created.id}`, undefined, moderator))
        .status,
      404
    );
    const withdrawnBefore = await totals();
    assert.equal((await discussion('POST', base, content)).status, 404);
    assert.equal(
      (await discussion('POST', `${base}/${created.id}/replies`, content))
        .status,
      404
    );
    assert.deepEqual(await totals(), withdrawnBefore);
    await publish(draft.id);
    accepted(await discussion('GET', `${base}/${created.id}`, undefined, null));
    pass(
      'withdrawal immediately hides retained comment generations and denies new writes; republishing the same canonical article restores its thread association'
    );

    if (process.argv.includes('--comment-browser')) {
      const browserFields = {
        ...fields,
        title: 'Community comments',
        slug: 'browser-comments-' + randomUUID(),
      };
      const browserDraft = accepted(
        await editorial('POST', 'me/articles', {
          ...browserFields,
        }),
        201
      );
      await publish(browserDraft.id);
      const {
        projectEditorialSnapshot,
      } = require('../../apps/services/editorial/src/app/application/editorial-materialization');
      const materialize = () =>
        options.reader
          .read('article', browserDraft.id)
          .then((snapshot) =>
            options.projections.publish(projectEditorialSnapshot(snapshot))
          );
      await materialize();
      await options.projections.publish(
        projectEditorialSnapshot(await options.reader.read('article', draft.id))
      );
      await require('./article-comments-browser.cjs').articleCommentsBrowser({
        root,
        output,
        source: options.source,
        article: { ...browserDraft, slug: browserFields.slug },
        origin: editorialOrigin,
        discussionOrigin: () => api.origin,
        headers: (uid, tenantId = 'default', roles = []) =>
          headers(uid ? { identityId: uid, tenantId, roles } : null),
        discussionHeaders: (uid, roles = []) =>
          headers(uid ? { identityId: uid, tenantId: 'default', roles } : null),
        discussion,
        accepted,
        waitThread,
        restart,
        startWorker,
        stopWorker,
        withdraw: () => withdraw(browserDraft.id),
        republish: async () => {
          await publish(browserDraft.id);
          await materialize();
        },
      });
      pass(
        'compiled comment portal: independent members, public reading, revision conflicts, moderation, identical retry across navigation, session isolation, projection lag, restart, pagination and withdrawal in responsive themes'
      );
    }

    const runner = source.createQueryRunner();
    try {
      await new DiscussionArticleTargets1791676822000().up(runner);
      await source.query(
        "UPDATE discussion_write_aggregates SET subjectKind = 'unsupported' WHERE id = ?",
        [created.id]
      );
      await assert.rejects(
        () => new DiscussionArticleTargets1791676822000().up(runner),
        /Inconsistent/
      );
      await source.query(
        "UPDATE discussion_write_aggregates SET subjectKind = 'article' WHERE id = ?",
        [created.id]
      );
      await new DiscussionArticleTargets1791676822000().up(runner);
      await assert.rejects(
        () => new DiscussionArticleTargets1791676822000().down(),
        /authoritative/
      );
    } finally {
      await runner.release();
    }
    await opa.stop();
    const policyBefore = await totals();
    assert.equal((await discussion('POST', base, content)).status, 503);
    assert.deepEqual(await totals(), policyBefore);
    pass(
      'populated migration reentry validates immutable target scope, rejects corrupt bindings and destructive rollback; policy outage performs no writes'
    );
  } finally {
    await stopWorker();
    await api?.stop();
    await opa?.stop();
    await source?.destroy();
    fs.writeFileSync(
      path.join(output, 'discussion-materializer.log'),
      workerLog
    );
  }
}

module.exports = { articleCommentsChecks };
