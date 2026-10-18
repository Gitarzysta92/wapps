const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { processService } = require('./qualification-process.cjs');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');
const {
  parsePublicDiscoveryQuery,
  parsePublicDiscovery,
  selectPublicDiscovery,
} = require('../../libs/domains/discovery/src');

module.exports = async function qualifyDiscoveryTags({
  root,
  origin,
  secret,
  restart,
  stop,
  reader,
  projections,
  collection,
  pass,
}) {
  const headers = (tenantId = 'default', reviewer = false) => ({
    'content-type': 'application/json',
    'x-user-id': reviewer ? 'DiscoveryTagReviewer' : 'DiscoveryTagAuthor',
    'x-user-claims': JSON.stringify({
      tenantId,
      roles: reviewer ? ['editorial:reviewer'] : [],
    }),
    'x-ingress-auth': secret,
  });
  async function command(route, method, body, actor = headers()) {
    const response = await fetch(origin() + '/api/' + route, {
      method,
      headers: { ...actor, 'idempotency-key': randomUUID() },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    const value = await response.json();
    assert(response.ok, route + ': ' + JSON.stringify(value));
    return value;
  }
  const project = async (id) =>
    projections.publish(
      projectEditorialSnapshot(await reader.read('article', id))
    );
  const fields = (index, tags, classification = 'general') => ({
    title: `Tag parity ${String(index).padStart(2, '0')}`,
    slug: `tag-parity-${index}`,
    excerpt: 'Approved article tag intersection.',
    byline: 'Tag parity author',
    category: 'Guides',
    tags,
    ...(classification ? { classification } : {}),
    sections: [{ heading: 'Tags', paragraphs: ['Approved tag evidence.'] }],
  });
  async function publish(
    index,
    tags,
    classification = 'general',
    tenant = 'default'
  ) {
    const input = fields(index, tags, classification);
    const draft = await command('me/articles', 'POST', input, headers(tenant));
    await command(
      `me/articles/${draft.id}/submit`,
      'POST',
      { expectedRevision: 1, expectedPublicationRevision: null },
      headers(tenant)
    );
    await command(
      `editorial/article-reviews/${draft.id}/decision`,
      'POST',
      {
        decision: 'approve',
        expectedRevision: 2,
        expectedPublicationRevision: null,
        submittedRevision: 1,
        reason: '',
      },
      headers(tenant, true)
    );
    if (tenant === 'default') await project(draft.id);
    return { ...draft, input };
  }
  const articles = [];
  for (let i = 0; i < 5; i++)
    articles.push(await publish(i, ['offline', 'web', 'privacy']));
  await publish(5, ['web']);
  await publish(6, ['offline']);
  await publish(7, ['offline', 'web'], 'mature');
  await publish(8, ['offline', 'web'], null);
  await publish(9, ['offline', 'web'], 'general', 'other');
  await command('me/articles', 'POST', fields(10, ['offline', 'web']));
  const current = await command(`me/articles/${articles[0].id}`, 'GET');
  await command(`me/articles/${articles[0].id}`, 'PUT', {
    ...articles[0].input,
    tags: ['private-edit'],
    expectedRevision: current.revision,
  });
  pass(
    'Tag fixtures: real approved publications, single-tag nonmatches, Mature/unclassified items, private edits/drafts and other tenant'
  );

  let bff;
  async function startBff(editorialUrl = origin()) {
    await bff?.stop();
    bff = await processService(
      process.execPath,
      [path.join(root, 'dist/apps/services/catalog-bff/main.js')],
      {
        cwd: root,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          HOST: '127.0.0.1',
          PORT: '0',
          EDITORIAL_URL: editorialUrl,
          DISCUSSION_URL: 'http://127.0.0.1:1',
          EXPLORE_SERVICE_SECRET: 'discovery-tag-parity-secret-2026',
        },
      },
      (log) =>
        log.match(/Catalog BFF is running on: (http:\/\/[^\s]+)\/api/)?.[1],
      '/api/health'
    );
  }
  const base = 'type=article&search=Tag+parity&tags=offline,web&pageSize=2';
  async function read(query = base, expected = 200, actor = {}) {
    const response = await fetch(
      bff.origin + '/api/catalog/discover?' + query,
      { headers: actor, signal: AbortSignal.timeout(20000) }
    );
    const value = await response.json();
    assert.equal(response.status, expected, JSON.stringify(value));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return value;
  }
  try {
    await startBff();
    const first = await read();
    assert.deepEqual(
      first.groups.map((g) => [g.kind, g.total, g.totalPages, g.items.length]),
      [['article', 7, 4, 2]]
    );
    assert(
      first.groups[0].items.every((i) =>
        ['offline', 'web'].every((tag) => i.tags.includes(tag))
      )
    );
    assert.deepEqual(
      await read(
        'type=article&search=Tag+parity&tag=web,offline,web&pageSize=2'
      ),
      first
    );
    assert.deepEqual(
      await read(
        'type=articles&search=Tag+parity&tag=web&tags=offline&pageSize=2'
      ),
      first
    );
    const ids = new Set();
    for (let page = 1; page <= 4; page++) {
      const result = (await read(base + '&articlePage=' + page)).groups[0];
      assert.equal(result.total, 7);
      for (const item of result.items) {
        assert(!ids.has(item.id));
        ids.add(item.id);
      }
    }
    assert.equal(ids.size, 7);
    assert.equal((await read(base + '&articlePage=10000')).groups[0].page, 4);
    assert.equal(
      (await read(base + '&sort=name-desc')).groups[0].items[0].title,
      'Tag parity 08'
    );
    const all = await read(
      'type=article&search=Tag+parity&tags=offline,web&pageSize=100'
    );
    assert.equal(
      (await read('type=article&tags=offline,web,missing')).groups[0].total,
      0
    );
    assert.equal((await read(base + '&category=Unknown')).groups[0].total, 0);
    assert.equal(
      (await read('type=article&tags=private-edit')).groups[0].total,
      0
    );
    assert.deepEqual(await read(base, 200, headers()), first);
    assert.deepEqual(await read(base, 200, headers('other')), first);
    pass(
      'Real BFF/owner tag intersection: exact totals, all pages, clamping, sort, alias/dedup, empty results and public scope independent of caller claims'
    );

    const query = parsePublicDiscoveryQuery({
      type: 'article',
      search: 'Tag parity',
      tags: 'offline,web',
      pageSize: '100',
    });
    const parsed = parsePublicDiscovery(all, query);
    assert.equal(selectPublicDiscovery(parsed, [], false)[0].items.length, 5);
    assert.equal(selectPublicDiscovery(parsed, [], true)[0].items.length, 7);
    assert.equal(
      selectPublicDiscovery(parsed, ['Guides'], true)[0].items.length,
      0
    );
    assert.equal(selectPublicDiscovery(parsed, [], false)[0].total, 7);
    pass(
      'Production classification selector with real source results: anonymous/default hides Mature and unclassified; explicit choice/exclusion changes preserve source totals (preference persistence substituted)'
    );

    for (const query of [
      'type=article&tags=web,Bad',
      'type=article&tags=web,,offline',
      'type=article&tags=' +
        Array.from({ length: 13 }, (_, i) => 'tag-' + i).join(','),
      'type=article&tags=web&tenantId=other',
      'tags=web,offline',
      'type=suite&tags=web,offline',
    ])
      await read(query, 400);
    const owner = await fetch(
      origin() + '/api/catalog/articles?tags=offline,web&pageSize=2&sort=name'
    );
    assert.equal(owner.status, 200);
    assert.equal((await owner.json()).total, 7);
    const legacy = await fetch(origin() + '/api/catalog/articles?tag=web');
    assert.equal(legacy.status, 200);
    assert.equal((await legacy.json()).total, 8);
    const invalid = await fetch(
      origin() + '/api/catalog/articles?tags=web,,offline'
    );
    assert.equal(invalid.status, 400);
    pass(
      'Owner and BFF query validation: legacy single-tag retained, 12-tag bound, invalid/mixed-kind/private selectors rejected'
    );

    await collection.deleteOne({ kind: 'article', resourceId: articles[0].id });
    await read(base, 503);
    await project(articles[0].id);
    assert.deepEqual(await read(), first);
    const stale = await projections.find('article', articles[0].id);
    const status = await command(
      `me/articles/${articles[0].id}/publication`,
      'GET'
    );
    await command(`me/articles/${articles[0].id}/withdraw`, 'POST', {
      expectedRevision: status.revision,
      expectedPublicationRevision: status.publicationRevision,
    });
    assert.equal((await read()).groups[0].total, 6);
    assert(
      !(await read()).groups[0].items.some((i) => i.id === articles[0].id)
    );
    await project(articles[0].id);
    await projections.publish(stale);
    assert.equal((await read()).groups[0].total, 6);
    assert.equal((await read(base + '&articlePage=10000')).groups[0].page, 3);
    pass(
      'Selected projection lag fails closed; canonical withdrawal changes count/page before projection delivery and survives old snapshot replay'
    );

    const persisted = await read();
    await stop();
    await read(base, 503);
    await restart();
    await startBff();
    assert.deepEqual(await read(), persisted);
    await startBff('http://127.0.0.1:1');
    await read(base, 503);
    await startBff();
    assert.deepEqual(await read(), persisted);
    pass(
      'Compiled BFF/Editorial restarts preserve results; unavailable source/binding fails without cached or fixture success'
    );
  } finally {
    await bff?.stop();
  }
};
