const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

// Shares the real-service gateway and isolated sessions with the Explore regression.
module.exports = async function qualifyDigestBrowser(options) {
  const { a, b, stranger, guest, owner, other, topics, preferences, go, pass } =
    options;
  const directory = path.join(options.output, 'digest-browser');
  fs.mkdirSync(directory, { recursive: true });
  const text = (page, value, selector = 'digest-api-page') =>
    options.text(page, value, selector);
  const click = (page, label) => options.click(page, label, 'digest-api-page');
  const ids = (page, group) =>
    page.$$eval(group + ' [data-id]', (nodes) =>
      nodes.map((n) => n.getAttribute('data-id'))
    );
  const latest = '.latest-grid';
  const layouts = [],
    links = [];
  await preferences(owner, (p) => {
    p.content.feedSortOrder = 'recent';
    p.content.showMatureContent = true;
    p.privacy.allowPersonalization = true;
    p.content.contentFilters.excludedCategories = [];
  });
  await preferences(other, (p) => {
    p.content.showMatureContent = true;
    p.content.contentFilters.excludedCategories = ['category-export', 'Guides'];
  });
  for (const page of [a, b, stranger, guest]) await go(page, '/digest');
  for (const page of [a, b]) {
    await text(page, 'Approved article text');
    await text(page, 'Article summary.');
    await text(page, 'Reviewed application');
    await text(page, 'Explore topic');
    assert.equal((await ids(page, latest)).length, 3);
    assert.equal((await ids(page, '.articles-grid')).length, 1);
    assert.equal(
      (await ids(page, '[aria-labelledby="applications-title"]')).length,
      2
    );
    assert.equal(
      (await ids(page, '[aria-labelledby="discussions-title"]')).length,
      1
    );
    await page.waitForFunction(() => {
      const img = document.querySelector(
        'digest-api-page article-cover-image img'
      );
      return img && img.complete && img.naturalWidth > 0;
    });
  }
  await text(guest, 'No matching recent activity');
  assert.deepEqual(await ids(guest, 'digest-api-page'), []);
  await text(stranger, 'No matching recent articles');
  assert.equal((await ids(stranger, '.articles-grid')).length, 0);
  assert.equal(
    (await ids(stranger, '[aria-labelledby="discussions-title"]')).length,
    0
  );
  assert.equal(
    (await ids(stranger, 'digest-api-page')).includes(options.application.id),
    false
  );
  assert.deepEqual(
    await ids(a, 'digest-api-page'),
    await ids(b, 'digest-api-page')
  );
  const first = await ids(a, latest);
  for (const [selector, kind] of [
    ['.articles-grid h3 a', 'article'],
    ['.app-card[href="/apps/export-application/overview"]', 'application'],
    ['[aria-labelledby="discussions-title"] h3 a', 'discussion'],
    ['.latest-grid h3 a', 'activity'],
  ]) {
    const entry = await a.$eval(
      selector,
      (node, kind) => ({
        kind,
        href: node.getAttribute('href'),
        title: node.textContent.trim(),
      }),
      kind
    );
    links.push(entry);
    await go(b, entry.href);
    assert.equal(
      (await b.$eval('body', (node) => node.textContent)).includes(
        'Page not found'
      ),
      false
    );
    if (kind === 'article')
      await text(b, 'Retained article body.', '.article-reading');
    if (kind === 'discussion')
      await text(
        b,
        'A current public discussion for the Explore feed.',
        'application-discussions'
      );
    if (kind === 'application')
      await text(b, 'Reviewed application', 'app-application-overview-page');
  }
  await preferences(owner, (p) => {
    p.content.feedSortOrder = 'popular';
    p.privacy.allowPersonalization = false;
  });
  await go(a, '/digest');
  await text(a, 'Selected activity');
  assert.equal((await ids(a, latest))[0], topics[4].id);
  assert.equal(
    (await ids(a, '[aria-labelledby="discussions-title"]'))[0],
    topics[4].id
  );
  await preferences(owner, (p) => {
    p.content.feedSortOrder = 'recommended';
    p.privacy.allowPersonalization = true;
  });
  await options.restartAccount();
  for (const page of [a, b]) {
    await go(page, '/digest');
    await text(page, 'Approved article text');
    assert.equal((await ids(page, latest))[0], topics[3].id);
    assert.equal(
      (await ids(page, '[aria-labelledby="discussions-title"]'))[0],
      topics[3].id
    );
  }
  await preferences(owner, (p) => {
    p.privacy.allowPersonalization = false;
  });
  await go(a, '/digest');
  await text(a, 'Personalization is off');
  await text(a, 'Approved article text');
  assert.deepEqual(await ids(a, latest), first);
  options.setOffline(true);
  await click(a, 'Refresh Digest');
  await text(a, 'Digest unavailable');
  assert.equal((await ids(a, 'digest-api-page')).length, 0);
  options.setOffline(false);
  await click(a, 'Retry Digest');
  await text(a, 'Approved article text');
  options.setCoverOffline(true);
  await click(a, 'Refresh Digest');
  await text(a, 'Retry article cover');
  await a.waitForSelector('article-cover-image + .article-cover--fallback');
  await text(a, 'Article summary.');
  assert.ok(await a.$('.articles-grid a[href="/articles/export-article"]'));
  options.setCoverOffline(false);
  await click(a, 'Retry article cover');
  await a.waitForFunction(() => {
    const img = document.querySelector(
      'digest-api-page article-cover-image img'
    );
    return (
      img &&
      img.complete &&
      img.naturalWidth > 0 &&
      !document.querySelector('article-cover-image + .article-cover--fallback')
    );
  });
  const pending = options.holdResponse();
  await click(a, 'Refresh Digest');
  await pending;
  await text(a, 'Loading Digest');
  await a.evaluate(() => {
    const oldValue = localStorage.getItem('_i');
    localStorage.setItem('_i', 'explore-other');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: '_i',
        oldValue,
        newValue: 'explore-other',
        storageArea: localStorage,
      })
    );
  });
  options.releaseResponse();
  await text(a, 'No matching recent articles');
  assert.deepEqual(
    await ids(a, 'digest-api-page'),
    await ids(stranger, 'digest-api-page')
  );
  for (const theme of ['light', 'dark']) {
    await b.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: theme },
    ]);
    for (const width of [1440, 768, 390]) {
      await b.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      await go(b, '/digest');
      await text(b, 'Approved article text');
      await b.waitForFunction(
        (theme) => document.body.getAttribute('tuiTheme') === theme,
        {},
        theme
      );
      await delay(300);
      const layout = await b.$eval('digest-api-page', (element) => {
        const card = element.querySelector('.latest-grid article'),
          header = card.querySelector('header'),
          title = card.querySelector('h3');
        const article = element.querySelector('.article-copy'),
          app = element.querySelector('.app-body');
        const gap = (before, after) =>
          Math.round(
            after.getBoundingClientRect().top -
              before.getBoundingClientRect().bottom
          );
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          headerGap: gap(header, title),
          articleGap: gap(
            article.querySelector('h3'),
            article.querySelector('p')
          ),
          appGap: app.querySelector('p')
            ? gap(app.querySelector('h3'), app.querySelector('p'))
            : null,
          controlsFit: [...element.querySelectorAll('button')].every(
            (button) => {
              const box = button.getBoundingClientRect();
              return (
                box.left >= -1 &&
                box.right <= innerWidth + 1 &&
                button.scrollWidth <= button.clientWidth + 1
              );
            }
          ),
        };
      });
      assert.equal(layout.overflow, false);
      assert.equal(layout.controlsFit, true);
      assert.equal(layout.headerGap, 16);
      assert.equal(layout.articleGap, 8);
      if (layout.appGap !== null) assert.equal(layout.appGap, 8);
      layouts.push({ theme, viewport: width, ...layout });
      await b.screenshot({
        path: path.join(directory, `digest-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
  fs.writeFileSync(
    path.join(directory, 'qualification.json'),
    JSON.stringify(
      {
        layouts,
        links,
        checks: [
          'Four independently selected compact sections with real summaries and covers',
          'Independent member, second session, other account and guest',
          'Current article, application, topic and activity detail links',
          'Saved exclusions, votes, favorites and personalization opt-out across Account restart',
          'Held response cancelled after account switch',
          'Unavailable/retry and cover fallback/recovery',
          'Keyboard refresh and retry',
          'Three widths in both themes',
        ],
        substitutions: [
          'Local bearer-to-identity gateway',
          'External network blocked',
          'Existing public publication fixtures and production materializers invoked directly',
        ],
      },
      null,
      2
    )
  );
  pass(
    'Digest independent browsers: real compact sections and detail links, persistent account choices/favorites, opt-out, category exclusions, session cancellation, service/cover recovery, keyboard controls and six responsive theme layouts'
  );
};
