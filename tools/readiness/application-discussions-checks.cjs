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

async function applicationDiscussionsChecks(options) {
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
    'sdk/features/discussion/applications/management/service/src/app/discussions'
  );
  const load = (name) => require(path.join(management, name));
  const { DiscussionApplicationTargets1791676823000 } = load(
    'infrastructure/discussion-application-targets.migration'
  );
  const database = 'application_discussions';
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
    text: 'A topic stored through the real service.',
    title: 'An application topic',
    tags: ['community'],
  };
  const fields = {
    classification: 'general',
    name: 'Application discussions qualification',
    slug: 'discussion-app-' + randomUUID(),
    website: 'https://discussion.example.test/',
    description: 'Public topics follow current application visibility.',
  };
  const publish = async (id) => {
    const current = accepted(
      await editorial('GET', `me/application-drafts/${id}/publication`)
    );
    accepted(
      await editorial('POST', `me/application-drafts/${id}/submit`, {
        expectedRevision: current.revision,
      }),
      201
    );
    const submission = accepted(
      await editorial(
        'GET',
        `editorial/application-reviews/${id}`,
        undefined,
        staff
      )
    );
    accepted(
      await editorial(
        'POST',
        `editorial/application-reviews/${id}/decision`,
        {
          decision: 'approve',
          expectedRevision: submission.revision,
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
      await editorial('GET', `me/application-drafts/${id}/publication`)
    );
    accepted(
      await editorial('POST', `me/application-drafts/${id}/withdraw`, {
        expectedRevision: current.revision,
      }),
      201
    );
  };
  const restart = async (configuration = {}) => {
    await api?.stop();
    api = await processService(
      process.execPath,
      [
        path.join(
          root,
          'dist/sdk/features/discussion/applications/management/main.js'
        ),
      ],
      {
        cwd: root,
        env: {
          ...environment,
          EDITORIAL_URL: configuration.editorialOrigin ?? editorialOrigin(),
          INGRESS_AUTH_SECRET: configuration.ingressSecret ?? secret,
        },
      },
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
  const waitThread = async (applicationId, id, revision, user = null) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (worker?.exitCode !== null && worker?.exitCode !== undefined)
        throw new Error('Materializer exited: ' + workerLog);
      const result = await discussion(
        'GET',
        `application-discussions/${applicationId}/${id}`,
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
    const draft = accepted(
      await editorial('POST', 'me/application-drafts', fields),
      201
    );
    const base = `application-discussions/${draft.id}`;
    assert.equal((await discussion('GET', base, undefined, null)).status, 404);
    assert.equal((await discussion('POST', base, content)).status, 404);
    await publish(draft.id);
    assert.equal(
      (await editorial('GET', `catalog/apps/${fields.slug}`, undefined, null))
        .status,
      503
    );
    accepted(
      await editorial(
        'GET',
        `catalog/application-visibility/${draft.id}`,
        undefined,
        null
      )
    );
    assert.deepEqual(accepted(await discussion('GET', base, undefined, null)), {
      items: [],
      next: null,
    });
    pass(
      'topic eligibility comes from current canonical publication even with no application projection; private/unpublished parents are denied'
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
      ['GET', `article-comments/${draft.id}/${created.id}`, undefined],
      ['POST', `discussions/${created.id}/comments`, { content }],
      ['PUT', `discussions/${created.id}`, { content, expectedRevision: 1 }],
      ['DELETE', `discussions/${created.id}`, { expectedRevision: 1 }],
      [
        'POST',
        `application-discussions/${randomUUID()}/${created.id}/replies`,
        { displayName: content.displayName, text: content.text },
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
      'anonymous writes, cross-tenant/admin scope, forged fields, wrong application links and direct discussion-route bypasses are denied'
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
        content: {
          ...content,
          title: 'An edited topic',
          tags: ['updated'],
          text: 'An edited comment',
        },
        expectedRevision: thread.revision,
      })
    );
    thread = await waitThread(draft.id, created.id, edit.revision);
    assert.equal(thread.comments[0].content.text, 'An edited comment');
    assert.equal(thread.title, 'An edited topic');
    assert.deepEqual(thread.tags, ['updated']);
    assert.equal(
      (await discussion('POST', `${base}/${created.id}/replies`, content))
        .status,
      400
    );
    assert.equal(
      (
        await discussion('PUT', `${base}/${created.id}`, {
          content: { displayName: content.displayName, text: content.text },
          expectedRevision: thread.revision,
        })
      ).status,
      400
    );
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
      "CREATE TRIGGER reject_topic_outbox BEFORE INSERT ON discussion_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification rollback'"
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
      await source.query('DROP TRIGGER reject_topic_outbox');
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
      'a failed outbox insert rolls back the root, target binding, revision and outbox; exact retry recovers without a partial visible write'
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
      (
        await discussion('POST', `${base}/${created.id}/replies`, {
          displayName: content.displayName,
          text: content.text,
        })
      ).status,
      404
    );
    assert.deepEqual(await totals(), withdrawnBefore);
    await publish(draft.id);
    accepted(await discussion('GET', `${base}/${created.id}`, undefined, null));
    pass(
      'withdrawal immediately hides retained discussion generations and denies new writes; republishing the same canonical application restores its thread association'
    );

    await options.source.query(
      'UPDATE app_records SET isSuspended = 1 WHERE id = ?',
      [draft.id]
    );
    const suspendedBefore = await totals();
    assert.equal((await discussion('GET', base, undefined, null)).status, 404);
    assert.equal((await discussion('POST', base, content)).status, 404);
    assert.deepEqual(await totals(), suspendedBefore);
    await options.source.query(
      'UPDATE app_records SET isSuspended = 0 WHERE id = ?',
      [draft.id]
    );
    accepted(await discussion('GET', `${base}/${created.id}`, undefined, null));
    pass(
      'controlled canonical application suspension denies reads/writes despite retained discussion projections; restoring authority restores access'
    );

    if (process.argv.includes('--my-discussions')) {
      await require('./my-discussions-checks.cjs').myDiscussionsChecks({
        discussion,
        accepted,
        actor,
        other,
        moderator,
        applicationId: draft.id,
        rootId: created.id,
        content,
        waitThread,
        restart,
        source,
        pass,
        headers,
        origin: () => api.origin,
        stopWorker,
        startWorker,
        withdraw: () => withdraw(draft.id),
        republish: () => publish(draft.id),
        dropProjections: async () => {
          await mongo
            .db(database)
            .collection('discussion_generation_nodes')
            .deleteMany({});
          await mongo
            .db(database)
            .collection('discussion_generation_heads')
            .deleteMany({});
        },
        rebuild: () =>
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
          ),
        migrate: () =>
          execFileSync(process.execPath, [binary, '--migrate'], {
            cwd: root,
            env: environment,
            stdio: 'pipe',
            timeout: 30000,
          }),
      });
    }

    if (
      process.argv.includes('--topic-browser') ||
      process.argv.includes('--my-discussions-browser') ||
      process.argv.includes('--quick-discussion-browser') ||
      process.argv.includes('--discussion-favorites') ||
      process.argv.includes('--discussion-votes') ||
      process.argv.includes('--discussion-pins') ||
      process.argv.includes('--discussion-previews') ||
      process.argv.includes('--member-reviews')
    ) {
      const browserFields = {
        ...fields,
        name: 'Community discussions',
        slug: 'browser-comments-' + randomUUID(),
      };
      const browserDraft = accepted(
        await editorial('POST', 'me/application-drafts', {
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
          .read('app', browserDraft.id)
          .then((snapshot) =>
            options.projections.publish(projectEditorialSnapshot(snapshot))
          );
      await materialize();
      await options.projections.publish(
        projectEditorialSnapshot(await options.reader.read('app', draft.id))
      );
      const browserQualification = process.argv.includes(
        '--discussion-previews'
      )
        ? require('./discussion-previews-browser.cjs').discussionPreviewsBrowser
        : process.argv.includes('--member-reviews')
        ? require('./member-reviews-checks.cjs').memberReviewsChecks
        : process.argv.includes('--discussion-pins')
        ? require('./discussion-pins-checks.cjs').discussionPinsChecks
        : process.argv.includes('--discussion-votes')
        ? require('./discussion-votes-checks.cjs').discussionVotesChecks
        : process.argv.includes('--discussion-favorites')
        ? require('./discussion-favorites-checks.cjs').discussionFavoritesChecks
        : process.argv.includes('--quick-discussion-browser')
        ? require('./quick-discussion-browser.cjs').quickDiscussionBrowser
        : process.argv.includes('--my-discussions-browser')
        ? require('./my-discussions-browser.cjs').myDiscussionsBrowser
        : require('./application-discussions-browser.cjs')
            .applicationDiscussionsBrowser;
      await browserQualification({
        root,
        mongo,
        output,
        source: options.source,
        discussionSource: source,
        eraseReviews: async (identityId) => {
          const invokeInventory = (...args) =>
            JSON.parse(
              execFileSync(
                process.execPath,
                [binary, '--inventory-payloads', ...args],
                {
                  cwd: root,
                  env: environment,
                  encoding: 'utf8',
                  timeout: 30000,
                }
              )
                .trim()
                .split('\n')
                .findLast((line) => line.startsWith('{'))
            );
          for (let page = 0; page < 64; page++) {
            const [progress] = await source.query(
              'SELECT completedAt FROM discussion_payload_inventory'
            );
            if (progress.completedAt !== null) break;
            const plan = invokeInventory();
            const applied = invokeInventory(
              '--apply',
              plan.fingerprint,
              '--legacy-writers-stopped'
            );
            if (applied.progress.completedAt !== null) break;
            assert.ok(page < 63, 'Fixture inventory did not complete');
          }
          const {
            MysqlAccountErasureParticipant,
          } = require('../../sdk/features/identity/packages/infrastructure/mysql/src');
          const {
            MysqlReviewErasure,
          } = require('../../sdk/features/discussion/applications/management/service/src/app/reviews/infrastructure/mysql-review-erasure');
          const request = { identityId, revision: 1 };
          await new MysqlAccountErasureParticipant(
            'discussion',
            source
          ).request(request);
          const worker = new MysqlReviewErasure(source);
          for (let step = 0; step < 100; step++) {
            if ((await worker.advance(request)) === 'drained') return;
            assert.ok(step < 99, 'Fixture review cleanup did not drain');
          }
        },
        discussionDatabase: mongo.db(database),
        rebuild: () =>
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
          ),
        migrate: () =>
          execFileSync(process.execPath, [binary, '--migrate'], {
            cwd: root,
            env: environment,
            stdio: 'pipe',
            timeout: 30000,
          }),
        sql,
        pass,
        policy: options.policy,
        reader: options.reader,
        projections: options.projections,
        application: { ...browserDraft, slug: browserFields.slug },
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
        classify: async (classification) => {
          const current = accepted(
            await editorial('GET', `me/application-drafts/${browserDraft.id}`)
          );
          accepted(
            await editorial('PUT', `me/application-drafts/${browserDraft.id}`, {
              ...browserFields,
              classification,
              expectedRevision: current.revision,
            })
          );
          await publish(browserDraft.id);
          await materialize();
        },
      });
      pass(
        process.argv.includes('--discussion-previews')
          ? 'compiled discussion previews: canonical overview/related topics, keyboard links, independent composer state, projection recovery and current deletion/parent visibility'
          : process.argv.includes('--member-reviews')
          ? 'compiled member reviews: durable ratings, authoring, helpful marks, reports, independent moderation, exact retries, conflicts, restart and responsive themes'
          : process.argv.includes('--discussion-pins')
          ? 'compiled discussion pinning: tenant-admin authority, canonical ordering, atomic revision/outbox, exact retries/conflicts, independent browsers, restart/rebuild and responsive themes'
          : process.argv.includes('--discussion-votes')
          ? 'compiled discussion voting: canonical actor choices and counts, atomic revisions/outbox, independent browsers, exact retry, conflicts, switching/removal, recovery and responsive themes'
          : process.argv.includes('--discussion-favorites')
          ? 'compiled discussion favorites: current topic/parent eligibility, durable account relations, independent browsers, exact retry, conflicts, removal, outages and responsive themes'
          : process.argv.includes('--quick-discussion-browser')
          ? 'compiled quick discussion dialog: real reads/replies/edits/moderation, exact retry after reopening, session isolation, navigation, private-list refresh, visibility, outages and responsive focus/scroll'
          : process.argv.includes('--my-discussions-browser')
          ? 'compiled My Discussions portal: account ownership/participation, catalog links, bounded paging, independent sessions, switching, deletion, lag, restart and withdrawal in responsive themes'
          : 'compiled discussion portal: independent members, public reading, revision conflicts, moderation, identical retry across navigation, session isolation, projection lag, restart, pagination and withdrawal in responsive themes'
      );
    }

    const runner = source.createQueryRunner();
    try {
      await new DiscussionApplicationTargets1791676823000().up(runner);
      await source.query(
        'ALTER TABLE discussion_write_aggregates DROP INDEX idx_discussion_article_page, ADD INDEX idx_discussion_article_page (subjectKind, tenantId, subjectId, createdAt, id)'
      );
      await assert.rejects(
        () => new DiscussionApplicationTargets1791676823000().up(runner),
        /Incompatible discussion target index/
      );
      await source.query(
        'ALTER TABLE discussion_write_aggregates DROP INDEX idx_discussion_article_page, ADD INDEX idx_discussion_article_page (tenantId, subjectKind, subjectId, createdAt, id)'
      );
      await source.query(
        "UPDATE discussion_write_aggregates SET subjectKind = 'unsupported' WHERE id = ?",
        [created.id]
      );
      await assert.rejects(
        () => new DiscussionApplicationTargets1791676823000().up(runner),
        /Inconsistent/
      );
      await source.query(
        "UPDATE discussion_write_aggregates SET subjectKind = 'application' WHERE id = ?",
        [created.id]
      );
      await new DiscussionApplicationTargets1791676823000().up(runner);
      await assert.rejects(
        () => new DiscussionApplicationTargets1791676823000().down(),
        /authoritative/
      );
    } finally {
      await runner.release();
    }
    await api.stop();
    await source.query('DELETE FROM migrations WHERE name = ?', [
      'DiscussionApplicationTargets1791676823000',
    ]);
    await assert.rejects(restart, /--migrate/i);
    execFileSync(process.execPath, [binary, '--migrate'], {
      cwd: root,
      env: environment,
      stdio: 'pipe',
      timeout: 30000,
    });
    await restart();
    accepted(await discussion('GET', `${base}/${created.id}`, undefined, null));
    pass(
      'an unrecorded protocol upgrade blocks normal startup; explicit migration preserves populated application topics and article-compatible schema'
    );
    await withdraw(draft.id);
    const deleting = accepted(
      await editorial('GET', `me/application-drafts/${draft.id}/publication`)
    );
    accepted(
      await editorial('DELETE', `me/application-drafts/${draft.id}`, {
        expectedRevision: deleting.revision,
      })
    );
    assert.equal(
      (await discussion('GET', `${base}/${created.id}`, undefined, null))
        .status,
      404
    );
    assert.equal((await discussion('POST', base, content)).status, 404);
    pass(
      'canonical parent withdrawal followed by private-draft deletion never exposes retained discussion text or permits new posts'
    );
    await opa.stop();
    if (process.argv.includes('--my-discussions'))
      assert.equal((await discussion('GET', 'me/discussions')).status, 503);
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

module.exports = { applicationDiscussionsChecks };
