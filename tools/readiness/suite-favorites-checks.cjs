/* Real account/Editorial APIs; existing qualification harness owns stores and cleanup. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');

async function suiteFavoritesChecks({
  accountOrigin,
  headers,
  identities,
  favorites,
  source,
  restartAccount,
  editorialOrigin,
  editorialHeaders,
  applicationId,
  reader,
  projections,
  pass,
}) {
  const owner = 'FavoriteSuiteOwner';
  const reviewer = 'FavoriteSuiteReviewer';
  const alice = 'SuiteFavoritesAlice';
  const bob = 'SuiteFavoritesBob';
  for (const uid of [alice, bob])
    await identities.ensure({
      uid,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
  async function editorial(method, path, body, review = false) {
    const response = await fetch(`${editorialOrigin()}/api/${path}`, {
      method,
      headers: {
        ...editorialHeaders(
          review ? reviewer : owner,
          'default',
          review ? ['editorial:reviewer'] : []
        ),
        'idempotency-key': randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(8000),
    });
    assert.ok(
      response.ok,
      `${method} ${path}: ${response.status} ${await response.clone().text()}`
    );
    return response.json();
  }
  const fields = (title) => ({
    title,
    description: 'A reviewed collection saved to an account.',
    applicationIds: [applicationId],
  });
  const project = async (id) =>
    projections.publish(
      projectEditorialSnapshot(await reader.read('suite', id))
    );
  async function publish(id) {
    const status = await editorial('GET', `me/suites/${id}/publication`);
    const submitted = await editorial('POST', `me/suites/${id}/submit`, {
      expectedRevision: status.revision,
    });
    await editorial(
      'POST',
      `editorial/suite-reviews/${id}/decision`,
      {
        decision: 'approve',
        expectedRevision: submitted.revision,
        submittedRevision: submitted.submittedRevision,
      },
      true
    );
  }
  async function create(title, visible = true) {
    const suite = await editorial('POST', 'me/suites', fields(title));
    if (visible) {
      await publish(suite.id);
      await project(suite.id);
    }
    return suite;
  }
  async function edit(id, title) {
    const status = await editorial('GET', `me/suites/${id}/publication`);
    await editorial('PUT', `me/suites/${id}`, {
      ...fields(title),
      expectedRevision: status.revision,
    });
  }
  async function withdraw(id) {
    const status = await editorial('GET', `me/suites/${id}/publication`);
    await editorial('POST', `me/suites/${id}/withdraw`, {
      expectedRevision: status.revision,
    });
  }
  const selection = (ids, suffix = '') =>
    fetch(
      `${editorialOrigin()}/api/catalog/suite-selection?ids=${ids.join(
        ','
      )}${suffix}`,
      { signal: AbortSignal.timeout(8000) }
    );
  const call = (uid, body, key = randomUUID()) =>
    fetch(`${accountOrigin()}/api/me/favorites`, {
      method: body ? 'PUT' : 'GET',
      headers: { ...headers(uid), 'idempotency-key': key },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(8000),
    });
  const input = (id, revision, saved = true) => ({
    expectedRevision: revision,
    target: { kind: 'suites', id },
    saved,
  });
  async function accepted(uid, body, key) {
    const response = await call(uid, body, key);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }
  const suite = await create('Favorite approved title', false);
  assert.equal((await call(alice, input(suite.id, 1))).status, 400);
  assert.deepEqual(await (await selection([suite.id])).json(), { items: [] });
  await publish(suite.id);
  assert.equal((await call(alice, input(suite.id, 1))).status, 503);
  await project(suite.id);
  const receipt = await accepted(alice, input(suite.id, 1), 'suite-save');
  assert.equal(receipt.revision, 2);
  assert.deepEqual(
    await accepted(alice, input(suite.id, 1), 'suite-save'),
    receipt
  );
  assert.deepEqual((await favorites.read(bob)).favorites, []);
  assert.equal(
    (
      await fetch(`${accountOrigin()}/api/me/favorites`, {
        headers: { 'x-user-id': alice },
      })
    ).status,
    401
  );
  const concurrent = await Promise.all(
    ['suite-one', 'suite-two'].map((key) => call(bob, input(suite.id, 1), key))
  );
  assert.deepEqual(
    concurrent.map((response) => response.status).sort(),
    [200, 409]
  );
  await edit(suite.id, 'A private replacement title');
  const selected = await selection([suite.id]);
  assert.equal(selected.headers.get('cache-control'), 'no-store');
  assert.equal(
    (await selected.json()).items[0].title,
    'Favorite approved title'
  );
  await restartAccount();
  assert.equal((await (await call(alice)).json()).favorites[0].id, suite.id);
  pass(
    'suite favorites: private/lagging targets denied, immutable approved metadata, retry, isolation, concurrent revision and account restart'
  );

  const before = await favorites.read(alice);
  await source.query(
    "CREATE TRIGGER fail_suite_favorite_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected suite favorite failure'"
  );
  try {
    assert.equal(
      (await call(alice, input(suite.id, 2, false), 'suite-remove')).status,
      503
    );
    assert.deepEqual(await favorites.read(alice), before);
  } finally {
    await source.query('DROP TRIGGER fail_suite_favorite_outbox');
  }
  await withdraw(suite.id);
  assert.deepEqual(await (await selection([suite.id])).json(), { items: [] });
  assert.equal((await call(alice, input(suite.id, 2))).status, 400);
  assert.deepEqual(
    await accepted(alice, input(suite.id, 1), 'suite-save'),
    receipt
  );
  await accepted(alice, input(suite.id, 2, false), 'suite-remove');
  await accepted(alice, input(suite.id, 1), 'suite-save');
  assert.deepEqual((await favorites.read(alice)).favorites, []);
  assert.equal((await favorites.read(bob)).favorites[0].id, suite.id);
  await publish(suite.id);
  assert.equal((await selection([suite.id])).status, 503);
  await project(suite.id);
  assert.equal(
    (await (await selection([suite.id])).json()).items[0].title,
    'A private replacement title'
  );
  await accepted(alice, input(suite.id, 3));
  const status = await editorial('GET', `me/suites/${suite.id}/publication`);
  await editorial('DELETE', `me/suites/${suite.id}`, {
    expectedRevision: status.revision,
  });
  assert.equal(
    (await (await selection([suite.id])).json()).items[0].id,
    suite.id
  );
  await withdraw(suite.id);
  assert.deepEqual(await (await selection([suite.id])).json(), { items: [] });
  await accepted(alice, input(suite.id, 4, false));
  pass(
    'suite favorites: outbox failure rolls back, private deletion retains approved metadata, withdrawal revokes it, removal survives target loss and old receipts cannot restore membership'
  );

  const selectedIds = [];
  for (let index = 0; index < 21; index++)
    selectedIds.push((await create(`Selected suite ${index}`)).id);
  const batch = await selection([...selectedIds, randomUUID(), selectedIds[0]]);
  assert.equal(batch.status, 200);
  assert.deepEqual(
    new Set((await batch.json()).items.map((item) => item.id)),
    new Set(selectedIds)
  );
  assert.equal((await selection(Array(51).fill(selectedIds[0]))).status, 400);
  assert.equal(
    (await selection([selectedIds[0]], '&tenantId=other')).status,
    400
  );
  assert.equal((await selection(['slug'])).status, 400);
  pass(
    'suite selection: more than a catalog page, stable UUID membership, deduplication and bounded public-only query validation'
  );

  return async ({
    page,
    second,
    bob: bobPage,
    alice: browserAlice,
    go,
    text,
    click,
    capture,
    commands,
    controls,
  }) => {
    const current = await create('Saved suite collection');
    const route = `/suites/${current.id}`;
    const favoriteRoute = '/my/favourites/suites';
    const captureAll = async (state) => {
      for (const theme of ['light', 'dark'])
        for (const width of [390, 768, 1440]) {
          await page.setViewport({ width, height: 1000 });
          await page.emulateMediaFeatures([
            { name: 'prefers-color-scheme', value: theme },
          ]);
          await page.waitForFunction(
            (theme) => document.body.getAttribute('tuiTheme') === theme,
            {},
            theme
          );
          await capture(state, theme, width);
        }
    };
    await go(route);
    await text('Saved suite collection');
    await captureAll('suite-detail');
    controls.loseReceipt();
    await click('Add to Favorites', page, 'favorite-toggle-button button');
    await text('Could not confirm the change');
    const lost = commands.at(-1);
    await captureAll('suite-save-unconfirmed');
    await click('Add to Favorites', page, 'favorite-toggle-button button');
    await page.waitForSelector(
      'favorite-toggle-button button[aria-pressed="true"]'
    );
    assert.equal(commands.at(-1).key, lost.key);
    assert.deepEqual(commands.at(-1).body, lost.body);
    await go(favoriteRoute, second);
    await text('Saved suite collection', second);
    await go(favoriteRoute, bobPage);
    await text('No favorites yet', bobPage);
    await go('/my/favourite/apps');
    await text('No favorites yet');
    await restartAccount();
    await go(favoriteRoute);
    await text('Saved suite collection');
    await page.waitForSelector(`.favorites-page a[href="${route}"]`);
    await captureAll('suite-favorites');
    await edit(current.id, 'Unreviewed private change');
    await click('Reload favorites', page, 'ui-page-header button');
    await text('Saved suite collection');
    await publish(current.id);
    await click('Reload favorites', page, 'ui-page-header button');
    await text('Saved item details could not be loaded');
    await captureAll('suite-projection-lag');
    await project(current.id);
    await click('Reload favorites', page, 'ui-page-header button');
    await text('Unreviewed private change');
    const saved = await favorites.read(browserAlice);
    await accepted(browserAlice, {
      expectedRevision: saved.revision,
      saved: true,
      target: { kind: 'applications', id: applicationId },
    });
    await click(
      'Remove from Favorites',
      page,
      '.favorites-page favorite-toggle-button button'
    );
    await text('Your account changed');
    await click('Reload favorites', page, 'ui-page-header button');
    await text('Unreviewed private change');
    assert.equal(
      await page.$('.favorites-page a[href^="/apps/"]'),
      null,
      'Suite filter must exclude application favorites'
    );
    await go(`/suites?q=${encodeURIComponent('Unreviewed private change')}`);
    await text('Unreviewed private change');
    await page.waitForSelector(
      'favorite-toggle-button button[aria-pressed="true"]'
    );
    await captureAll('suite-catalog-favorite');
    await withdraw(current.id);
    await go(favoriteRoute);
    await text('Unavailable suite');
    assert.equal(await page.$(`.favorites-page a[href="${route}"]`), null);
    await captureAll('suite-withdrawn-favorite');
    controls.catalogOffline(true);
    await click('Reload favorites', page, 'ui-page-header button');
    await text('Saved item details could not be loaded');
    await click(
      'Remove from Favorites',
      page,
      '.favorites-page favorite-toggle-button button'
    );
    await text('No favorites yet');
    assert.equal(
      (await favorites.read(browserAlice)).favorites.some(
        (item) => item.kind === 'suites'
      ),
      false
    );
    controls.catalogOffline(false);
    await captureAll('suite-favorites-empty');
    pass(
      'suite favorites browser: saved detail/list/filter, lost response retry, independent sessions, restart, stale conflict, approved replacement/lag, withdrawal and offline removal'
    );
  };
}

module.exports = { suiteFavoritesChecks };
