const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function qualifyFeedContentPreferences(options) {
  const { a, b, stranger, guest, owner, other, go, text, click, preferences } =
    options;
  const directory = path.join(options.output, 'feed-content-preferences');
  fs.mkdirSync(directory, { recursive: true });
  const fixture = await require('./feed-content-preferences-fixture.cjs')(
    options
  );
  const application = fixture.applications.general;
  const routes = [
    {
      name: 'explore',
      path: '/',
      api: '/api/explore',
      host: 'explore-feed',
      refresh: 'Refresh activity',
      retry: 'Retry',
      failure: 'Could not load activity',
      loading: 'Loading activity',
    },
    {
      name: 'digest',
      path: '/digest',
      api: '/api/digest',
      host: 'digest-api-page',
      refresh: 'Refresh Digest',
      retry: 'Retry Digest',
      failure: 'Digest unavailable',
      loading: 'Loading Digest',
    },
    {
      name: 'timeline',
      path: `/apps/${application.fields.slug}/timeline`,
      api: `/api/applications/${application.fields.slug}/timeline`,
      host: 'application-timeline-api-page',
      refresh: 'Refresh timeline',
      retry: 'Retry timeline',
      failure: 'Timeline unavailable',
      loading: 'Loading application activity',
    },
  ];
  const groups = {
    latest: { size: 3, kind: null },
    articles: { size: 2, kind: 'article' },
    applications: { size: 2, kind: 'application' },
    discussions: { size: 1, kind: null },
  };
  const layouts = [],
    checks = [];
  function pass(message) {
    checks.push(message);
    options.pass('Feed content preferences: ' + message);
  }
  async function read(route, status = 200) {
    const response = await fetch(options.bffOrigin() + route, {
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    assert.equal(
      response.status,
      status,
      `${route}: ${JSON.stringify(result)}`
    );
    return result;
  }
  async function allItems() {
    const items = [];
    let after = null;
    for (let page = 0; page < 30; page++) {
      const value = await read(
        '/api/explore' + (after ? '?after=' + encodeURIComponent(after) : '')
      );
      items.push(...value.items);
      if (!value.after) return items;
      assert.notEqual(value.after, after);
      after = value.after;
    }
    throw new Error('Classification fixture paging exceeded its bound');
  }
  const ids = (page, host) =>
    page.$$eval(host + ' [data-id]', (nodes) =>
      nodes.map((node) => node.getAttribute('data-id'))
    );
  const switchAccount = (page, token) =>
    page.evaluate((token) => {
      const oldValue = localStorage.getItem('_i');
      if (token) localStorage.setItem('_i', token);
      else localStorage.removeItem('_i');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '_i',
          oldValue,
          newValue: token,
          storageArea: localStorage,
        })
      );
    }, token);
  async function navigate(page, route) {
    await page.bringToFront();
    await page.evaluate((route) => {
      history.pushState(null, '', route);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, route);
  }
  async function settle(page, route) {
    await page.waitForFunction(
      (route) => {
        const node = document.querySelector(route.host);
        if (!node || node.textContent.includes(route.loading)) return false;
        if (route.name === 'explore')
          return !!node.querySelector('.explore-items');
        if (route.name === 'digest')
          return !!node.querySelector('.digest-section');
        return !!node.querySelector('.timeline-items');
      },
      { timeout: 20000 },
      route
    );
  }
  function selected(items, enabled, size = items.length, kind = null) {
    const visible = items.filter(
      (item) => enabled || item.classification === 'general'
    );
    const at = (item) =>
      kind === 'article'
        ? item.publishedAt
        : kind === 'application'
        ? Date.parse(item.createdAt)
        : item.at;
    const key = (item) => `${kind || item.kind}:${item.id}`;
    visible.sort(
      (left, right) =>
        at(right) - at(left) || key(left).localeCompare(key(right))
    );
    return {
      ids: visible.slice(0, size).map((item) => item.id),
      hidden: items.length - visible.length,
    };
  }
  async function assertPage(page, route, enabled, raw) {
    await settle(page, route);
    if (route.name === 'digest') {
      for (const [name, spec] of Object.entries(groups)) {
        const host = `${route.host} [aria-labelledby="${name}-title"]`;
        const expected = selected(
          raw[name].items,
          enabled,
          spec.size,
          spec.kind
        );
        assert.deepEqual(
          await ids(page, host),
          expected.ids,
          `${route.name}/${name}`
        );
        const notices = await page.$$eval(
          host + ' > [role="status"]',
          (nodes) => nodes.map((node) => node.textContent.trim())
        );
        assert.deepEqual(
          notices,
          expected.hidden
            ? [
                `${expected.hidden} items hidden in this selection by your saved content choices.`,
              ]
            : []
        );
      }
    } else {
      const expected = selected(raw.items, enabled);
      assert.deepEqual(await ids(page, route.host), expected.ids, route.name);
      const body = await page.$eval(route.host, (node) => node.textContent);
      if (expected.hidden)
        assert.ok(
          body.includes(
            `${expected.hidden} items hidden on this page by your saved content choices.`
          )
        );
      assert.equal(
        await page.$$eval(route.host + ' button', (nodes) =>
          nodes.some((node) => node.textContent.trim() === 'Older activity')
        ),
        !!raw.after
      );
    }
  }
  async function capture(name, page, route) {
    for (const theme of ['light', 'dark']) {
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
      ]);
      for (const width of [1440, 768, 390]) {
        await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        await page.waitForFunction(
          (theme) => document.body.getAttribute('tuiTheme') === theme,
          {},
          theme
        );
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: 'instant' })
        );
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve))
            )
        );
        const measured = await page.$eval(route.host, (node) => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          feedSurface: node.matches('explore-feed')
            ? {
                color: getComputedStyle(node).backgroundColor,
                image: getComputedStyle(node).backgroundImage,
              }
            : null,
          headerGap: node.querySelector('ui-page-header')
            ? Math.round(
                node
                  .querySelector('.digest-content, .timeline-content')
                  .getBoundingClientRect().top -
                  node.querySelector('ui-page-header').getBoundingClientRect()
                    .bottom
              )
            : null,
          controlsFit: [...node.querySelectorAll('button')].every((button) => {
            const box = button.getBoundingClientRect();
            return (
              box.left >= -1 &&
              box.right <= innerWidth + 1 &&
              button.scrollWidth <= button.clientWidth + 1
            );
          }),
          width: node.getBoundingClientRect().width,
        }));
        assert.equal(measured.overflow, false, `${name}/${theme}/${width}`);
        assert.equal(measured.controlsFit, true, `${name}/${theme}/${width}`);
        if (measured.headerGap !== null)
          assert.equal(measured.headerGap, 24, `${name}/${theme}/${width}`);
        if (measured.feedSurface !== null)
          assert.ok(
            measured.feedSurface.color !== 'rgba(0, 0, 0, 0)' ||
              measured.feedSurface.image !== 'none',
            'Feed controls and notices must have a themed surface above the decoration'
          );
        layouts.push({ name, theme, viewport: width, ...measured });
        await page.screenshot({
          path: path.join(directory, `${name}-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }
  for (const [uid, enabled] of [
    [owner, true],
    [other, false],
  ])
    await preferences(uid, (value) => {
      value.display.theme = 'auto';
      value.content.feedSortOrder = 'recent';
      value.content.showMatureContent = enabled;
      value.content.contentFilters.excludedCategories = [];
      value.privacy.allowPersonalization = false;
    });

  const source = await allItems();
  for (const label of ['general', 'mature', 'unclassified']) {
    for (const collection of [
      fixture.applications,
      fixture.articles,
      fixture.suites,
      fixture.topics,
      fixture.reviews,
    ]) {
      const item = source.find((item) => item.id === collection[label].id);
      assert.ok(item, `Missing ${label} fixture ${collection[label].id}`);
      assert.equal(
        item.classification,
        label === 'unclassified' ? undefined : label
      );
    }
  }
  assert.ok(
    source.some(
      (item) => item.kind === 'release' && item.classification === undefined
    )
  );
  pass(
    'real approved application/article/suite classifications reach the feed; topics and reviews inherit their current parent; legacy releases remain unclassified'
  );

  for (const route of routes) {
    const raw = await read(route.api);
    for (const [page, enabled] of [
      [a, true],
      [b, true],
      [stranger, false],
      [guest, false],
    ]) {
      await go(page, route.path);
      await assertPage(page, route, enabled, raw);
    }
    assert.ok(
      (await ids(stranger, route.host)).length > 0,
      'General content remains visible'
    );
    await capture(route.name + '-mixed', stranger, route);
  }
  pass(
    'independent saved-account and guest choices select exact source IDs and hidden counts in Explore, all four Digest groups and the General application timeline'
  );

  for (const route of routes) {
    await go(b, route.path);
    await b.evaluate(() => {
      window.feedPreferencesDocument = 'same-document';
    });
    for (const enabled of [false, true]) {
      await navigate(b, '/me/settings/preferences');
      await b.waitForSelector('input[aria-label="Show Mature Content"]');
      const checked = await b.$eval(
        'input[aria-label="Show Mature Content"]',
        (input) => input.checked
      );
      assert.notEqual(checked, enabled);
      await b.focus('input[aria-label="Show Mature Content"]');
      await b.keyboard.press('Space');
      const saving = b.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/me/preferences' &&
          response.request().method() === 'PUT'
      );
      await click(b, 'Save Changes', 'settings-preferences-page');
      const saved = await saving;
      assert.equal(saved.status(), 200, await saved.text());
      await text(
        b,
        'Preferences saved to your account.',
        'settings-preferences-page'
      );
      await navigate(b, route.path);
      await assertPage(b, route, enabled, await read(route.api));
      assert.equal(
        await b.evaluate(() => window.feedPreferencesDocument),
        'same-document'
      );
      const persisted = await fetch(
        options.accountOrigin() + '/api/me/preferences',
        { headers: options.headers(owner) }
      );
      assert.equal(
        (await persisted.json()).preferences.content.showMatureContent,
        enabled
      );
    }
  }
  pass(
    'real settings saves change each consumer within the same running portal document and persist to Account'
  );

  for (const route of routes) {
    await go(a, route.path);
    await assertPage(a, route, true, await read(route.api));
    const responseStarted = options.holdResponse();
    await click(a, route.refresh, route.host);
    await responseStarted;
    await text(a, route.loading, route.host);
    const preferencesStarted = options.holdPreferences();
    await switchAccount(a, 'explore-other');
    await preferencesStarted;
    assert.deepEqual(await ids(a, route.host), []);
    options.releaseResponse();
    await a.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
    );
    assert.deepEqual(
      await ids(a, route.host),
      [],
      'Old response cannot restore content while current preferences are pending'
    );
    options.releasePreferences();
    await assertPage(a, route, false, await read(route.api));
    options.setPreferencesOffline(true);
    await switchAccount(a, 'explore-owner-a');
    await text(
      a,
      route.name === 'timeline'
        ? 'Content preferences unavailable'
        : route.failure,
      route.host
    );
    assert.deepEqual(await ids(a, route.host), []);
    await capture(route.name + '-preferences-unavailable', a, route);
    options.setPreferencesOffline(false);
    await click(
      a,
      route.name === 'timeline' ? 'Retry content preferences' : route.retry,
      route.host
    );
    await assertPage(a, route, true, await read(route.api));
  }
  pass(
    'held old-session responses stay hidden through current preference loading; Account preference outages clear every consumer and keyboard retry restores the current account'
  );

  const suite = fixture.suites.general;
  await fixture.edit(suite, 'mature');
  await fixture.submit(suite);
  await fixture.edit(suite, 'general');
  assert.equal(
    (await allItems()).find((item) => item.id === suite.id).classification,
    'general'
  );
  await fixture.approve(suite);
  for (const route of routes) {
    await read(route.api, 503);
    await go(stranger, route.path);
    await text(stranger, route.failure, route.host);
    assert.deepEqual(await ids(stranger, route.host), []);
  }
  await options.projectPublication('suite', suite.id);
  assert.equal(
    (await allItems()).find((item) => item.id === suite.id).classification,
    'mature'
  );
  await click(stranger, routes[2].retry, routes[2].host);
  await assertPage(stranger, routes[2], false, await read(routes[2].api));
  for (const route of routes) {
    await go(stranger, route.path);
    await assertPage(stranger, route, false, await read(route.api));
    assert.ok(!(await ids(stranger, route.host)).includes(suite.id));
  }
  pass(
    'private reclassification leaves approved content unchanged; independent approval binds the frozen submission, projection lag fails closed and canonical rebuild restores the new classification'
  );

  for (let index = 0; index < 10; index++)
    await fixture.publish('suite', 'hidden-page-' + index, 'mature');
  for (const route of routes) {
    await go(stranger, route.path);
    const raw = await read(route.api);
    await assertPage(stranger, route, false, raw);
    if (route.name === 'digest') {
      assert.deepEqual(
        await ids(stranger, route.host + ' [aria-labelledby="latest-title"]'),
        []
      );
      assert.ok(
        (
          await ids(
            stranger,
            route.host + ' [aria-labelledby="articles-title"]'
          )
        ).length > 0
      );
    } else {
      assert.equal(raw.items.length, 10);
      assert.ok(raw.after);
      assert.deepEqual(await ids(stranger, route.host), []);
    }
    await capture(route.name + '-hidden-selection', stranger, route);
    if (route.name !== 'digest') {
      await click(stranger, 'Older activity', route.host);
      await stranger.waitForFunction(() =>
        new URL(location.href).searchParams.has('activity')
      );
      await assertPage(
        stranger,
        route,
        false,
        await read(route.api + '?after=' + encodeURIComponent(raw.after))
      );
      assert.ok((await ids(stranger, route.host)).length > 0);
      await stranger.goBack({ waitUntil: 'networkidle0' });
      await assertPage(stranger, route, false, raw);
    }
  }
  pass(
    'a fully hidden ten-item page preserves its continuation and browser Back; Digest retains independent General article/application/discussion selections when latest activity is entirely hidden'
  );

  await fixture.edit(application, 'mature');
  await fixture.submit(application);
  let current = await allItems();
  for (const item of [fixture.topics.general, fixture.reviews.general])
    assert.equal(
      current.find((value) => value.id === item.id).classification,
      'general'
    );
  await fixture.approve(application);
  await read('/api/explore', 503);
  await options.projectPublication('app', application.id);
  current = await allItems();
  for (const item of [fixture.topics.general, fixture.reviews.general])
    assert.equal(
      current.find((value) => value.id === item.id).classification,
      'mature'
    );
  await go(guest, routes[2].path);
  await text(guest, 'Application hidden', routes[2].host);
  assert.deepEqual(await ids(guest, routes[2].host), []);
  assert.ok(
    !(await guest.$eval(routes[2].host, (node) => node.textContent)).includes(
      application.fields.name
    )
  );
  await capture('timeline-reclassified-parent', guest, routes[2]);
  await options.restartAccount();
  await options.restartBff();
  for (const route of routes.slice(0, 2)) {
    await go(b, route.path);
    await assertPage(b, route, true, await read(route.api));
    await go(stranger, route.path);
    await assertPage(stranger, route, false, await read(route.api));
  }
  pass(
    'reviewed parent reclassification updates discussion/review inheritance without rewriting their projections; hidden timeline metadata stays cleared and saved choices survive Account/BFF restart'
  );
  fs.writeFileSync(
    path.join(directory, 'qualification.json'),
    JSON.stringify(
      {
        checks,
        layouts,
        substitutions: [
          'Trusted local ingress identities; Account preferences use compiled real APIs and SQL',
          'New publications use author submission and independent staff review; original baseline fixtures remain unclassified',
          'Production materializer functions invoked directly; this run does not qualify broker delivery',
          'Legacy release inheritance is checked as unclassified; release parent changes and confirmation races have focused service tests',
          'External browser traffic blocked; deployment, restore/rollback/load/soak remain unqualified',
        ],
      },
      null,
      2
    )
  );
};
