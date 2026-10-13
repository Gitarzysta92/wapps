const assert = require('node:assert/strict');

module.exports = async function publicContentBrowserChecks({
  classified,
  session,
  go,
  text,
  capture,
  click,
  setOffline,
}) {
  const restricted = await session('draft-alice');
  const unrestricted = await session('draft-bob');
  const guest = await session('');
  const detail = (kind, item) =>
    kind === 'app'
      ? '/apps/' + item.slug
      : kind === 'article'
      ? '/articles/' + item.slug
      : '/suites/' + item.id;
  const host = (kind) =>
    kind === 'app'
      ? 'app-application-overview-page'
      : kind === 'article'
      ? 'app-article-catalog'
      : 'suite-publication-page';
  async function switchAccount(page, token) {
    await page.evaluate((token) => {
      localStorage.setItem('_i', token);
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '_i',
          newValue: token,
          storageArea: localStorage,
        })
      );
    }, token);
  }
  for (const spec of classified) {
    const label =
      spec.kind === 'app'
        ? 'Application'
        : spec.kind === 'article'
        ? 'Article'
        : 'Suite';
    const [general, mature, legacy] = spec.variants;
    const title = (item) => item.name ?? item.title;
    for (const page of [restricted, guest]) {
      await go(detail(spec.kind, general), page);
      await text(title(general), page);
      if (page === restricted)
        await capture('public-' + spec.kind + '-general', page);
      for (const item of [mature, legacy]) {
        await go(detail(spec.kind, item), page);
        await text(label + ' hidden by your content preferences', page);
        const visible = await page.$eval(
          host(spec.kind),
          (element) => element.textContent
        );
        assert(
          !visible.includes(title(item)),
          'Hidden title must not remain in the public page'
        );
        assert.equal(
          await page.$(host(spec.kind) + ' favorite-toggle-button'),
          null
        );
        assert.equal(await page.$(host(spec.kind) + ' article-comments'), null);
      }
    }
    await capture('public-' + spec.kind + '-hidden', restricted);
    await go(detail(spec.kind, mature), unrestricted);
    await text(title(mature), unrestricted);
    await switchAccount(unrestricted, 'draft-alice');
    await text(label + ' hidden by your content preferences', unrestricted);
    assert(
      !(
        await unrestricted.$eval(
          host(spec.kind),
          (element) => element.textContent
        )
      ).includes(title(mature))
    );
    await switchAccount(unrestricted, 'draft-bob');
    await text(title(mature), unrestricted);

    setOffline((path) => path === '/api/me/preferences');
    await switchAccount(unrestricted, 'draft-alice');
    await text('Your content preferences could not be loaded', unrestricted);
    assert.equal(
      await unrestricted.$(host(spec.kind) + ' favorite-toggle-button'),
      null
    );
    setOffline(false);
    await click('Retry content preferences', unrestricted);
    await text(label + ' hidden by your content preferences', unrestricted);
    await switchAccount(unrestricted, 'draft-bob');
    await text(title(mature), unrestricted);
  }
  for (const spec of classified) {
    const route =
      spec.kind === 'app'
        ? '/categories/classification-tools?search=Classification'
        : spec.kind === 'article'
        ? '/articles?q=Classification'
        : '/suites?q=Classification';
    await go(route, restricted);
    await text(
      '2 ' +
        (spec.kind === 'app'
          ? 'results'
          : spec.kind === 'article'
          ? 'articles'
          : 'suites') +
        ' on this page are hidden',
      restricted
    );
    await capture('public-' + spec.kind + '-listing', restricted);
    const root = spec.kind === 'app' ? 'results-page' : host(spec.kind);
    assert(
      !(
        await restricted.$eval(root, (element) => element.textContent)
      ).includes(spec.variants[1].name ?? spec.variants[1].title)
    );
    await go(route, unrestricted);
    await text(spec.variants[1].name ?? spec.variants[1].title, unrestricted);
    await switchAccount(unrestricted, 'draft-alice');
    await text(
      '2 ' +
        (spec.kind === 'app'
          ? 'results'
          : spec.kind === 'article'
          ? 'articles'
          : 'suites') +
        ' on this page are hidden',
      unrestricted
    );
    await switchAccount(unrestricted, 'draft-bob');
  }
  const suite = classified.find((spec) => spec.kind === 'suite');
  await go('/suites/' + suite.id, restricted);
  await text('Application hidden by your content preferences', restricted);
  assert.equal(
    await restricted.$$eval('.suite-member a', (links) => links.length),
    1
  );
  assert.equal(
    await restricted.$$eval(
      '.suite-member',
      (rows) =>
        rows.filter((row) =>
          row.textContent.includes('hidden by your content preferences')
        ).length
    ),
    2
  );
  await capture('public-suite-mixed-members', restricted);
  await go('/suites/' + suite.id, unrestricted);
  await unrestricted.waitForFunction(
    () => document.querySelectorAll('.suite-member a').length === 3
  );
  return [
    'Reviewed classifications govern application listings/overviews, article lists/details and public suite lists/details',
    'Mature and unclassified content stays hidden for guests and disabled members, with source totals retained',
    'Account switches and preference outages clear public content; explicit retry restores the current account choice',
    'General suites keep hidden member metadata and links out while preserving visible General members',
  ];
};
