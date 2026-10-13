const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');

async function publicProfileFavoritesChecks(options) {
  const {
    identities,
    favorites,
    accountOrigin,
    accountHeaders,
    application,
    topic,
    reader,
    projections,
    restartAccount,
    pass,
  } = options;
  const owner = 'ProfileFavoritesOwner';
  const follower = 'ProfileFavoritesFollower';
  const stranger = 'ProfileFavoritesStranger';
  for (const uid of [owner, follower, stranger]) {
    await identities.ensure({
      uid,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
    await identities.enrollAccount(uid, uid, randomUUID());
  }
  const ownerId = (await identities.find(owner)).subjectId;
  const requesterId = (await identities.find(follower)).subjectId;
  const anonymous = {
    'x-ingress-auth': accountHeaders(owner)['x-ingress-auth'],
    'x-anonymous': 'true',
  };
  async function account(uid, route, method = 'GET', body, key = randomUUID()) {
    return fetch(accountOrigin() + '/api/' + route, {
      method,
      headers: {
        ...(uid ? accountHeaders(uid) : anonymous),
        'idempotency-key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  }
  async function accepted(response) {
    assert.ok(
      response.ok,
      `${response.url}: ${response.status} ${await response.clone().text()}`
    );
    return response.json();
  }
  const route = `profiles/${ownerId}/favorites`;
  const read = async (uid = null, after) =>
    accepted(
      await account(
        uid,
        route + (after ? '?after=' + encodeURIComponent(after) : '')
      )
    );
  const privacy = async (profileVisibility, showFavorites) => {
    const current = await identities.getPreferences(owner);
    current.preferences.privacy.profileVisibility = profileVisibility;
    current.preferences.privacy.showFavorites = showFavorites;
    return accepted(
      await account(owner, 'me/preferences', 'PUT', {
        expectedRevision: current.revision,
        preferences: current.preferences,
      })
    );
  };
  const change = async (target, saved = true) =>
    accepted(
      await account(owner, 'me/favorites', 'PUT', {
        expectedRevision: (await favorites.read(owner)).revision,
        target,
        saved,
      })
    );
  async function editorial(method, route, body, review = false) {
    return accepted(
      await fetch(options.origin() + '/api/' + route, {
        method,
        headers: {
          ...options.headers(
            review ? 'ProfileContentReviewer' : 'ProfileContentAuthor',
            'default',
            review ? ['editorial:reviewer'] : []
          ),
          'idempotency-key': randomUUID(),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10000),
      })
    );
  }
  async function project(kind, id) {
    await projections.publish(
      projectEditorialSnapshot(await reader.read(kind, id))
    );
  }
  async function publish(kind, id) {
    const status = await editorial('GET', `me/${kind}s/${id}/publication`);
    const submitted = await editorial('POST', `me/${kind}s/${id}/submit`, {
      expectedRevision: status.revision,
      ...(kind === 'article'
        ? { expectedPublicationRevision: status.publicationRevision }
        : {}),
    });
    const current = await editorial('GET', `me/${kind}s/${id}/publication`);
    await editorial(
      'POST',
      `editorial/${kind}-reviews/${id}/decision`,
      {
        decision: 'approve',
        expectedRevision: current.revision,
        submittedRevision:
          submitted.submittedRevision ??
          current.latestSubmission.submittedRevision,
        ...(kind === 'article'
          ? {
              expectedPublicationRevision: current.publicationRevision,
              reason: '',
            }
          : {}),
      },
      true
    );
  }
  async function withdraw(kind, id) {
    const status = await editorial('GET', `me/${kind}s/${id}/publication`);
    await editorial('POST', `me/${kind}s/${id}/withdraw`, {
      expectedRevision: status.revision,
      ...(kind === 'article'
        ? { expectedPublicationRevision: status.publicationRevision }
        : {}),
    });
  }
  const suiteFields = {
    title: 'Shared reviewed collection',
    description: 'A public selection.',
    applicationIds: [application.id],
  };
  const suite = await editorial('POST', 'me/suites', suiteFields);
  await publish('suite', suite.id);
  await project('suite', suite.id);
  const articleFields = {
    title: 'Shared reviewed article',
    slug: 'shared-profile-article',
    excerpt: 'An independently reviewed article.',
    byline: 'Public author',
    category: 'Guides',
    tags: [],
    sections: [
      { heading: 'Introduction', paragraphs: ['Reviewed public content.'] },
    ],
  };
  const article = await editorial('POST', 'me/articles', articleFields);
  await publish('article', article.id);
  await project('article', article.id);
  const targets = [
    { kind: 'applications', id: application.id },
    { kind: 'suites', id: suite.id },
    { kind: 'articles', id: article.id },
    { kind: 'discussions', id: topic.id },
  ];
  for (const target of targets) await change(target);
  assert.equal((await account(null, route)).status, 404);
  await privacy('public', false);
  assert.deepEqual(await read(), { sharing: 'hidden', items: [], after: null });
  assert.deepEqual(await read(owner), {
    sharing: 'hidden',
    items: [],
    after: null,
  });
  await privacy('public', true);
  let page = await read();
  assert.deepEqual(
    page.items.map((item) => item.kind),
    ['applications', 'articles', 'discussions', 'suites']
  );
  assert.equal(
    page.items.find((item) => item.kind === 'discussions').applicationSlug,
    application.slug
  );
  for (const item of page.items)
    assert.deepEqual(Object.keys(item).sort(), [
      'applicationSlug',
      'id',
      'kind',
      'slug',
      'title',
    ]);
  assert.ok(!JSON.stringify(page).includes(owner));
  const response = await account(null, route);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Authorization');
  for (const query of [
    'identityId=Other',
    'tenantId=private',
    'after=x&after=y',
    'after=not-a-cursor',
  ])
    assert.equal((await account(null, route + '?' + query)).status, 400);
  await restartAccount();
  assert.deepEqual(await read(), page);
  pass(
    'public profile favorites: four real published target families, explicit sharing, owner switch, canonical routes, narrow payloads, strict queries and API restart'
  );

  await privacy('followers', true);
  assert.equal((await account(null, route)).status, 404);
  assert.equal((await account(stranger, route)).status, 404);
  const follow = async (uid, action, expectedRevision, key) =>
    accepted(
      await account(
        uid,
        'me/profile-follows',
        'PUT',
        { ownerId, requesterId, action, expectedRevision },
        key
      )
    );
  await follow(follower, 'request', 0);
  assert.equal((await account(follower, route)).status, 404);
  const approvalKey = randomUUID();
  const approval = await follow(owner, 'approve', 1, approvalKey);
  assert.deepEqual(await read(follower), page);
  await follow(owner, 'remove', 2);
  assert.equal((await account(follower, route)).status, 404);
  assert.deepEqual(await follow(owner, 'approve', 1, approvalKey), approval);
  assert.equal((await account(follower, route)).status, 404);
  await privacy('private', true);
  const staffResponse = await fetch(accountOrigin() + '/api/' + route, {
    headers: {
      ...accountHeaders(stranger),
      'x-user-claims': '{"roles":["admin","identity:admin"]}',
    },
  });
  assert.equal(staffResponse.status, 404);
  await privacy('public', true);
  pass(
    'public profile favorites: private and approved-follower audiences, immediate revocation, no staff bypass and no access restoration from historical approval receipts'
  );

  const currentSuite = await editorial(
    'GET',
    `me/suites/${suite.id}/publication`
  );
  await editorial('PUT', `me/suites/${suite.id}`, {
    ...suiteFields,
    title: 'New reviewed collection',
    expectedRevision: currentSuite.revision,
  });
  assert.equal(
    (await read()).items.find((item) => item.kind === 'suites').title,
    suiteFields.title
  );
  await publish('suite', suite.id);
  assert.equal(
    (await account(null, route)).status,
    503,
    'Pending publication must not look like an empty collection'
  );
  await project('suite', suite.id);
  assert.equal(
    (await read()).items.find((item) => item.kind === 'suites').title,
    'New reviewed collection'
  );
  await withdraw('suite', suite.id);
  await withdraw('article', article.id);
  assert.deepEqual(
    (await read()).items.map((item) => item.kind),
    ['applications', 'discussions']
  );
  await publish('suite', suite.id);
  await project('suite', suite.id);
  await publish('article', article.id);
  await project('article', article.id);
  await options.withdraw();
  const withoutParent = (await read()).items.map((item) => item.kind);
  assert.ok(
    !withoutParent.includes('applications') &&
      !withoutParent.includes('discussions')
  );
  await options.republish();
  assert.equal((await read()).items.length, 4);
  pass(
    'public profile favorites: immutable approved metadata, unavailable projection lag, explicit recovery, withdrawal and current parent visibility without waiting for projections'
  );

  // Delay real upstream responses to exercise the canonical authorization recheck.
  let release = null;
  let arrived = null;
  let requests = 0;
  const proxy = http.createServer(async (request, response) => {
    requests++;
    try {
      const upstream = await fetch(options.origin() + request.url, {
        signal: AbortSignal.timeout(8000),
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      if (arrived && request.url.startsWith('/api/catalog/app-selection')) {
        const notify = arrived;
        arrived = null;
        await new Promise((resolve) => {
          release = resolve;
          notify();
        });
      }
      response.writeHead(upstream.status, {
        'content-type': 'application/json',
      });
      response.end(body);
    } catch {
      response.writeHead(503);
      response.end('{}');
    }
  });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  try {
    await restartAccount(`http://127.0.0.1:${proxy.address().port}`);
    for (const mutation of [
      () => privacy('public', false),
      () => privacy('private', true),
      () => change(targets[0], false),
    ]) {
      await privacy('public', true);
      const seen = new Promise((resolve) => {
        arrived = resolve;
      });
      const pending = account(null, route);
      await seen;
      await mutation();
      release();
      release = null;
      assert.equal(
        (await pending).status,
        404,
        'Changed policy or saved relations must discard the in-flight payload'
      );
    }
    await privacy('public', false);
    const before = requests;
    assert.equal((await read()).sharing, 'hidden');
    assert.equal(requests, before);
  } finally {
    if (release) release();
    await restartAccount(options.origin());
    await new Promise((resolve) => proxy.close(resolve));
  }
  await change(targets[0]);
  await privacy('public', true);
  await restartAccount('http://127.0.0.1:1');
  assert.equal((await account(null, route)).status, 503);
  await privacy('public', false);
  assert.equal((await read()).sharing, 'hidden');
  await restartAccount(options.origin());
  await privacy('public', true);
  pass(
    'public profile favorites: sharing, audience and relation changes during real target reads discard old results; hidden sharing skips dependencies and outages remain unavailable'
  );

  const extras = [];
  for (let index = 0; index < 19; index++) {
    const item = await editorial('POST', 'me/suites', {
      ...suiteFields,
      title: `Shared page collection ${String(index).padStart(2, '0')}`,
    });
    await publish('suite', item.id);
    await project('suite', item.id);
    const target = { kind: 'suites', id: item.id };
    extras.push(target);
    await change(target);
  }
  page = await read();
  assert.equal(page.items.length, 20);
  assert.equal(page.after, page.items.at(-1).kind + ':' + page.items.at(-1).id);
  const next = await read(null, page.after);
  assert.equal(next.items.length, 3);
  assert.equal(next.after, null);
  assert.equal(
    new Set(
      [...page.items, ...next.items].map((item) => item.kind + ':' + item.id)
    ).size,
    23
  );
  const hiddenTarget = extras.find((target) =>
    page.items.some((item) => item.id === target.id)
  );
  await withdraw('suite', hiddenTarget.id);
  assert.ok(!(await read()).items.some((item) => item.id === hiddenTarget.id));
  pass(
    'public profile favorites: pagination counts only visible targets, cursors identify public results and withdrawn saved targets are omitted'
  );

  await require('./public-profile-favorites-browser.cjs').publicProfileFavoritesBrowser(
    {
      ...options,
      owner,
      follower,
      ownerId,
      privacy,
      change,
      targets: [...targets, ...extras],
      read,
      output: require('node:path').join(
        options.output,
        'public-profile-favorites'
      ),
    }
  );
}
module.exports = { publicProfileFavoritesChecks };
