const assert = require('node:assert/strict');
const http = require('node:http');

async function profileTotalsChecks(options) {
  const {
    owner,
    follower,
    ownerId,
    account,
    accepted,
    privacy,
    editorial,
    publish,
    withdraw,
    suite,
    article,
    articleFields,
    application,
    ownedDraft,
    appTarget,
    topic,
    create,
    reply,
    actor,
    base,
    pass,
  } = options;
  const route = `profiles/${ownerId}/totals`;
  const read = (uid = null) => account(uid, route).then(accepted);
  const own = () => account(owner, 'me/totals').then(accepted);
  const initial = { discussions: 2, favorites: 4, suites: 1, articles: 1 };
  assert.deepEqual(await read(), initial);
  assert.deepEqual(await own(), initial);
  const publicResponse = await account(null, route);
  assert.equal(
    publicResponse.headers.get('cache-control'),
    'private, no-store'
  );
  assert.equal(publicResponse.headers.get('vary'), 'Authorization');
  for (const query of ['owner=other', 'tenantId=other', 'after=anything'])
    assert.equal((await account(owner, route + '?' + query)).status, 400);
  assert.equal((await account(null, 'me/totals')).status, 401);
  assert.deepEqual(await account(follower, 'me/totals').then(accepted), {
    discussions: 0,
    favorites: 0,
    suites: 0,
    articles: 0,
  });
  for (const [setting, category] of [
    ['showSuites', 'suites'],
    ['showFavorites', 'favorites'],
    ['showDiscussions', 'discussions'],
    ['showActivityHistory', 'articles'],
  ]) {
    await privacy('public', true, { [setting]: false });
    assert.deepEqual(await read(), { ...initial, [category]: null });
    assert.deepEqual(await read(owner), { ...initial, [category]: null });
    assert.deepEqual(await own(), initial);
  }
  await privacy('private', true);
  assert.equal((await account(null, route)).status, 404);
  assert.equal((await account(follower, route)).status, 404);
  await privacy('public', true);
  const privateArticle = await editorial('GET', `me/articles/${article.id}`);
  await editorial('PUT', `me/articles/${article.id}`, {
    expectedRevision: privateArticle.revision,
    ...articleFields,
    title: 'Private totals edit',
  });
  await editorial('POST', 'me/articles', {
    ...articleFields,
    slug: 'unpublished-profile-total',
    title: 'Unpublished total article',
  });
  await editorial('POST', 'me/suites', {
    title: 'Unpublished total suite',
    description: 'Private draft',
    applicationIds: [application.id],
  });
  assert.deepEqual(await read(), initial);
  await reply(topic);
  assert.deepEqual(
    await read(),
    initial,
    'Additional replies do not create additional threads'
  );
  const removal = options.discussionAccepted(
    await options.discussion(
      'DELETE',
      `${base(appTarget)}/${topic.id}`,
      { expectedRevision: topic.revision },
      actor()
    )
  );
  topic.revision = removal.revision;
  assert.deepEqual(
    await read(),
    { ...initial, discussions: 1, favorites: 3 },
    'A root tombstone immediately removes participation and its favorite'
  );
  await withdraw('suite', 'suites', suite.id);
  await withdraw('article', 'articles', article.id);
  assert.deepEqual(await read(), {
    discussions: 0,
    favorites: 1,
    suites: 0,
    articles: 0,
  });
  await publish('suite', 'suites', suite.id);
  await publish('article', 'articles', article.id);
  await withdraw('application', 'application-drafts', ownedDraft.id);
  assert.deepEqual(await read(), {
    discussions: 1,
    favorites: 2,
    suites: 1,
    articles: 1,
  });
  await publish('application', 'application-drafts', ownedDraft.id);
  pass(
    'profile totals: actual SQL counts, distinct participation, private drafts/edits, withdrawals, deleted roots, all sharing switches, private owner counts, audience denial and no-store'
  );

  // Production commands establish more records than any first profile page can contain.
  for (let i = 0; i < 20; i++) {
    const nextSuite = await editorial('POST', 'me/suites', {
      title: `Totals suite ${i}`,
      description: 'Beyond one public page',
      applicationIds: [application.id],
    });
    await publish('suite', 'suites', nextSuite.id);
    const nextArticle = await editorial('POST', 'me/articles', {
      ...articleFields,
      slug: `profile-totals-article-${i}`,
      title: `Totals article ${i}`,
    });
    await publish('article', 'articles', nextArticle.id);
  }
  for (let i = 0; i < 11; i++)
    await create(appTarget, `Totals discussion ${i}`);
  const expected = { discussions: 12, favorites: 3, suites: 21, articles: 21 };
  assert.deepEqual(await read(), expected);
  assert.equal(
    (await account(null, `profiles/${ownerId}/suites`).then(accepted)).items
      .length,
    20
  );
  assert.equal(
    (await account(null, `profiles/${ownerId}/discussions`).then(accepted))
      .items.length,
    10
  );
  await options.restartAccount();
  assert.deepEqual(await read(), expected);
  pass(
    'profile totals: 21 approved suites, 21 approved articles and 12 distinct threads exceed page sizes and survive Account process restart'
  );
  const secret = options.accountHeaders(owner)['x-ingress-auth'];
  for (const [origin, categories] of [
    [options.origin(), ['articles']],
    [options.discussionOrigin(), ['discussions']],
  ]) {
    const input = { ownerIdentityId: owner, categories };
    for (const headers of [
      {},
      { 'x-profile-reader': 'wrong' },
      { 'x-profile-reader': secret, authorization: 'Bearer forged' },
      { 'x-profile-reader': secret, 'x-user-id': owner },
    ]) {
      const response = await fetch(origin + '/api/internal/profile-totals', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(input),
      });
      assert.ok([401, 403].includes(response.status));
    }
    for (const invalid of [
      { ...input, tenantId: 'other' },
      { ...input, categories: ['favorites'] },
    ]) {
      const response = await fetch(origin + '/api/internal/profile-totals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-profile-reader': secret,
        },
        body: JSON.stringify(invalid),
      });
      assert.equal(response.status, 400);
    }
  }
  let notify, release;
  const observed = new Promise((resolve) => {
    notify = resolve;
  });
  const proxy = http.createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const upstream = await fetch(options.discussionOrigin() + req.url, {
        method: req.method,
        headers: {
          'content-type': 'application/json',
          ...(req.headers['x-profile-reader']
            ? { 'x-profile-reader': req.headers['x-profile-reader'] }
            : {}),
        },
        ...(body.length ? { body } : {}),
        signal: AbortSignal.timeout(15000),
      });
      const payload = Buffer.from(await upstream.arrayBuffer());
      if (notify && req.url === '/api/internal/profile-totals') {
        const signal = notify;
        notify = null;
        await new Promise((resolve) => {
          release = resolve;
          signal();
        });
      }
      res.writeHead(upstream.status, { 'content-type': 'application/json' });
      res.end(payload);
    } catch {
      res.writeHead(503);
      res.end('{}');
    }
  });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  try {
    await options.restartAccount(
      undefined,
      `http://127.0.0.1:${proxy.address().port}`
    );
    const pending = account(null, route);
    await Promise.race([
      observed,
      pending.then((response) => {
        throw new Error(
          `Totals finished before privacy race: ${response.status}`
        );
      }),
    ]);
    await privacy('private', true);
    release();
    release = null;
    assert.equal((await pending).status, 404);
  } finally {
    if (release) release();
    await options.restartAccount(undefined, options.discussionOrigin());
    await new Promise((resolve) => proxy.close(resolve));
  }
  await privacy('public', true);
  await options.restartAccount(undefined, 'http://127.0.0.1:1');
  assert.equal((await account(null, route)).status, 503);
  await privacy('public', true, {
    showDiscussions: false,
    showFavorites: false,
  });
  assert.deepEqual(await read(), {
    ...expected,
    discussions: null,
    favorites: null,
  });
  await options.restartAccount(undefined, options.discussionOrigin());
  await privacy('public', true);
  assert.deepEqual(await read(), expected);
  pass(
    'profile totals: forged internal callers/scope rejected; privacy change during a real source response invalidates it; outage/retry and hidden dependency avoidance pass'
  );
  await require('./profile-totals-browser.cjs').profileTotalsBrowser({
    ...options,
    expected,
    read,
  });
}
module.exports = { profileTotalsChecks };
