const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

module.exports = async function qualifyFavoritesContentPreferences(options) {
  const { a, b, stranger, owner, other, go, text, click, preferences } =
    options;
  const directory = path.join(options.output, 'favorites-content-preferences');
  fs.mkdirSync(directory, { recursive: true });
  const fixture = await require('./feed-content-preferences-fixture.cjs')(
    options
  );
  const targets = ['general', 'mature', 'unclassified'].flatMap(
    (classification) => {
      const app = fixture.applications[classification];
      const article = fixture.articles[classification];
      const suite = fixture.suites[classification];
      return [
        {
          kind: 'applications',
          id: app.id,
          title: app.fields.name,
          path: '/apps/' + app.fields.slug,
          classification,
        },
        {
          kind: 'articles',
          id: article.id,
          title: article.fields.title,
          path: '/articles/' + article.fields.slug,
          classification,
        },
        {
          kind: 'suites',
          id: suite.id,
          title: suite.fields.title,
          path: '/suites/' + suite.id,
          classification,
        },
        {
          kind: 'discussions',
          id: fixture.topics[classification].id,
          title: `Feed preference discussion ${classification}`,
          path: `/apps/${app.fields.slug}/discussions/${fixture.topics[classification].id}`,
          classification,
        },
      ];
    }
  );
  const layouts = [],
    checks = [];
  function pass(message) {
    checks.push(message);
    options.pass('Favorites content preferences: ' + message);
  }
  async function account(uid, method = 'GET', body) {
    const response = await fetch(
      options.accountOrigin() + '/api/me/favorites',
      {
        method,
        headers: { ...options.headers(uid), 'idempotency-key': randomUUID() },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000),
      }
    );
    const value = await response.json();
    assert.equal(
      response.status,
      200,
      `${method} favorites ${JSON.stringify(
        body?.target ?? null
      )}: ${JSON.stringify(value)}`
    );
    return value;
  }
  async function save(uid, target, saved) {
    const current = await account(uid);
    return account(uid, 'PUT', {
      expectedRevision: current.revision,
      target: { kind: target.kind, id: target.id },
      saved,
    });
  }
  async function replace(uid, selected) {
    const current = await account(uid);
    for (const target of current.favorites) await save(uid, target, false);
    for (const target of selected) await save(uid, target, true);
  }
  const navigate = (page, route) =>
    page.evaluate((route) => {
      history.pushState(null, '', route);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, route);
  const switchAccount = (page, token) =>
    page.evaluate((token) => {
      const oldValue = localStorage.getItem('_i');
      localStorage.setItem('_i', token);
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '_i',
          oldValue,
          newValue: token,
          storageArea: localStorage,
        })
      );
    }, token);
  async function assertView(page, selected, enabled, state = 'ready') {
    const expected = selected
      .map((target) => {
        const visible =
          state === 'ready' && (enabled || target.classification === 'general');
        return {
          key: target.kind + ':' + target.id,
          title: visible
            ? target.title
            : state === 'ready'
            ? 'Hidden by content preferences'
            : state === 'loading'
            ? 'Loading saved item'
            : 'Details unavailable',
          link: visible ? target.path : null,
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
    await page.bringToFront();
    await page.waitForFunction(
      (expected) => {
        const actual = [
          ...document.querySelectorAll('favorites-page .favorites-page__item'),
        ]
          .map((row) => ({
            key:
              row.getAttribute('data-kind') + ':' + row.getAttribute('data-id'),
            title: row
              .querySelector(
                ':scope > a, :scope > span'
              )
              ?.textContent.trim(),
            link:
              row
                .querySelector(':scope > a')
                ?.getAttribute('href') ?? null,
          }))
          .sort((a, b) => a.key.localeCompare(b.key));
        return JSON.stringify(actual) === JSON.stringify(expected);
      },
      { timeout: 20000 },
      expected
    );
    const rows = await page.$$eval(
      'favorites-page .favorites-page__item',
      (rows) =>
        rows.map((row) => ({
          key:
            row.getAttribute('data-kind') + ':' + row.getAttribute('data-id'),
          images: row.querySelectorAll('img').length,
          removable: !!row.querySelector(
            'button[aria-label="Remove from Favorites"]:not(:disabled)'
          ),
        }))
    );
    assert.ok(
      rows.every((row) => row.removable),
      'Every saved reference remains removable'
    );
    assert.ok(rows.every((row) => row.images === 0));
    const sidebar = await page.$$eval(
      'user-auxiliary-sidebar .favorite-app-avatar',
      (links) =>
        links
          .map((link) => ({
            path: link.getAttribute('href'),
            title: link.getAttribute('title'),
          }))
          .sort((a, b) => a.path.localeCompare(b.path))
    );
    // A type-filtered page still shares the full favorite application sidebar.
    const currentFavorites = await account(page === stranger ? other : owner);
    const currentTargets = targets.map(
      (target) =>
        selected.find(
          (item) => item.kind === target.kind && item.id === target.id
        ) ?? target
    );
    const apps = currentTargets.filter(
      (target) =>
        target.kind === 'applications' &&
        currentFavorites.favorites.some(
          (favorite) =>
            favorite.kind === target.kind && favorite.id === target.id
        ) &&
        state === 'ready' &&
        (enabled || target.classification === 'general')
    );
    assert.deepEqual(
      sidebar,
      apps
        .map((target) => ({ path: target.path, title: target.title }))
        .sort((a, b) => a.path.localeCompare(b.path))
    );
  }
  async function capture(name, page) {
    for (const theme of ['light', 'dark']) {
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
      ]);
      for (const width of [1440, 768, 390]) {
        await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        await page.waitForFunction(
          (theme) => {
            const scopes = [...document.querySelectorAll('[tuiTheme]')];
            const cards = [
              ...document.querySelectorAll('favorites-page ui-medium-card'),
            ];
            return (
              scopes.every(
                (scope) => scope.getAttribute('tuiTheme') === theme
              ) &&
              cards.length > 0 &&
              cards.every((card) => {
                const style = getComputedStyle(card);
                const foreground =
                  style.color
                    .match(/[\d.]+/g)
                    ?.slice(0, 3)
                    .map(Number) ?? [];
                const brightness = foreground.reduce(
                  (total, value) => total + value,
                  0
                );
                return theme === 'light'
                  ? style.backgroundColor === 'rgb(255, 255, 255)' &&
                      style.backgroundImage === 'none' &&
                      brightness < 384
                  : style.backgroundImage !== 'none' && brightness > 384;
              })
            );
          },
          { timeout: 10000 },
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
        const measured = await page.$eval('favorites-page', (node) => ({
          cardSurfaces: [...node.querySelectorAll('ui-medium-card')].map(
            (card) => ({
              color: getComputedStyle(card).color,
              backgroundColor: getComputedStyle(card).backgroundColor,
              backgroundImage: getComputedStyle(card).backgroundImage,
            })
          ),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          headerGap: Math.round(
            node.querySelector('.favorites-page').getBoundingClientRect().top -
              node.querySelector('ui-page-header').getBoundingClientRect()
                .bottom
          ),
          controlsFit: [...node.querySelectorAll('button')].every((button) => {
            const box = button.getBoundingClientRect();
            return (
              box.left >= -1 &&
              box.right <= innerWidth + 1 &&
              button.scrollWidth <= button.clientWidth + 1
            );
          }),
        }));
        assert.equal(measured.overflow, false, `${name}/${theme}/${width}`);
        assert.equal(measured.controlsFit, true, `${name}/${theme}/${width}`);
        assert.equal(measured.headerGap, 24, `${name}/${theme}/${width}`);
        layouts.push({ name, theme, viewport: width, ...measured });
        await page.screenshot({
          path: path.join(directory, `${name}-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }
  async function remove(page, target) {
    const selector = `.favorites-page__item[data-kind="${target.kind}"][data-id="${target.id}"] button[aria-label="Remove from Favorites"]`;
    await page.focus(selector);
    const response = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/me/favorites' &&
        response.request().method() === 'PUT'
    );
    await page.keyboard.press('Enter');
    const result = await response;
    assert.equal(result.status(), 200, await result.text());
    await page.waitForFunction(
      (selector) => !document.querySelector(selector),
      {},
      selector
    );
    assert.equal(
      (await account(owner)).favorites.some(
        (item) => item.kind === target.kind && item.id === target.id
      ),
      false
    );
  }

  await replace(owner, targets);
  const otherTargets = targets.filter(
    (target) =>
      target.kind === 'applications' && target.classification === 'mature'
  );
  await replace(other, otherTargets);
  await preferences(owner, (value) => {
    value.content.showMatureContent = false;
    value.display.theme = 'auto';
  });
  await preferences(other, (value) => {
    value.content.showMatureContent = false;
    value.display.theme = 'auto';
  });
  await go(a, '/me/favorite');
  await go(b, '/me/favorite');
  await assertView(a, targets, false);
  await assertView(b, targets, false);
  await text(a, '8 saved items are hidden', 'favorites-page');
  await capture('mixed', a);
  for (const [kind, route] of [
    ['applications', '/my/favourite/apps'],
    ['suites', '/my/favourites/suites'],
    ['articles', '/my/favourites/articles'],
  ]) {
    await go(a, route);
    await assertView(
      a,
      targets.filter((item) => item.kind === kind),
      false
    );
    await text(a, '2 saved items are hidden', 'favorites-page');
  }
  pass(
    'independent browsers and all three type-filtered routes show only approved General metadata; sidebar hides Mature and unclassified apps; counts match the selected group'
  );

  await go(b, '/me/favorite');
  await b.evaluate(() => {
    window.favoritesPreferencesDocument = 'same-document';
  });
  for (const enabled of [true, false]) {
    await navigate(b, '/me/settings/preferences');
    await b.waitForSelector('input[aria-label="Show Mature Content"]');
    assert.notEqual(
      await b.$eval(
        'input[aria-label="Show Mature Content"]',
        (input) => input.checked
      ),
      enabled
    );
    await b.focus('input[aria-label="Show Mature Content"]');
    await b.keyboard.press('Space');
    await click(b, 'Save Changes', 'settings-preferences-page');
    await text(
      b,
      'Preferences saved to your account.',
      'settings-preferences-page'
    );
    await navigate(b, '/me/favorite');
    await assertView(b, targets, enabled);
    assert.equal(
      await b.evaluate(() => window.favoritesPreferencesDocument),
      'same-document'
    );
  }
  pass(
    'real settings saves update favorite metadata and sidebar within the same document, including explicit mature-enabled visibility'
  );

  await go(a, '/me/favorite');
  const selectionsStarted = options.holdSelections();
  await click(a, 'Reload favorites', 'favorites-page');
  await selectionsStarted;
  const preferencesStarted = options.holdPreferences();
  await switchAccount(a, 'explore-other');
  await preferencesStarted;
  await assertView(a, otherTargets, false, 'loading');
  options.releaseSelections();
  await assertView(a, otherTargets, false, 'loading');
  options.releasePreferences();
  // The switched browser is the other account, so verify its sidebar separately.
  await text(a, '1 saved item is hidden', 'favorites-page');
  assert.equal(
    await a.$$eval('.favorites-page__item', (rows) => rows.length),
    1
  );
  assert.equal(
    await a.$$eval(
      'user-auxiliary-sidebar .favorite-app-avatar',
      (links) => links.length
    ),
    0
  );
  await go(stranger, '/me/favorite');
  await assertView(stranger, otherTargets, false);
  pass(
    'held old-account metadata cannot return during new-account preference loading; independent account has only its own saved reference'
  );

  options.setPreferencesOffline(true);
  await switchAccount(a, 'explore-owner-a');
  await text(a, 'Content preferences could not be loaded', 'favorites-page');
  await assertView(a, targets, false, 'unavailable');
  await capture('preferences-unavailable', a);
  const outageRemoval = targets.find(
    (target) =>
      target.kind === 'articles' && target.classification === 'unclassified'
  );
  await remove(a, outageRemoval);
  const afterOutage = targets.filter((target) => target !== outageRemoval);
  await assertView(a, afterOutage, false, 'unavailable');
  options.setPreferencesOffline(false);
  await click(a, 'Retry preferences', 'favorites-page');
  await assertView(a, afterOutage, false);
  await save(owner, outageRemoval, true);
  await click(a, 'Reload favorites', 'favorites-page');
  await assertView(a, targets, false);
  pass(
    'preference outages hide all metadata without disabling removal; keyboard retry reloads the saved choice and remaining references'
  );

  options.setSelectionsOffline(true);
  await click(a, 'Reload favorites', 'favorites-page');
  await text(a, 'Saved item details could not be loaded', 'favorites-page');
  await assertView(a, targets, false, 'unavailable');
  await capture('metadata-unavailable', a);
  options.setSelectionsOffline(false);
  await click(a, 'Retry details', 'favorites-page');
  await assertView(a, targets, false);
  pass(
    'metadata failure is distinct from preference failure and from an empty collection; retry restores the current filtered set'
  );

  for (const target of targets.filter(
    (target) => target.classification === 'general'
  ))
    await save(owner, target, false);
  const hiddenTargets = targets.filter(
    (target) => target.classification !== 'general'
  );
  await click(a, 'Reload favorites', 'favorites-page');
  await assertView(a, hiddenTargets, false);
  await capture('all-hidden', a);
  const removed = [];
  for (const kind of ['applications', 'suites', 'articles', 'discussions']) {
    const target = hiddenTargets.find(
      (target) => target.kind === kind && target.classification === 'mature'
    );
    await remove(a, target);
    removed.push(target);
    await assertView(
      a,
      hiddenTargets.filter((item) => !removed.includes(item)),
      false
    );
  }
  await options.restartAccount();
  await options.restartBff();
  await go(b, '/me/favorite');
  await assertView(
    b,
    hiddenTargets.filter((item) => !removed.includes(item)),
    false
  );
  assert.equal((await account(owner)).favorites.length, 4);
  pass(
    'all-hidden collections remain usable; keyboard removal of all four kinds survives Account/BFF restart and a second browser'
  );

  await replace(owner, targets);
  const suite = fixture.suites.general;
  await fixture.edit(suite, 'mature');
  await go(a, '/me/favorite');
  await assertView(a, targets, false);
  await fixture.submit(suite);
  await fixture.edit(suite, 'general');
  await fixture.approve(suite);
  await click(a, 'Reload favorites', 'favorites-page');
  await text(a, 'Saved item details could not be loaded', 'favorites-page');
  await assertView(a, targets, false, 'unavailable');
  await options.projectPublication('suite', suite.id);
  const reclassified = targets.map((target) =>
    target.id === suite.id && target.kind === 'suites'
      ? { ...target, classification: 'mature' }
      : target
  );
  await click(a, 'Retry details', 'favorites-page');
  await assertView(a, reclassified, false);
  await capture('reclassified-suite', a);
  pass(
    'private edits do not alter approved classification; frozen approval hides the suite after projection rebuild, while lag fails closed'
  );

  const application = fixture.applications.general;
  await fixture.edit(application, 'mature');
  await fixture.submit(application);
  await click(a, 'Reload favorites', 'favorites-page');
  await assertView(a, reclassified, false);
  await fixture.approve(application);
  await click(a, 'Reload favorites', 'favorites-page');
  await text(a, 'Saved item details could not be loaded', 'favorites-page');
  await options.projectPublication('app', application.id);
  const inherited = reclassified.map((target) =>
    (target.kind === 'applications' && target.id === application.id) ||
    (target.kind === 'discussions' && target.id === fixture.topics.general.id)
      ? { ...target, classification: 'mature' }
      : target
  );
  await click(a, 'Retry details', 'favorites-page');
  await assertView(a, inherited, false);
  await capture('reclassified-parent', a);
  await go(b, '/me/favorite');
  await assertView(b, inherited, false);
  pass(
    'parent approval changes application and discussion visibility without rewriting discussion projections; both independent browsers hide inherited metadata'
  );

  fs.writeFileSync(
    path.join(directory, 'qualification.json'),
    JSON.stringify(
      {
        checks,
        layouts,
        favorites: targets.length,
        substitutions: [
          'Trusted local ingress identities; real Account preferences and favorite commands',
          'Real Editorial author/staff publication and Discussion commands with SQL/Mongo/MinIO/OPA',
          'Production materializer functions called directly; this run does not qualify broker delivery',
          'External browser traffic blocked; production provider/restore/rollback/load/soak remain unqualified',
        ],
      },
      null,
      2
    ) + '\n'
  );
};
