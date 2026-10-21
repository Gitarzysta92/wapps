const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { processService } = require('./qualification-process.cjs');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');

module.exports = async function qualifyDiscovery({
  root,
  source,
  origin,
  secret,
  restart,
  stop,
  reader,
  projections,
  collection,
  pass,
  output,
  browser,
  community,
  viewOnly = false,
  overviewOnly = false,
}) {
  const headers = (
    uid = 'DiscoveryAuthor',
    tenantId = 'default',
    roles = []
  ) => ({
    'content-type': 'application/json',
    'x-user-id': uid,
    'x-user-claims': JSON.stringify({ tenantId, roles }),
    'x-ingress-auth': secret,
  });
  async function call(
    route,
    method = 'GET',
    body,
    actor = headers(),
    expected = 200,
    key = randomUUID()
  ) {
    const response = await fetch(origin() + '/api/' + route, {
      method,
      headers: { ...actor, 'idempotency-key': key },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    const value = await response.json();
    assert.equal(
      response.status,
      expected,
      route + ': ' + JSON.stringify(value)
    );
    return value;
  }
  const project = async (kind, id) =>
    projections.publish(projectEditorialSnapshot(await reader.read(kind, id)));
  const staff = headers('DiscoveryReviewer', 'default', ['editorial:reviewer']);
  const applications = [],
    articles = [],
    suites = [];
  const articleFields = (index) => ({
    classification: 'general',
    title: `Team article ${String(index).padStart(2, '0')}`,
    slug: `team-article-${index}`,
    excerpt: 'A reviewed guide to choosing tools for a team.',
    byline: 'Discovery author',
    category: 'Guides',
    tags: ['collaboration'],
    sections: [
      {
        heading: 'Choose your tools',
        paragraphs: ['This is the approved article body.'],
      },
    ],
  });
  for (let index = 0; index < 23; index++) {
    const number = String(index).padStart(2, '0');
    const app = await call(
      'me/application-drafts',
      'POST',
      {
        classification: 'general',
        name: `Team application ${number}`,
        slug: `team-application-${index}`,
        description: 'Tools that help a team work together.',
        website: 'https://example.test',
      },
      headers(),
      201
    );
    await call(
      `me/application-drafts/${app.id}/submit`,
      'POST',
      { expectedRevision: 1 },
      headers(),
      201
    );
    await call(
      `editorial/application-reviews/${app.id}/decision`,
      'POST',
      {
        decision: 'approve',
        expectedRevision: 2,
        submittedRevision: 1,
        reason: '',
      },
      staff,
      201
    );
    await project('app', app.id);
    assert.equal(
      (await projections.find('app', app.id)).content.classification,
      'general',
      'Approved application classification'
    );
    applications.push(app);
    const article = await call(
      'me/articles',
      'POST',
      articleFields(index),
      headers(),
      201
    );
    await call(
      `me/articles/${article.id}/submit`,
      'POST',
      { expectedRevision: 1, expectedPublicationRevision: null },
      headers(),
      201
    );
    await call(
      `editorial/article-reviews/${article.id}/decision`,
      'POST',
      {
        decision: 'approve',
        expectedRevision: 2,
        expectedPublicationRevision: null,
        submittedRevision: 1,
        reason: '',
      },
      staff,
      201
    );
    await project('article', article.id);
    assert.equal(
      (await projections.find('article', article.id)).content.classification,
      'general',
      'Approved article classification'
    );
    articles.push(article);
    const suite = await call(
      'me/suites',
      'POST',
      {
        title: `Team suite ${number}`,
        classification: 'general',
        description: 'A reviewed collection for working together.',
        applicationIds: [app.id],
      },
      headers(),
      201
    );
    await call(
      `me/suites/${suite.id}/submit`,
      'POST',
      { expectedRevision: 1 },
      headers(),
      201
    );
    await call(
      `editorial/suite-reviews/${suite.id}/decision`,
      'POST',
      {
        decision: 'approve',
        expectedRevision: 2,
        submittedRevision: 1,
        reason: '',
      },
      staff,
      201
    );
    await project('suite', suite.id);
    assert.equal(
      (await projections.find('suite', suite.id)).content.classification,
      'general',
      'Approved suite classification'
    );
    suites.push(suite);
  }
  await call(
    'me/articles',
    'POST',
    { ...articleFields(90), title: 'Team private article' },
    headers(),
    201
  );
  await call(
    'me/suites',
    'POST',
    {
      title: 'Team private suite',
      description: 'Not submitted',
      applicationIds: [applications[0].id],
    },
    headers(),
    201
  );
  await call(
    'apps',
    'POST',
    { name: 'Team other tenant', slug: 'team-other-tenant' },
    headers('OtherPublisher', 'other', ['editorial:publisher']),
    201
  );
  const revision = (await call(`me/articles/${articles[0].id}`)).revision;
  await call(`me/articles/${articles[0].id}`, 'PUT', {
    ...articleFields(0),
    title: 'Private title must stay private',
    expectedRevision: revision,
  });
  pass(
    'Created real approved applications, articles and suites; private edits and other-tenant content remain outside public discovery'
  );

  let bff;
  const restartBff = async () => {
    await bff?.stop();
    await community.restart();
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
          EDITORIAL_URL: origin(),
          DISCUSSION_URL: community.origin,
          INGRESS_AUTH_SECRET: secret,
          EXPLORE_SERVICE_SECRET: 'qualification-discovery-secret-2026',
        },
      },
      (log) =>
        log.match(/Catalog BFF is running on: (http:\/\/[^\s]+)\/api/)?.[1],
      '/api/health'
    );
  };
  const read = async (query = 'search=team&pageSize=2', expected = 200) => {
    const response = await fetch(
      bff.origin + '/api/catalog/discover?' + query,
      { signal: AbortSignal.timeout(20000) }
    );
    assert.equal(response.status, expected);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response.json();
  };
  try {
    await restartBff();
    const reviewResponse = await fetch(bff.origin + `/api/application-reviews/${applications[0].id}/mine`, {
      method: 'PUT',
      headers: { ...headers('DiscoveryMember'), 'idempotency-key': randomUUID() },
      body: JSON.stringify({ expectedRevision: 0, content: {
        displayName: 'Discovery reviewer', rating: 4, text: 'A durable review shown in Discover.',
      } }),
      signal: AbortSignal.timeout(15000),
    });
    const publishedReview = await reviewResponse.json();
    assert.equal(reviewResponse.status, 200, JSON.stringify(publishedReview));
    const first = await read();
    assert.equal(first.groups[0].items[0].details.reviews.preview.id, publishedReview.id);
    assert.equal(first.groups[0].items[0].details.reviews.rating, 4);
    assert.equal(first.groups[0].items[0].details.reviews.total, 1);
    assert.deepEqual(first.groups[0].items[1].details.reviews, { total: 0, rating: null, preview: null });
    await community.pause();
    await read(undefined, 503);
    await restartBff();
    assert.deepEqual(await read(), first);
    pass('Discover composes persisted Community reviews; review outage fails truthfully and restart recovers the same rating, byline and preview');
    assert.deepEqual(
      first.groups.map((group) => [
        group.kind,
        group.total,
        group.items.length,
      ]),
      [
        ['application', 23, 2],
        ['article', 23, 2],
        ['suite', 23, 2],
      ]
    );
    assert.equal(first.groups[1].items[0].title, 'Team article 00');
    for (const group of first.groups)
      assert.deepEqual(
        group.items.map((item) => item.classification),
        ['general', 'general'],
        group.kind
      );
    for (const size of [1, 10, 20, 50, 100]) {
      const result = await read('search=team&pageSize=' + size);
      assert(
        result.groups.every(
          (group) => group.items.length === Math.min(size, 23)
        )
      );
    }
    const next = await read(
      'search=team&pageSize=20&applicationPage=2&articlePage=2&suitePage=2'
    );
    assert(
      next.groups.every((group) => group.items.length === 3 && group.page === 2)
    );
    const descending = await read('search=team&pageSize=2&sort=name-desc');
    assert(
      descending.groups.every((group) => group.items[0].title.endsWith('22'))
    );
    const newest = await read('search=team&pageSize=100&sort=newest');
    assert(
      newest.groups.every((group) =>
        group.items.every(
          (item, index) => !index || item.at <= group.items[index - 1].at
        )
      )
    );
    assert(
      (await read('search=team&page=10000')).groups.every(
        (group) => group.page === 2
      )
    );
    assert.equal(
      (await read('type=article&category=Guides&tag=collaboration')).groups[0]
        .total,
      23
    );
    assert(
      (await read('search=%25_')).groups.every((group) => group.total === 0)
    );
    for (const query of [
      'tenantId=other',
      'pageSize=101',
      'type=suite&category=Guides',
      'type=article&platform=web',
      'social=github',
    ])
      await read(query, 400);
    pass(
      'Real BFF: all groups, literal case-insensitive search, exact totals, type filters, independent pages, sort and bounded 1/10/20/50/100 page sizes'
    );

    await collection.deleteOne({ kind: 'article', resourceId: articles[0].id });
    await read(undefined, 503);
    await project('article', articles[0].id);
    assert.deepEqual(await read(), first);
    const stale = await projections.find('suite', suites[22].id);
    const status = await call(`me/suites/${suites[22].id}/publication`);
    await call(
      `me/suites/${suites[22].id}/withdraw`,
      'POST',
      { expectedRevision: status.revision },
      headers(),
      201
    );
    assert.equal((await read()).groups[2].total, 22);
    await project('suite', suites[22].id);
    await projections.publish(stale);
    assert.equal((await read()).groups[2].total, 22);
    pass(
      'Missing selected projection fails all groups; authoritative rebuild recovers; withdrawal remains hidden before and after tombstone/reordered replay'
    );
    const classified = await require('./classification-runtime-checks.cjs')({
      call,
      headers,
      source,
      project,
      projections,
      read,
      applicationId: applications[0].id,
      pass,
    });
    const classifiedBeforeRestart = await read(
      'search=Classification&pageSize=100'
    );
    const persisted = await read();
    await stop();
    await read(undefined, 503);
    await restart();
    await restartBff();
    assert.deepEqual(await read(), persisted);
    assert.deepEqual(
      await read('search=Classification&pageSize=100'),
      classifiedBeforeRestart
    );
    pass(
      'Compiled Editorial/BFF process restart preserves discovery; service outage is unavailable and recovers without cached or demo results'
    );

    if (browser)
      await require('./application-draft-browser.cjs').applicationDraftBrowser({
        root,
        origin: overviewOnly ? () => bff.origin : origin,
        discoveryOrigin: () => bff.origin,
        ...(overviewOnly ? {
          discussionOrigin: () => bff.origin,
          discussionHeaders: (uid, roles) => uid ? headers(uid, 'default', roles) : { 'x-ingress-auth': secret, 'x-anonymous': 'true' },
        } : {}),
        headers,
        source,
        restart,
        output,
        workflowOnly: true,
        preferencesFixture: (uid, defaults) => ({
          ...defaults,
          content: {
            ...defaults.content,
            showMatureContent: uid === 'DraftBrowserBob',
          },
        }),
        articleWorkflow: async ({
          session,
          go,
          text,
          capture,
          setOffline,
          fill,
          click,
          holdNextRead,
        }) => {
          if (overviewOnly) return require('./application-overview-browser-checks.cjs')({
            session, go, text, capture, setOffline, click, holdNextRead,
            applications, bffOrigin: () => bff.origin, headers, community,
            restartBff, classified, output, anonymousHeaders: { 'x-ingress-auth': secret, 'x-anonymous': 'true' },
          });
          const homeChecks = viewOnly ? [] : await require('./home-preview-browser-checks.cjs')(
            {
              session,
              go,
              text,
              capture,
              setOffline,
              fill,
              holdNextRead,
              expected: await read('search=team&pageSize=3&sort=name'),
            }
          );
          const publicContentChecks = viewOnly ? [] :
            await require('./public-content-browser-checks.cjs')({
              classified,
              session,
              go,
              text,
              capture,
              click,
              setOffline,
            });
          const subpageChecks = viewOnly ? [] :
            await require('./application-subpages-browser-checks.cjs')({
              classified,
              session,
              go,
              text,
              capture,
              click,
              setOffline,
            });
          const classificationChecks = viewOnly ? [] :
            await require('./classification-browser-checks.cjs')({
              classified,
              session,
              go,
              text,
              capture,
              click,
              call,
              headers,
              project,
            });
          const one = await session(''),
            two = await session('');
          const route = '/discover?search=team&pageSize=2';
          await go(route, one);
          await text('Team article 00', one);
          await text('Team suite 00', one);
          await text('Discovery reviewer', one);
          assert.equal(
            await one.$$eval('discover-api-page .item-card', (cards) => cards.length),
            6
          );
          assert.equal(await one.$$eval('#application app-voting-chip, #suite app-voting-chip', cards => cards.length), 4);
          assert.equal(await one.$eval('#application top-review-card', card => card.textContent.includes('A durable review shown in Discover.')), true);
          assert.equal(await one.$eval('#application .result-link', link => link.getAttribute('href')), '/apps/team-application-0/overview');
          assert.equal(await one.$eval('#article ui-tags a', link => link.getAttribute('href')), '/tags/collaboration');
          assert.equal(await one.$$eval('discover-api-page profile-badges', badges => badges.length), 0);
          await capture('grouped-discovery', one, async page => {
            const viewport = page.viewport();
            const theme = await page.evaluate(() => document.body.getAttribute('tuiTheme'));
            const cards = [];
            for (const kind of ['application', 'article', 'suite']) {
              const card = await page.$(`#${kind} .item-card`);
              await card.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
              // Settle content-visibility before capturing an offscreen card's actual paint.
              await new Promise(resolve => setTimeout(resolve, 500));
              const file = `discover-${kind}-viewport-${theme}-${viewport.width}.png`;
              await page.screenshot({ path: path.join(output, file) });
              cards.push({ kind, file });
            }
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
            return { settledCards: cards };
          });
          await click('Display options', one);
          await one.waitForSelector('select[aria-label="Order"]', { visible: true });
          await one.select('select[aria-label="Order"]', 'name-desc');
          await text('Team article 22', one);
          assert.equal(new URL(one.url()).searchParams.get('sort'), 'name-desc');
          await one.keyboard.press('Escape');
          await go(route, one);
          await text('Team article 00', one);
          const taxonomyResponse = one.waitForResponse(response => new URL(response.url()).pathname === '/api/catalog/apps' && response.status() === 200);
          await click('Manage filters', one);
          await taxonomyResponse;
          await one.keyboard.press('Escape');

          await go(route, two);
          await text('Team article 00', two);
          const next = await one.$('button[aria-label="Next Articles page"]');
          await next.focus();
          await one.keyboard.press('Enter');
          await text('Team article 02', one);
          await text('Team application 00', one);
          assert.equal(new URL(one.url()).searchParams.get('articlePage'), '2');
          await one.goBack({ waitUntil: 'networkidle0' });
          await text('Team article 00', one);
          for (const kind of ['article', 'suite', 'application']) {
            const link = await one.$eval('#' + kind + ' .result-link', (element) =>
              element.getAttribute('href')
            );
            await go(link, two);
            await two.waitForFunction(
              (label) => document.body.textContent.includes(label),
              {},
              `Team ${kind} 00`
            );
          }
          await fill(
            'discover-api-page search-bar input',
            'missing-query',
            one
          );
          await click('Search', one);
          await text('No results found', one);
          await one.goBack({ waitUntil: 'networkidle0' });
          await text('Team article 00', one);
          assert.equal(
            await one.$eval('discover-api-page search-bar input', (input) => input.value),
            'team'
          );
          setOffline((path) => path === '/api/catalog/discover');
          await click('Refresh results', one);
          await text('Discover unavailable', one);
          assert.equal(
            await one.$$eval('discover-api-page .item-card', (cards) => cards.length),
            0
          );
          setOffline(false);
          await click('Retry search', one);
          await text('Team article 00', one);
          await go('/search?q=team&type=articles&pageSize=2', one);
          await text('Team article 00', one);
          assert.equal(
            await one.$$eval('.discovery-group', (groups) => groups.length),
            1
          );
          await go('/discover?social=github', one);
          await text('Adjust your search', one);
          assert.equal(
            await one.$$eval('discover-api-page .item-card', (cards) => cards.length),
            0
          );
          return [
            ...homeChecks,
            ...publicContentChecks,
            ...subpageChecks,
            ...classificationChecks,
            'Independent browsers share durable public results',
            'Accepted Discover card sections, canonical detail/tag links and actual persisted review previews; unavailable metrics remain explicit',
            'Keyboard paging and Back restore independent groups and search input',
            'All three result links open real detail pages',
            'Search empty, invalid filters, loading/outage and retry states',
            'Legacy search aliases remain usable',
          ];
        },
      });
    if (browser)
      pass(
        'Independent real-service browsers and six light/dark 390/768/1440 layouts'
      );
  } finally {
    await bff?.stop();
  }
};
