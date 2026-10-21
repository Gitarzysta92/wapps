const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');

async function profileArticlesChecks(options) {
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
    article,
    articleFields,
    pass,
  } = options;
  const route = `profiles/${ownerId}/articles`;
  const read = (uid = null, after = null) =>
    account(uid, route + (after ? '?after=' + after : '')).then(accepted);
  const project = async (id) =>
    options.projections.publish(
      projectEditorialSnapshot(await options.reader.read('article', id))
    );
  const raw = (
    method,
    endpoint,
    body,
    uid = owner,
    tenant = 'default',
    roles = []
  ) =>
    fetch(options.origin() + '/api/' + endpoint, {
      method,
      headers: {
        ...options.headers(uid, tenant, roles),
        'idempotency-key': randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    }).then(accepted);
  async function approve(
    id,
    uid = owner,
    tenant = 'default',
    materialize = true
  ) {
    let current = await raw(
      'GET',
      `me/articles/${id}/publication`,
      undefined,
      uid,
      tenant
    );
    await raw(
      'POST',
      `me/articles/${id}/submit`,
      {
        expectedRevision: current.revision,
        expectedPublicationRevision: current.publicationRevision,
      },
      uid,
      tenant
    );
    current = await raw(
      'GET',
      `me/articles/${id}/publication`,
      undefined,
      uid,
      tenant
    );
    await raw(
      'POST',
      `editorial/article-reviews/${id}/decision`,
      {
        decision: 'approve',
        expectedRevision: current.revision,
        expectedPublicationRevision: current.publicationRevision,
        submittedRevision: current.latestSubmission.submittedRevision,
        reason: '',
      },
      'IndependentArticleReviewer',
      tenant,
      ['editorial:reviewer']
    );
    if (materialize && tenant === 'default') await project(id);
  }
  const expected = {
    id: article.id,
    slug: articleFields.slug,
    title: articleFields.title,
    excerpt: articleFields.excerpt,
    publishedAt: (await read()).items[0].publishedAt,
  };
  assert.deepEqual(await read(), {
    sharing: 'visible',
    items: [expected],
    after: null,
  });
  const response = await account(null, route);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Authorization');
  for (const query of [
    'ownerIdentityId=Other',
    'tenantId=private',
    'after=x',
    `after=${article.id}&after=${article.id}`,
    'page=2',
  ])
    assert.equal((await account(null, route + '?' + query)).status, 400);
  await privacy('public', false);
  for (const viewer of [null, owner])
    assert.deepEqual(await read(viewer), {
      sharing: 'hidden',
      items: [],
      after: null,
    });
  await privacy('private', true);
  for (const viewer of [null, follower])
    assert.equal((await account(viewer, route)).status, 404);
  await privacy('public', true);
  const draft = await editorial('GET', `me/articles/${article.id}`);
  await editorial('PUT', `me/articles/${article.id}`, {
    expectedRevision: draft.revision,
    ...articleFields,
    title: 'Revised profile article',
  });
  await editorial('POST', 'me/articles', {
    ...articleFields,
    slug: 'unpublished-profile-article',
    title: 'Private draft',
  });
  for (const [uid, tenant, slug] of [
    [follower, 'default', 'other-author-article'],
    [owner, 'private', 'private-tenant-article'],
  ]) {
    const other = await raw(
      'POST',
      'me/articles',
      { ...articleFields, slug },
      uid,
      tenant
    );
    await approve(other.id, uid, tenant);
  }
  assert.deepEqual(
    (await read()).items,
    [expected],
    'Private edits, drafts, byline duplicates, other authors and private tenants do not enter this collection'
  );
  const oldProjection = await options.projections.find('article', article.id);
  await approve(article.id, owner, 'default', false);
  assert.equal(
    (await account(null, route)).status,
    503,
    'New authority cannot read an older projection'
  );
  await project(article.id);
  assert.equal((await read()).items[0].title, 'Revised profile article');
  assert.equal(await options.projections.publish(oldProjection), 'superseded');
  const projections = options.mongo
    .db('suites')
    .collection('editorial_projections_v1');
  await projections.deleteOne({ kind: 'article', resourceId: article.id });
  assert.equal(
    (await account(null, route)).status,
    503,
    'Projection loss is unavailable, never an empty collection'
  );
  await project(article.id);
  assert.equal((await read()).items[0].title, 'Revised profile article');
  await withdraw('article', 'articles', article.id);
  assert.deepEqual(await read(), {
    sharing: 'visible',
    items: [],
    after: null,
  });
  await publish('article', 'articles', article.id);
  pass(
    'profile articles: canonical author/tenant isolation, no-store, strict scope, Show Activity History/owner preview, private edits/drafts, exact-generation lag, projection loss/rebuild, stale replay and immediate withdrawal'
  );

  const published = [article.id];
  for (let i = 0; i < 20; i++) {
    const next = await editorial('POST', 'me/articles', {
      ...articleFields,
      slug: `profile-collection-article-${i}`,
      title: `Published profile article ${i}`,
    });
    await publish('article', 'articles', next.id);
    published.push(next.id);
  }
  const first = await read();
  assert.equal(first.items.length, 20);
  assert.equal(first.after, first.items[19].id);
  const second = await read(null, first.after);
  assert.equal(second.items.length, 1);
  assert.equal(second.after, null);
  assert.deepEqual(
    [...first.items, ...second.items].map((item) => item.id),
    [...published].sort()
  );
  assert.equal(
    (await account(null, `profiles/${ownerId}/totals`).then(accepted)).articles,
    21,
    'The unpaged owner count remains complete'
  );
  await options.restartAccount(options.origin());
  assert.deepEqual(await read(), first);
  pass(
    'profile articles: 21 production-reviewed publications page across 20/1 without duplicates or private metadata; complete totals and Account restart persist'
  );

  const secret = options.accountHeaders(owner)['x-ingress-auth'];
  const input = { ownerIdentityId: owner, after: null };
  for (const headers of [
    {},
    { 'x-profile-reader': 'wrong' },
    { 'x-profile-reader': secret, authorization: 'Bearer forged' },
    { 'x-profile-reader': secret, 'x-user-id': owner },
  ]) {
    const denied = await fetch(
      options.origin() + '/api/internal/profile-articles',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(input),
      }
    );
    assert.ok([401, 403].includes(denied.status));
  }
  for (const invalid of [
    { ...input, tenantId: 'other' },
    { ...input, after: [] },
  ]) {
    const denied = await fetch(
      options.origin() + '/api/internal/profile-articles',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-profile-reader': secret,
        },
        body: JSON.stringify(invalid),
      }
    );
    assert.equal(denied.status, 400);
  }
  let notify, release;
  const proxy = http.createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const upstream = await fetch(options.origin() + req.url, {
        method: req.method,
        headers: {
          'content-type': 'application/json',
          'x-profile-reader': req.headers['x-profile-reader'] ?? '',
        },
        ...(body.length ? { body } : {}),
        signal: AbortSignal.timeout(15000),
      });
      const payload = Buffer.from(await upstream.arrayBuffer());
      if (notify && req.url === '/api/internal/profile-articles') {
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
    await options.restartAccount(`http://127.0.0.1:${proxy.address().port}`);
    for (const mutation of [
      () => privacy('public', false),
      () => privacy('private', true),
    ]) {
      await privacy('public', true);
      const observed = new Promise((resolve) => {
        notify = resolve;
      });
      const pending = account(null, route);
      await Promise.race([
        observed,
        pending.then((result) => {
          throw new Error(
            `Articles completed before privacy race: ${result.status}`
          );
        }),
      ]);
      await mutation();
      release();
      release = null;
      assert.equal((await pending).status, 404);
    }
  } finally {
    if (release) release();
    await options.restartAccount(options.origin());
    await new Promise((resolve) => proxy.close(resolve));
  }
  await privacy('public', true);
  await options.restartAccount('http://127.0.0.1:1');
  assert.equal((await account(null, route)).status, 503);
  await privacy('public', false);
  assert.deepEqual(await read(), { sharing: 'hidden', items: [], after: null });
  await options.restartAccount(options.origin());
  await privacy('public', true);
  assert.deepEqual(await read(), first);
  pass(
    'profile articles: internal credentials and scope fail closed; actual held content responses are discarded after audience/sharing changes; unavailable/retry and hidden dependency avoidance'
  );

  const {
    publicProfileCollectionBrowser,
  } = require('./public-profile-favorites-browser.cjs');
  const assertLinks = (links, items) => {
    assert.equal(links.length, items.length);
    links.forEach((link, index) => {
      assert.ok(link.title.includes(items[index].title));
      assert.ok(
        link.href.endsWith('/articles/' + items[index].slug),
        link.href
      );
    });
  };
  await publicProfileCollectionBrowser(
    { ...options, read, output: path.join(options.output, 'profile-articles') },
    {
      kind: 'articles',
      title: 'Published articles',
      controls: 'published articles',
      setting: 'Show Activity History',
      hidden: 'Articles are not shared',
      changeSharing: 'Change activity sharing',
      emptyText: 'No shared published articles',
      nextCount: 1,
      restoredCount: 1,
      assertFirst: (links) => assertLinks(links, first.items),
      assertNext: (links) => assertLinks(links, second.items),
      assertDetail: async (page) => {
        await page.waitForFunction(
          (title) => document.querySelector('h1')?.textContent.includes(title),
          {},
          first.items[0].title
        );
      },
      empty: async () => {
        for (const id of published) await withdraw('article', 'articles', id);
      },
      restore: () => publish('article', 'articles', article.id),
    }
  );
}
module.exports = { profileArticlesChecks };
