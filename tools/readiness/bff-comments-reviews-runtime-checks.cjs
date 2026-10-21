const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const execute = promisify(execFile);

async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE,
    project = process.env.WAPPS_BFF_COMPOSE_PROJECT,
    report = process.env.WAPPS_BFF_REPORT;
  assert.ok(compose && project && report && process.env.WAPPS_BFF_ACCOUNTS);
  assert.ok(
    !existsSync(report) && !existsSync(report + '.accounts.json'),
    'Use a fresh evidence path'
  );
  const users = [],
    applications = [],
    topics = [],
    articles = [],
    reviews = [],
    checks = [],
    erased = [],
    cleanupErrors = [],
    stopped = new Set();
  let staff, failure;
  function persist() {
    writeFileSync(report + '.accounts.json', JSON.stringify(users, null, 2), {
      mode: 0o600,
    });
    writeFileSync(
      report,
      JSON.stringify(
        {
          checks,
          applications,
          topics,
          articles,
          reviews,
          erased,
          disposableIdentities: users.map((user) => user.uid),
          failure: failure?.message,
          cleanupErrors: cleanupErrors.map((error) => error.message),
        },
        null,
        2
      ),
      { mode: 0o600 }
    );
  }
  function pass(name) {
    checks.push(name);
    persist();
    console.log('PASS ' + name);
  }
  async function call(
    path,
    {
      user = users[0],
      method = 'GET',
      body,
      key,
      headers = {},
      status = 200,
    } = {}
  ) {
    const response = await fetch(new URL(path, origin), {
      method,
      headers: {
        ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(40000),
    });
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      `${method} ${path}: HTTP ${response.status}, expected ${status}`
    );
    if (response.ok && path.startsWith('/api/'))
      assert.ok(response.headers.get('cache-control')?.includes('no-store'));
    const text = await response.text();
    return {
      response,
      value:
        text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : null,
    };
  }
  const read = (path, user = users[0]) =>
    call(path, { user }).then((result) => result.value);
  const command = (
    path,
    body,
    {
      user = users[0],
      method = 'POST',
      key = randomUUID(),
      status = method === 'POST' ? 201 : 200,
      ...options
    } = {}
  ) =>
    call(path, { ...options, user, method, key, body, status }).then(
      (result) => result.value
    );
  async function until(readValue, label) {
    let last;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        return await readValue();
      } catch (error) {
        last = error;
        await delay(500);
      }
    }
    throw new Error(label, { cause: last });
  }
  async function service(action, name) {
    if (action === 'stop') stopped.add(name);
    await execute(
      'docker',
      ['compose', '-f', compose, '-p', project, action, name],
      { timeout: 45000, maxBuffer: 65536 }
    );
    if (action === 'start') stopped.delete(name);
  }
  const cbase = (articleId) => '/api/article-comments/' + articleId;
  const rbase = (applicationId) => '/api/application-reviews/' + applicationId;
  async function waitThread(articleId, id, revision, user = users[0]) {
    return until(async () => {
      const value = await read(cbase(articleId) + '/' + id, user);
      assert.equal(value.revision, revision);
      return value;
    }, 'Comment generation did not converge');
  }
  async function createComment(articleId, content, key = randomUUID()) {
    const result = await command(cbase(articleId), content, { key });
    if (!topics.some((topic) => topic.id === result.id))
      topics.push({ articleId, id: result.id });
    persist();
    return result;
  }
  async function publishApp(id) {
    const draft = await read('/api/me/application-drafts/' + id);
    await command(`/api/me/application-drafts/${id}/submit`, {
      expectedRevision: draft.revision,
    });
    const review = await read(
      `/api/editorial/application-reviews/${id}`,
      staff
    );
    await command(
      `/api/editorial/application-reviews/${id}/decision`,
      {
        decision: 'approve',
        expectedRevision: review.revision,
        submittedRevision: review.latestSubmission.submittedRevision,
        reason: '',
      },
      { user: staff }
    );
  }
  async function application() {
    const fields = {
      name: 'BFF reviews ' + randomUUID().slice(0, 8),
      slug: 'bff-reviews-' + randomUUID(),
      website: 'https://review.example.test',
      description: 'Disposable application for BFF qualification.',
      classification: 'general',
    };
    const created = await command('/api/me/application-drafts', fields);
    applications.push({ id: created.id, slug: fields.slug });
    persist();
    await publishApp(created.id);
    await until(
      () => read('/api/catalog/apps/' + fields.slug, null),
      'Application did not materialize'
    );
    return created.id;
  }
  async function articlePublication(id, action) {
    assert.ok(articles.some((article) => article.id === id));
    const state = await read(`/api/me/articles/${id}/publication`);
    const reviewing = action === 'approve';
    return command(
      reviewing
        ? `/api/editorial/article-reviews/${id}/decision`
        : `/api/me/articles/${id}/${action}`,
      {
        expectedRevision: state.revision,
        expectedPublicationRevision: state.publicationRevision,
        ...(reviewing
          ? {
              decision: action,
              submittedRevision: state.latestSubmission.submittedRevision,
              reason: 'Independent qualification review.',
            }
          : {}),
      },
      { user: reviewing ? staff : users[0] }
    );
  }
  async function article() {
    const fields = {
      title: 'BFF comments ' + randomUUID(),
      slug: 'bff-comments-' + randomUUID(),
      excerpt: 'Comment qualification.',
      byline: 'Disposable author',
      category: 'Guides',
      tags: ['qualification'],
      classification: 'general',
      sections: [
        { heading: 'Article', paragraphs: ['Disposable public article.'] },
      ],
    };
    const created = await command('/api/me/articles', fields);
    articles.push({ id: created.id, slug: fields.slug });
    persist();
    await articlePublication(created.id, 'submit');
    await articlePublication(created.id, 'approve');
    await until(
      () => read('/api/catalog/articles/' + fields.slug, null),
      'Article did not materialize'
    );
    return created.id;
  }
  async function projection(id) {
    assert.ok(
      topics.some((topic) => topic.id === id),
      "Observe only this run's projection"
    );
    const script = `const {MongoClient}=require('mongodb');(async()=>{const e=process.env;const c=new MongoClient('mongodb://'+encodeURIComponent(e.MONGO_USERNAME)+':'+encodeURIComponent(e.MONGO_PASSWORD)+'@'+e.MONGO_HOST+':'+e.MONGO_PORT,{serverSelectionTimeoutMS:3000});try{await c.connect();const p=await c.db(e.MONGO_DATABASE).collection('discussion_generation_heads').findOne({_id:process.argv[1]},{projection:{_id:0,revision:1,deletedAt:1}});console.log(JSON.stringify(p));}finally{await c.close();}})().catch(()=>{console.error('Projection observation failed');process.exitCode=1;});`;
    const result = await execute(
      'docker',
      [
        'compose',
        '-f',
        compose,
        '-p',
        project,
        'exec',
        '-T',
        'discussion',
        'node',
        '-e',
        script,
        id,
      ],
      { timeout: 10000, maxBuffer: 4096 }
    );
    return JSON.parse(result.stdout);
  }
  try {
    const existing = JSON.parse(
      readFileSync(process.env.WAPPS_BFF_ACCOUNTS, 'utf8')
    );
    staff = await command(
      '/auth/signin',
      { email: existing.staff.email, password: existing.staff.password },
      { user: null, status: 200 }
    );
    assert.equal(staff.uid, existing.staff.uid);
    for (const nickname of ['BFF Community Author', 'BFF Community Peer']) {
      const user = {
        email: 'bff-community-' + randomUUID() + '@wapps-review.test',
        password: randomUUID() + '!Aa1',
        nickname,
        registrationKey: randomUUID(),
      };
      users.push(user);
      persist();
      Object.assign(
        user,
        await command(
          '/auth/register',
          {
            email: user.email,
            password: user.password,
            passwordConfirmation: user.password,
            nickname,
          },
          { user: null, key: user.registrationKey, status: 200 }
        )
      );
      assert.ok(user.uid && user.token);
      persist();
    }
    const appId = await application(),
      otherAppId = await application();
    const articleId = await article(),
      otherArticleId = await article();
    const content = { displayName: 'Public Author', text: 'Initial comment.' };
    const createKey = randomUUID(),
      created = await createComment(articleId, content, createKey);
    const id = created.id,
      path = cbase(articleId) + '/' + id;
    let current = await waitThread(articleId, id, 1);
    assert.equal(current.comments[0].editable, true);
    assert.deepEqual(
      await command(cbase(articleId), content, { key: createKey }),
      created
    );
    await command(
      cbase(articleId),
      { ...content, text: 'Changed request' },
      { key: createKey, status: 409 }
    );
    const independent = await command(
      '/auth/signin',
      { email: users[0].email, password: users[0].password },
      { user: null, status: 200 }
    );
    assert.equal((await read(path, independent)).comments[0].editable, true);
    assert.equal((await read(path, users[1])).comments[0].editable, false);
    assert.equal((await read(path, null)).comments[0].removable, false);
    await command(cbase(articleId), content, { user: null, status: 401 });
    for (const user of [users[1], staff])
      await command(
        path,
        { content, expectedRevision: 1 },
        { method: 'PUT', user, status: 403 }
      );
    await command(
      path,
      { expectedRevision: 1 },
      { method: 'DELETE', user: users[1], status: 403 }
    );
    await call(cbase(otherArticleId) + '/' + id, { status: 404 });
    await command(cbase(otherArticleId) + '/' + id + '/replies', content, {
      status: 404,
    });
    await call('/api/discussions/' + id, { status: 404 });
    await command(
      path,
      { expectedRevision: 1 },
      {
        method: 'DELETE',
        user: users[1],
        status: 403,
        headers: {
          'X-User-Id': staff.uid,
          'X-User-Claims': '{"roles":["admin"]}',
          'X-Ingress-Auth': 'forged',
        },
      }
    );
    for (const route of [
      cbase(articleId) + '?cursor=bad',
      cbase(articleId) + '?tenant=other',
      rbase(appId) + '?cursor=bad',
    ])
      await call(route, { status: 400 });
    pass(
      'comment public/member reads, independent sign-in, author-only editing, parent isolation, generic route isolation, spoofing denial and durable replay'
    );

    const replied = await command(
      path + '/replies',
      { displayName: 'Public Peer', text: 'Peer reply.' },
      { user: users[1] }
    );
    const nested = await command(
      cbase(articleId) + '/' + replied.id + '/replies',
      { ...content, text: 'Nested answer.' }
    );
    current = await waitThread(articleId, id, nested.revision);
    assert.equal(current.replyCount, 2);
    assert.equal(
      current.comments.find((post) => post.id === nested.id).depth,
      2
    );
    const editBody = {
        content: { ...content, text: '\u754c'.repeat(4000) },
        expectedRevision: current.revision,
      },
      editKey = randomUUID();
    const edited = await command(path, editBody, {
      method: 'PUT',
      key: editKey,
    });
    assert.deepEqual(
      await command(path, editBody, { method: 'PUT', key: editKey }),
      edited
    );
    await command(path, editBody, { method: 'PUT', status: 409 });
    const removed = await command(
      cbase(articleId) + '/' + replied.id,
      { expectedRevision: edited.revision },
      { method: 'DELETE', user: staff }
    );
    current = await waitThread(articleId, id, removed.revision);
    assert.equal(current.comments[0].content.text.length, 4000);
    assert.equal(current.replyCount, 2);
    const redacted = current.comments.find((post) => post.id === replied.id);
    assert.equal(redacted.content, null);
    assert.equal(redacted.createdAt, null);
    assert.equal(redacted.editable, false);
    assert.equal(
      current.comments.find((post) => post.id === nested.id).parentId,
      replied.id
    );
    for (let i = 0; i < 10; i++) {
      const extra = await createComment(articleId, {
        ...content,
        text: 'Pagination ' + i,
      });
      await waitThread(articleId, extra.id, 1);
    }
    const first = await read(cbase(articleId), null),
      second = await read(
        cbase(articleId) + '?cursor=' + encodeURIComponent(first.next),
        null
      );
    assert.equal(first.items.length, 10);
    assert.equal(second.items.length, 1);
    assert.equal(second.next, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((item) => item.id)).size,
      11
    );
    assert.ok(first.items.every((item) => item.comments.length === 1));
    pass(
      'nested comments, 4000-character multilingual edit, stale-revision conflicts, moderator redaction with descendants and ten-root keyset pagination'
    );

    const reviewContent = {
      displayName: 'Public Author',
      rating: 4,
      text: 'A useful application.',
    };
    const publishBody = { content: reviewContent, expectedRevision: 0 },
      publishKey = randomUUID();
    const published = await command(rbase(appId) + '/mine', publishBody, {
      method: 'PUT',
      key: publishKey,
    });
    reviews.push({
      id: published.id,
      applicationId: appId,
      owner: users[0].uid,
    });
    persist();
    const rpath = rbase(appId) + '/' + published.id;
    assert.deepEqual(
      await command(rbase(appId) + '/mine', publishBody, {
        method: 'PUT',
        key: publishKey,
      }),
      published
    );
    await command(
      rbase(appId) + '/mine',
      { ...publishBody, content: { ...reviewContent, rating: 5 } },
      { method: 'PUT', key: publishKey, status: 409 }
    );
    assert.equal((await read(rbase(appId), independent)).mine.id, published.id);
    assert.equal((await read(rbase(appId), users[1])).mine, null);
    const publicReview = await read(rpath, null);
    assert.equal(publicReview.mine, false);
    assert.equal(publicReview.openReports, null);
    assert.ok(!JSON.stringify(publicReview).includes(users[0].uid));
    await call(rbase(otherAppId) + '/' + published.id, { status: 404 });
    await command(
      rpath,
      { expectedRevision: 1 },
      { method: 'DELETE', user: users[1], status: 403 }
    );
    await command(
      rpath + '/helpful',
      { expectedRevision: 1, helpful: true },
      { method: 'PUT', status: 403 }
    );
    await command(
      rpath + '/reports',
      { expectedRevision: 1, reason: 'Own report' },
      { status: 403 }
    );
    await command(rbase(appId) + '/mine', publishBody, {
      method: 'PUT',
      user: null,
      status: 401,
    });
    for (const route of [rbase(appId) + '/moderation', rpath + '/reports'])
      await call(route, { user: users[1], status: 403 });
    const peerReview = await command(
      rbase(appId) + '/mine',
      {
        content: { ...reviewContent, displayName: 'Public Peer', rating: 2 },
        expectedRevision: 0,
      },
      { method: 'PUT', user: users[1] }
    );
    reviews.push({
      id: peerReview.id,
      applicationId: appId,
      owner: users[1].uid,
    });
    persist();
    assert.deepEqual(await read(rbase(appId) + '/summary', null), {
      total: 2,
      average: 3,
      distribution: [0, 1, 0, 1, 0],
    });
    pass(
      'canonical review slots, ratings, independent sessions, exact replay/key conflicts, author and parent isolation, anonymous-write/self-vote/self-report denial and protected moderation'
    );

    const helpfulKey = randomUUID(),
      helpfulBody = { expectedRevision: 1, helpful: true };
    const helpful = await command(rpath + '/helpful', helpfulBody, {
      method: 'PUT',
      key: helpfulKey,
      user: users[1],
    });
    assert.deepEqual(
      await command(rpath + '/helpful', helpfulBody, {
        method: 'PUT',
        key: helpfulKey,
        user: users[1],
      }),
      helpful
    );
    assert.equal((await read(rpath, users[1])).helpfulCount, 1);
    assert.equal((await read(rpath, users[1])).helpful, true);
    assert.equal((await read(rpath)).helpful, false);
    await command(
      rpath + '/helpful',
      { expectedRevision: helpful.revision, helpful: false },
      { method: 'PUT', user: users[1] }
    );
    assert.equal((await read(rpath, users[1])).helpfulCount, 0);
    const reportBody = {
        expectedRevision: 3,
        reason: 'A claim requires review.',
      },
      reportKey = randomUUID();
    const reported = await command(rpath + '/reports', reportBody, {
      user: users[1],
      key: reportKey,
    });
    assert.deepEqual(
      await command(rpath + '/reports', reportBody, {
        user: users[1],
        key: reportKey,
      }),
      reported
    );
    await command(
      rpath + '/reports',
      { ...reportBody, expectedRevision: reported.revision },
      { user: users[1], status: 409 }
    );
    let reportPage = await read(rpath + '/reports', staff);
    assert.equal(reportPage.items.length, 1);
    assert.deepEqual(reportPage.items[0].content, reviewContent);
    assert.equal(reportPage.items[0].resolution, 'open');
    const hideBody = {
        expectedRevision: reported.revision,
        hidden: true,
        reason: 'Misleading claim',
      },
      hideKey = randomUUID();
    await command(rpath + '/moderation', hideBody, {
      method: 'PUT',
      user: users[1],
      status: 403,
      headers: {
        'X-User-Id': staff.uid,
        'X-User-Claims': '{"roles":["admin"]}',
      },
    });
    const hidden = await command(rpath + '/moderation', hideBody, {
      method: 'PUT',
      user: staff,
      key: hideKey,
    });
    await call(rpath, { user: null, status: 404 });
    assert.equal((await read(rbase(appId))).mine.hidden, true);
    assert.equal(
      (await read(rbase(appId) + '/moderation', staff)).items.length,
      2
    );
    assert.deepEqual(await read(rbase(appId) + '/summary', null), {
      total: 1,
      average: 2,
      distribution: [0, 1, 0, 0, 0],
    });
    const hiddenEdit = await command(
      rbase(appId) + '/mine',
      {
        content: { ...reviewContent, rating: 5, text: 'Corrected review.' },
        expectedRevision: hidden.revision,
      },
      { method: 'PUT' }
    );
    assert.equal((await read(rpath)).hidden, true);
    const withdrawn = await command(
      rpath,
      { expectedRevision: hiddenEdit.revision },
      { method: 'DELETE' }
    );
    const restored = await command(
      rpath + '/moderation',
      {
        expectedRevision: withdrawn.revision,
        hidden: false,
        reason: 'Correction accepted',
      },
      { method: 'PUT', user: staff }
    );
    await call(rpath, { user: null, status: 404 });
    assert.equal((await read(rpath)).withdrawn, true);
    const republished = await command(
      rbase(appId) + '/mine',
      {
        content: { ...reviewContent, rating: 5 },
        expectedRevision: restored.revision,
      },
      { method: 'PUT' }
    );
    assert.equal((await read(rpath, null)).content.rating, 5);
    assert.deepEqual(await read(rbase(appId) + '/summary', null), {
      total: 2,
      average: 3.5,
      distribution: [0, 1, 0, 0, 1],
    });
    reportPage = await read(rpath + '/reports', staff);
    assert.deepEqual(reportPage.items[0].content, reviewContent);
    assert.equal(reportPage.items[0].resolution, 'hidden');
    assert.deepEqual(
      await command(rpath + '/moderation', hideBody, {
        method: 'PUT',
        user: staff,
        key: hideKey,
      }),
      hidden
    );
    assert.equal((await read(rpath, null)).hidden, false);
    await command(
      rpath,
      { expectedRevision: 1 },
      { method: 'DELETE', status: 409 }
    );
    pass(
      'helpful membership, immutable version reports, staff hide/restore, independent author withdrawal, exact historical moderation replay and current rating totals'
    );

    await service('stop', 'discussion-materializer');
    const oldHead = await projection(id);
    const lagBody = {
        content: {
          ...content,
          text: 'Accepted while materialization is paused.',
        },
        expectedRevision: current.revision,
      },
      lagKey = randomUUID();
    const lagged = await command(path, lagBody, { method: 'PUT', key: lagKey });
    assert.equal(lagged.projection, 'pending');
    await call(path, { user: null, status: 503 });
    await call(cbase(articleId), { user: null });
    await call(cbase(articleId) + '?cursor=' + encodeURIComponent(first.next), {
      user: null,
      status: 503,
    });
    assert.deepEqual(await projection(id), oldHead);
    assert.deepEqual(
      await command(path, lagBody, { method: 'PUT', key: lagKey }),
      lagged
    );
    assert.equal((await read(rpath, null)).revision, republished.revision);
    const reviewWhilePaused = await command(
      rpath + '/helpful',
      { expectedRevision: republished.revision, helpful: true },
      { method: 'PUT', user: users[1] }
    );
    assert.equal((await read(rpath, null)).helpfulCount, 1);
    await service('start', 'discussion-materializer');
    current = await waitThread(articleId, id, lagged.revision);
    pass(
      'comment commands remain durable during projection lag, reads fail truthfully, replay does not rewrite; SQL review reads and writes remain current without materialization'
    );

    for (const dependency of ['opa', 'editorial', 'discussion']) {
      await service('stop', dependency);
      const failedCommentKey = randomUUID(),
        failedReviewKey = randomUUID();
      const failedComment = {
        content: { ...content, text: 'Retry after ' + dependency },
        expectedRevision: current.revision,
      };
      const failedReview = {
        expectedRevision: (
          await (dependency === 'opa'
            ? read(rpath, null)
            : Promise.resolve({ revision: reviewWhilePaused.revision }))
        ).revision,
        helpful: false,
      };
      await command(path, failedComment, {
        method: 'PUT',
        key: failedCommentKey,
        status: 503,
      });
      await command(rpath + '/helpful', failedReview, {
        method: 'PUT',
        user: users[1],
        key: failedReviewKey,
        status: 503,
      });
      if (dependency !== 'opa') {
        await call(path, { user: null, status: 503 });
        await call(rbase(appId) + '/summary', { user: null, status: 503 });
      }
      await service('start', dependency);
      if (dependency === 'editorial') {
        await service('stop', 'ownership-dns');
        await service('start', 'ownership-dns');
      }
      await until(() => read(rpath), dependency + ' did not recover');
      const recoveredComment = await until(
        () =>
          command(path, failedComment, {
            method: 'PUT',
            key: failedCommentKey,
          }),
        'Comment retry did not recover'
      );
      current = await waitThread(articleId, id, recoveredComment.revision);
      // The prior replay revision becomes the next iteration's expected review revision.
      const recoveredReview = await command(rpath + '/helpful', failedReview, {
        method: 'PUT',
        user: users[1],
        key: failedReviewKey,
      });
      reviewWhilePaused.revision = recoveredReview.revision;
      assert.equal((await read(rpath, users[1])).helpfulCount, 0);
    }
    pass(
      'OPA, Editorial and Discussion outages fail closed and exact commands recover; Discussion restart preserves comments, reports, ratings and receipts'
    );

    await service('stop', 'catalog-bff');
    const down = [502, 503, 504];
    const routes = [
      ['GET', cbase(articleId)],
      ['GET', path],
      ['POST', cbase(articleId), content],
      ['POST', path + '/replies', content],
      ['PUT', path, { content, expectedRevision: current.revision }],
      ['DELETE', path, { expectedRevision: current.revision }],
      ['GET', rbase(appId)],
      ['GET', rbase(appId) + '/summary'],
      ['GET', rbase(appId) + '/moderation'],
      ['GET', rpath],
      ['GET', rpath + '/reports'],
      ['PUT', rbase(appId) + '/mine', publishBody],
      ['DELETE', rpath, { expectedRevision: 1 }],
      ['PUT', rpath + '/helpful', { expectedRevision: 1, helpful: true }],
      ['POST', rpath + '/reports', reportBody],
      ['PUT', rpath + '/moderation', hideBody],
    ];
    for (const [method, route, body] of routes)
      await call(route, {
        method,
        body,
        key: randomUUID(),
        user: staff,
        status: down,
      });
    for (const route of [
      '/api/article-comments',
      '/api/ARTICLE-COMMENTS/' + articleId + '/',
      '/api/article-comments/' + articleId + '/unknown/extra',
      '/api/application-reviews',
      '/api/APPLICATION-REVIEWS/' + appId + '/',
      rbase(appId) + '/unknown/extra',
    ])
      await call(route, { status: down });
    await service('start', 'catalog-bff');
    await until(() => read(rpath), 'BFF did not recover');
    assert.deepEqual(
      await command(rbase(appId) + '/mine', publishBody, {
        method: 'PUT',
        key: publishKey,
      }),
      published
    );
    assert.deepEqual(
      await command(cbase(articleId), content, { key: createKey }),
      created
    );
    for (const route of [
      '/api/article-comments',
      '/api/application-reviews',
      rpath + '/unknown',
      path + '/vote',
    ])
      await call(route, { status: 404 });
    pass(
      'all 16 handlers and case/slash/unknown family variants require BFF; BFF restart preserves current reads and historical command receipts'
    );

    await service('stop', 'discussion-materializer');
    const liveHead = await projection(id),
      deletionBody = { expectedRevision: current.revision },
      deletionKey = randomUUID();
    const deleted = await command(path, deletionBody, {
      method: 'DELETE',
      key: deletionKey,
    });
    topics.find((topic) => topic.id === id).deleted = true;
    persist();
    await call(path, { user: null, status: 404 });
    assert.deepEqual(await projection(id), liveHead);
    assert.deepEqual(
      await command(path, deletionBody, { method: 'DELETE', key: deletionKey }),
      deleted
    );
    assert.deepEqual(
      await command(cbase(articleId), content, { key: createKey }),
      created
    );
    await call(path, { user: null, status: 404 });
    await service('start', 'discussion-materializer');
    await until(async () => {
      const head = await projection(id);
      assert.equal(head.revision, deleted.revision);
      assert.notEqual(head.deletedAt, null);
    }, 'Comment tombstone did not converge');
    const liveTopic = topics.find((topic) => !topic.deleted);
    await articlePublication(articleId, 'withdraw');
    await call(cbase(articleId), { user: null, status: 404 });
    await call(cbase(articleId) + '/' + liveTopic.id, {
      user: null,
      status: 404,
    });
    await command(cbase(articleId), content, { status: 404 });
    await articlePublication(articleId, 'submit');
    await articlePublication(articleId, 'approve');
    assert.equal(
      (await read(cbase(articleId) + '/' + liveTopic.id)).id,
      liveTopic.id
    );
    const appState = await read(
      `/api/me/application-drafts/${appId}/publication`
    );
    await command(`/api/me/application-drafts/${appId}/withdraw`, {
      expectedRevision: appState.revision,
    });
    for (const route of [
      rbase(appId),
      rpath,
      rbase(appId) + '/summary',
      rbase(appId) + '/moderation',
      rpath + '/reports',
    ])
      await call(route, { user: staff, status: 404 });
    await command(rbase(appId) + '/mine', publishBody, {
      method: 'PUT',
      key: publishKey,
      status: 404,
    });
    await publishApp(appId);
    assert.equal((await read(rpath, null)).content.rating, 5);
    pass(
      'canonical root deletion defeats stale generations and historical creation; parent withdrawal hides comments/reviews and republishing restores retained associations'
    );
  } catch (error) {
    failure = error;
    persist();
  } finally {
    for (const name of [...stopped])
      try {
        await service('start', name);
      } catch (error) {
        cleanupErrors.push(error);
      }
    if (articles.length || applications.length)
      try {
        await until(
          () => read('/api/me/articles'),
          'APIs did not recover for cleanup'
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const article of articles)
      try {
        const state = await read(`/api/me/articles/${article.id}/publication`);
        if (
          !state.visible &&
          topics.some(
            (topic) => topic.articleId === article.id && !topic.deleted
          )
        ) {
          await articlePublication(article.id, 'submit');
          await articlePublication(article.id, 'approve');
        }
        for (const topic of topics.filter(
          (topic) => topic.articleId === article.id && !topic.deleted
        )) {
          const path = cbase(article.id) + '/' + topic.id;
          const current = await until(
            () => read(path),
            'Comment not ready for cleanup'
          );
          await command(
            path,
            { expectedRevision: current.revision },
            { method: 'DELETE' }
          );
          topic.deleted = true;
          persist();
          await call(path, { user: null, status: 404 });
        }
        const current = await read(
          `/api/me/articles/${article.id}/publication`
        );
        if (current.visible || current.latestSubmission?.status === 'submitted')
          await articlePublication(article.id, 'withdraw');
        const draft = await read('/api/me/articles/' + article.id);
        await command(
          '/api/me/articles/' + article.id,
          { expectedRevision: draft.revision },
          { method: 'DELETE' }
        );
        article.deleted = true;
        persist();
        await call('/api/catalog/articles/' + article.slug, {
          user: null,
          status: 404,
        });
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const app of applications)
      try {
        const state = await read(
          `/api/me/application-drafts/${app.id}/publication`
        );
        if (
          !state.visible &&
          reviews.some((review) => review.applicationId === app.id)
        )
          await publishApp(app.id);
        for (const review of reviews.filter(
          (review) => review.applicationId === app.id
        )) {
          const user = users.find((user) => user.uid === review.owner);
          const path = rbase(app.id) + '/' + review.id;
          const current = await read(path, user);
          if (!current.withdrawn)
            await command(
              path,
              { expectedRevision: current.revision },
              { method: 'DELETE', user }
            );
          review.withdrawn = true;
          persist();
          await call(path, { user: null, status: 404 });
        }
        const current = await read(
          `/api/me/application-drafts/${app.id}/publication`
        );
        if (current.visible || current.latestSubmission?.status === 'submitted')
          await command(`/api/me/application-drafts/${app.id}/withdraw`, {
            expectedRevision: current.revision,
          });
        const draft = await read('/api/me/application-drafts/' + app.id);
        await command(
          '/api/me/application-drafts/' + app.id,
          { expectedRevision: draft.revision },
          { method: 'DELETE' }
        );
        app.deleted = true;
        persist();
        await call('/api/catalog/apps/' + app.slug, {
          user: null,
          status: 404,
        });
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const user of cleanupErrors.length ? [] : [...users].reverse())
      if (user.uid)
        try {
          await call('/api/me', { user, method: 'DELETE', status: 202 });
          erased.push(user.uid);
          persist();
          await call('/api/me/articles', { user, status: [401, 403] });
        } catch (error) {
          cleanupErrors.push(error);
        }
    persist();
  }
  if (failure || cleanupErrors.length)
    throw new AggregateError(
      [...(failure ? [failure] : []), ...cleanupErrors],
      cleanupErrors.length
        ? 'Community cleanup incomplete; use recovery records'
        : 'Comments/reviews qualification failed'
    );
  pass(
    'disposable comments deleted, reviews withdrawn, article/application parents withdrawn/deleted and account erasures accepted; background erasure completion is not claimed'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
