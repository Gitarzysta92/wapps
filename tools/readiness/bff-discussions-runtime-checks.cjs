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
  const base = (applicationId) =>
    '/api/application-discussions/' + applicationId;
  async function waitThread(applicationId, id, revision, user = users[0]) {
    return until(async () => {
      const value = await read(base(applicationId) + '/' + id, user);
      assert.equal(value.revision, revision);
      return value;
    }, 'Discussion generation did not converge');
  }
  async function createTopic(applicationId, content, key = randomUUID()) {
    const result = await command(base(applicationId), content, { key });
    if (!topics.some((topic) => topic.id === result.id))
      topics.push({ applicationId, id: result.id, revision: result.revision });
    persist();
    return result;
  }
  async function application() {
    const fields = {
      name: 'BFF discussions ' + randomUUID().slice(0, 8),
      slug: 'bff-discussions-' + randomUUID(),
      website: 'https://discussion.example.test',
      description: 'Disposable application for discussion BFF qualification.',
      classification: 'general',
    };
    const created = await command('/api/me/application-drafts', fields);
    applications.push({ id: created.id, slug: fields.slug });
    persist();
    await command(`/api/me/application-drafts/${created.id}/submit`, {
      expectedRevision: created.revision,
    });
    const review = await read(
      `/api/editorial/application-reviews/${created.id}`,
      staff
    );
    await command(
      `/api/editorial/application-reviews/${created.id}/decision`,
      {
        decision: 'approve',
        expectedRevision: review.revision,
        submittedRevision: review.latestSubmission.submittedRevision,
        reason: '',
      },
      { user: staff }
    );
    await until(
      () => read('/api/catalog/apps/' + fields.slug, null),
      'Application did not materialize'
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
  async function allMine(user) {
    const items = [];
    let cursor;
    for (let i = 0; i < 4; i++) {
      const page = await read(
        '/api/me/discussions' +
          (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
        user
      );
      items.push(...page.items);
      if (!page.next) return items;
      cursor = page.next;
    }
    throw new Error('Unexpected fixture participation size');
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
    for (const nickname of ['BFF Discussion Author', 'BFF Discussion Peer']) {
      const user = {
        email: 'bff-discussions-' + randomUUID() + '@wapps-review.test',
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
    const content = {
      title: 'BFF discussion topic',
      tags: ['community'],
      displayName: 'Public Author',
      text: 'Initial public topic.',
    };
    const createKey = randomUUID(),
      created = await createTopic(appId, content, createKey),
      id = created.id;
    const path = base(appId) + '/' + id;
    let current = await waitThread(appId, id, 1);
    assert.equal(current.title, content.title);
    assert.equal(current.comments[0].editable, true);
    assert.deepEqual(
      await command(base(appId), content, { key: createKey }),
      created
    );
    await command(
      base(appId),
      { ...content, title: 'Changed key payload' },
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
    await call('/api/me/discussions', { user: null, status: 401 });
    await command(base(appId), content, { user: null, status: 401 });
    for (const method of ['PUT', 'DELETE'])
      await command(
        path,
        { expectedRevision: 1, ...(method === 'PUT' ? { content } : {}) },
        { method, user: users[1], status: 403 }
      );
    await call(base(otherAppId) + '/' + id, { status: 404 });
    await command(
      base(otherAppId) + '/' + id + '/replies',
      { displayName: 'Public Author', text: 'Wrong target' },
      { status: 404 }
    );
    await command(
      path + '/pin',
      { pinned: true, expectedRevision: 1 },
      {
        method: 'PUT',
        status: 403,
        headers: {
          'X-User-Id': staff.uid,
          'X-User-Claims': '{"roles":["admin"]}',
          'X-Ingress-Auth': 'forged',
        },
      }
    );
    await call(base(appId) + '?cursor=bad', { status: 400 });
    await call(base(appId) + '?tenantId=other', { status: 400 });
    pass(
      'public/member reads, independent sign-in, owner and parent isolation, spoofed moderation denial, creation replay and key conflicts'
    );

    const replyContent = { displayName: 'Public Peer', text: 'A peer reply.' };
    const replied = await command(path + '/replies', replyContent, {
      user: users[1],
    });
    assert.equal(replied.discussionId, id);
    const nested = await command(base(appId) + '/' + replied.id + '/replies', {
      displayName: 'Public Author',
      text: 'Nested answer.',
    });
    current = await waitThread(appId, id, nested.revision);
    assert.equal(current.replyCount, 2);
    assert.equal(
      current.comments.find((post) => post.id === nested.id).depth,
      2
    );
    assert.equal(
      current.comments.find((post) => post.id === nested.id).parentId,
      replied.id
    );
    assert.equal(
      (await allMine(users[0])).find((topic) => topic.id === id).participation,
      'author'
    );
    assert.equal(
      (await allMine(users[1])).find((topic) => topic.id === id).participation,
      'participant'
    );
    const editBody = {
        content: { ...content, text: '\u754c'.repeat(5000) },
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
    current = await waitThread(appId, id, edited.revision);
    assert.equal(current.comments[0].content.text.length, 5000);
    pass(
      'threaded replies, author/participant workspace, multilingual edits, historical receipts and optimistic revision conflicts'
    );

    const voteBody = { value: 1, expectedRevision: current.revision },
      voteKey = randomUUID();
    const voted = await command(path + '/vote', voteBody, {
      method: 'PUT',
      user: users[1],
      key: voteKey,
    });
    current = await waitThread(appId, id, voted.revision, users[1]);
    assert.deepEqual(current.comments[0].votes, {
      upvotes: 1,
      downvotes: 0,
      mine: 1,
    });
    assert.equal((await read(path)).comments[0].votes.mine, 0);
    const down = await command(
      path + '/vote',
      { value: -1, expectedRevision: current.revision },
      { method: 'PUT', user: users[1] }
    );
    current = await waitThread(appId, id, down.revision, users[1]);
    assert.deepEqual(current.comments[0].votes, {
      upvotes: 0,
      downvotes: 1,
      mine: -1,
    });
    assert.deepEqual(
      await command(path + '/vote', voteBody, {
        method: 'PUT',
        user: users[1],
        key: voteKey,
      }),
      voted
    );
    assert.equal((await read(path, users[1])).comments[0].votes.mine, -1);
    await command(path + '/vote', voteBody, {
      method: 'PUT',
      user: users[1],
      status: 409,
    });
    const clear = await command(
      path + '/vote',
      { value: 0, expectedRevision: current.revision },
      { method: 'PUT', user: users[1] }
    );
    const pinKey = randomUUID(),
      pinBody = { pinned: true, expectedRevision: clear.revision };
    const pinned = await command(path + '/pin', pinBody, {
      method: 'PUT',
      user: staff,
      key: pinKey,
    });
    current = await waitThread(appId, id, pinned.revision, staff);
    assert.equal(current.canPin, true);
    assert.equal(current.pinned, true);
    assert.equal((await read(path)).canPin, false);
    const unpinned = await command(
      path + '/pin',
      { pinned: false, expectedRevision: current.revision },
      { method: 'PUT', user: staff }
    );
    current = await waitThread(appId, id, unpinned.revision);
    assert.deepEqual(
      await command(path + '/pin', pinBody, {
        method: 'PUT',
        user: staff,
        key: pinKey,
      }),
      pinned
    );
    assert.equal((await read(path)).pinned, false);
    pass(
      'upvote/downvote/clear, viewer-specific choices, admin-only pinning and historical vote/pin replay without undoing newer changes'
    );

    for (let i = 0; i < 11; i++) {
      const topic = await createTopic(appId, {
        ...content,
        title: 'Pagination topic ' + i,
      });
      await waitThread(appId, topic.id, topic.revision);
    }
    const pinAgain = await command(
      path + '/pin',
      { pinned: true, expectedRevision: current.revision },
      { method: 'PUT', user: staff }
    );
    await waitThread(appId, id, pinAgain.revision);
    const first = await read(base(appId), null);
    assert.equal(first.items.length, 10);
    assert.equal(first.items[0].id, id);
    assert.ok(first.items.every((topic) => topic.comments.length === 1));
    const second = await read(
      base(appId) + '?cursor=' + encodeURIComponent(first.next),
      null
    );
    assert.equal(second.items.length, 2);
    assert.equal(second.next, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((topic) => topic.id)).size,
      12
    );
    assert.equal((await allMine(users[0])).length, 12);
    const selected = await read(
      '/api/discussion-selection?ids=' +
        [id, replied.id, randomUUID()].join(','),
      null
    );
    assert.deepEqual(
      selected.items.map((topic) => topic.id),
      [id]
    );
    assert.equal(selected.items[0].applicationId, appId);
    pass(
      'pinned-first bounded pagination, root-only previews, participation pagination and public root selection excluding replies/missing IDs'
    );

    const favoriteBefore = await read('/api/me/favorites');
    await command(
      '/api/me/favorites',
      {
        expectedRevision: favoriteBefore.revision,
        target: { kind: 'discussions', id },
        saved: true,
      },
      { method: 'PUT' }
    );
    const favorites = await read('/api/me/favorites/content');
    assert.equal(
      favorites.items.find((item) => item.id === id).status,
      'available'
    );
    const beforePause = await read(path),
      beforeProjection = await projection(id);
    await service('stop', 'discussion-materializer');
    const pendingEdit = await command(
      path,
      {
        expectedRevision: beforePause.revision,
        content: {
          ...content,
          title: 'Edited while materialization paused',
          text: 'Durable pending text.',
        },
      },
      { method: 'PUT' }
    );
    await call(path, { status: 503 });
    await call(base(appId), { status: 503 });
    await call('/api/discussion-selection?ids=' + id, {
      user: null,
      status: 503,
    });
    assert.deepEqual(await projection(id), beforeProjection);
    const removeBody = { expectedRevision: pendingEdit.revision },
      removeKey = randomUUID();
    const removedReply = await command(
      base(appId) + '/' + replied.id,
      removeBody,
      { method: 'DELETE', user: users[1], key: removeKey }
    );
    assert.deepEqual(
      await command(base(appId) + '/' + replied.id, removeBody, {
        method: 'DELETE',
        user: users[1],
        key: removeKey,
      }),
      removedReply
    );
    await service('start', 'discussion-materializer');
    current = await waitThread(appId, id, removedReply.revision);
    const placeholder = current.comments.find((post) => post.id === replied.id);
    assert.equal(placeholder.content, null);
    assert.equal(placeholder.votes, null);
    assert.equal(placeholder.editable, false);
    assert.equal(placeholder.createdAt, null);
    assert.equal(
      current.comments.find((post) => post.id === nested.id).parentId,
      replied.id
    );
    pass(
      'favorites integration, stale-projection 503, durable edits/deletes during paused materialization and convergence with redacted ancestors'
    );

    await service('stop', 'mongodb');
    await call(path, { status: 503 });
    const offlineBody = {
        expectedRevision: current.revision,
        content: { ...content, text: 'Written with Mongo offline.' },
      },
      offlineKey = randomUUID();
    const offlineEdit = await command(path, offlineBody, {
      method: 'PUT',
      key: offlineKey,
    });
    assert.deepEqual(
      await command(path, offlineBody, { method: 'PUT', key: offlineKey }),
      offlineEdit
    );
    await service('start', 'mongodb');
    await waitThread(appId, id, offlineEdit.revision);
    await service('stop', 'minio');
    await command(
      path,
      {
        expectedRevision: offlineEdit.revision,
        content: { ...content, text: 'Cannot save without payload store.' },
      },
      { method: 'PUT', status: 503 }
    );
    assert.equal((await read(path)).revision, offlineEdit.revision);
    await service('start', 'minio');
    await service('stop', 'discussion');
    await call(path, { status: 503 });
    await call('/api/me/discussions', { status: 503 });
    await call('/api/discussion-selection?ids=' + id, {
      user: null,
      status: 503,
    });
    await service('start', 'discussion');
    await until(() => read(path), 'Discussion service did not recover');
    assert.deepEqual(
      await command(path, offlineBody, { method: 'PUT', key: offlineKey }),
      offlineEdit
    );
    pass(
      'Mongo outage does not block canonical writes/replay; object-store failure cannot commit partial edits; Discussion restart preserves data and receipts'
    );

    await service('stop', 'catalog-bff');
    for (const route of [
      base(appId),
      path,
      base(appId).replace(
        'application-discussions',
        'Application-Discussions'
      ) + '/',
      '/api/application-discussions',
      '/api/me/discussions',
      '/api/me/Discussions/',
      '/api/me/discussions/unknown',
      '/api/discussion-selection?ids=' + id,
      '/api/Discussion-Selection/?ids=' + id,
      '/api/discussion-selection/unknown',
    ])
      await call(route, { status: [502, 503, 504] });
    for (const [route, body, method] of [
      [base(appId), content, 'POST'],
      [path + '/replies', replyContent, 'POST'],
      [path, offlineBody, 'PUT'],
      [path, { expectedRevision: offlineEdit.revision }, 'DELETE'],
      [
        path + '/pin',
        { expectedRevision: offlineEdit.revision, pinned: false },
        'PUT',
      ],
      [
        path + '/vote',
        { expectedRevision: offlineEdit.revision, value: 1 },
        'PUT',
      ],
    ])
      await command(route, body, { method, status: [502, 503, 504] });
    await service('start', 'catalog-bff');
    await until(() => read(path), 'BFF did not recover');
    assert.deepEqual(
      await command(path, offlineBody, { method: 'PUT', key: offlineKey }),
      offlineEdit
    );
    for (const route of [
      '/api/application-discussions',
      '/api/me/discussions/unknown',
      '/api/discussion-selection/unknown',
    ])
      await call(route, { status: 404 });
    pass(
      'all ten handlers and case/slash/unknown family variants require BFF; BFF restart preserves content and historical receipts'
    );

    await service('stop', 'discussion-materializer');
    const liveHead = await projection(id),
      deleteKey = randomUUID(),
      deleteBody = { expectedRevision: offlineEdit.revision };
    const deleted = await command(path, deleteBody, {
      method: 'DELETE',
      key: deleteKey,
    });
    topics.find((topic) => topic.id === id).deleted = true;
    persist();
    await call(path, { user: null, status: 404 });
    assert.deepEqual(await projection(id), liveHead);
    assert.deepEqual(
      (await read('/api/discussion-selection?ids=' + id, null)).items,
      []
    );
    assert.ok(!(await allMine(users[0])).some((topic) => topic.id === id));
    assert.equal(
      (await read('/api/me/favorites/content')).items.find(
        (item) => item.id === id
      ).status,
      'unavailable'
    );
    assert.deepEqual(
      await command(path, deleteBody, { method: 'DELETE', key: deleteKey }),
      deleted
    );
    assert.deepEqual(
      await command(base(appId), content, { key: createKey }),
      created
    );
    await call(path, { user: null, status: 404 });
    await service('start', 'discussion-materializer');
    await until(async () => {
      const head = await projection(id);
      assert.equal(head.revision, deleted.revision);
      assert.notEqual(head.deletedAt, null);
    }, 'Discussion tombstone did not converge');
    const liveTopic = topics.find(
      (topic) => topic.id !== id && topic.applicationId === appId
    );
    const parent = await read(
      `/api/me/application-drafts/${appId}/publication`
    );
    await command(`/api/me/application-drafts/${appId}/withdraw`, {
      expectedRevision: parent.revision,
    });
    await call(base(appId), { user: null, status: 404 });
    await call(base(appId) + '/' + liveTopic.id, { user: null, status: 404 });
    assert.deepEqual(
      (await read('/api/discussion-selection?ids=' + liveTopic.id, null)).items,
      []
    );
    assert.deepEqual(await allMine(users[0]), []);
    await command(base(appId), content, { status: 404 });
    pass(
      'canonical deletion hides stale generations, selection and favorites immediately; historical creation cannot resurrect; parent withdrawal revokes live topics'
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
    if (applications.length)
      try {
        await until(
          () => read('/api/me/application-drafts'),
          'APIs did not recover for cleanup'
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    // Restore only this run's withdrawn fixture parents long enough to delete their public topics through the API.
    for (const app of applications)
      try {
        const parent = await read(
          `/api/me/application-drafts/${app.id}/publication`
        );
        if (
          !parent.visible &&
          topics.some(
            (topic) => topic.applicationId === app.id && !topic.deleted
          )
        ) {
          const draft = await read(`/api/me/application-drafts/${app.id}`);
          await command(`/api/me/application-drafts/${app.id}/submit`, {
            expectedRevision: draft.revision,
          });
          const review = await read(
            `/api/editorial/application-reviews/${app.id}`,
            staff
          );
          await command(
            `/api/editorial/application-reviews/${app.id}/decision`,
            {
              decision: 'approve',
              expectedRevision: review.revision,
              submittedRevision: review.latestSubmission.submittedRevision,
              reason: '',
            },
            { user: staff }
          );
        }
        for (const topic of topics.filter(
          (topic) => topic.applicationId === app.id && !topic.deleted
        )) {
          const path = base(app.id) + '/' + topic.id;
          const current = await until(
            () => read(path),
            'Fixture topic not ready for cleanup'
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
          `/api/me/application-drafts/${app.id}/publication`
        );
        if (current.visible || current.latestSubmission?.status === 'submitted')
          await command(`/api/me/application-drafts/${app.id}/withdraw`, {
            expectedRevision: current.revision,
          });
        const draft = await read(`/api/me/application-drafts/${app.id}`);
        await command(
          `/api/me/application-drafts/${app.id}`,
          { expectedRevision: draft.revision },
          { method: 'DELETE' }
        );
        app.deleted = true;
        persist();
        await call('/api/catalog/apps/' + app.slug, { user: null, status: 404 });
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const user of cleanupErrors.length ? [] : [...users].reverse())
      if (user.uid)
        try {
          await call('/api/me', { user, method: 'DELETE', status: 202 });
          erased.push(user.uid);
          persist();
          await call('/api/me/discussions', { user, status: [401, 403] });
        } catch (error) {
          cleanupErrors.push(error);
        }
    persist();
  }
  if (failure || cleanupErrors.length)
    throw new AggregateError(
      [...(failure ? [failure] : []), ...cleanupErrors],
      cleanupErrors.length
        ? 'Discussion cleanup incomplete; use recovery records'
        : 'Discussion qualification failed'
    );
  pass(
    'disposable topics deleted, fixture applications withdrawn/deleted and account erasures accepted; background retention/erasure remains with owning services'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
