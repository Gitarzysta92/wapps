const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

module.exports = async function qualifyTimelineBrowser(options) {
  const { a, b, stranger, guest, owner, other, topics, preferences, go, pass } =
    options;
  const selector = 'application-timeline-api-page';
  const route = '/apps/export-application/timeline';
  const directory = path.join(options.output, 'timeline-browser');
  fs.mkdirSync(directory, { recursive: true });
  const text = (page, value, target = selector) =>
    options.text(page, value, target);
  const click = (page, label) => options.click(page, label, selector);
  const ids = (page) =>
    page.$$eval('application-timeline-api-page article', (nodes) =>
      nodes.map((n) => n.getAttribute('data-id'))
    );
  const layouts = [],
    links = [];
  const loaded = (page) =>
    page.waitForFunction(
      () =>
        document
          .querySelector('application-timeline-api-page section')
          ?.getAttribute('aria-busy') === 'false' &&
        document.querySelector('application-timeline-api-page article')
    );
  const older = async (page) => {
    const previous = page.url();
    await click(page, 'Older activity');
    await page.waitForFunction(
      (previous) => location.href !== previous,
      {},
      previous
    );
    await loaded(page);
  };
  await preferences(owner, (p) => {
    p.display.theme = 'auto';
    p.content.feedSortOrder = 'recent';
    p.content.showMatureContent = true;
    p.content.contentFilters.excludedCategories = [];
    p.privacy.allowPersonalization = true;
  });
  await preferences(other, (p) => {
    p.content.showMatureContent = true;
    p.content.contentFilters.excludedCategories = ['category-export'];
  });
  for (const page of [a, b, stranger, guest]) await go(page, route);
  for (const page of [a, b]) {
    await text(page, 'Explore topic');
    assert.equal((await ids(page)).length, 10);
  }
  await text(guest, 'Application hidden');
  assert.deepEqual(await ids(guest), []);
  await text(stranger, 'hidden on this page by your saved content choices');
  assert.equal((await ids(stranger)).length, 0);
  assert.deepEqual(await ids(a), await ids(b));
  const first = await ids(a);
  await older(a);
  const second = await ids(a),
    secondUrl = a.url();
  assert.equal(
    first.some((id) => second.includes(id)),
    false
  );
  assert.ok(new URL(secondUrl).searchParams.get('activity'));
  await a.goBack({ waitUntil: 'networkidle0' });
  await loaded(a);
  assert.deepEqual(await ids(a), first);
  await go(b, new URL(secondUrl).pathname + new URL(secondUrl).search);
  assert.deepEqual(await ids(b), second);
  await click(b, 'Refresh timeline');
  await loaded(b);
  assert.equal(new URL(b.url()).searchParams.has('activity'), false);
  assert.deepEqual(await ids(b), first);

  const kinds = new Set();
  for (let page = 0; page < 15; page++) {
    await loaded(a);
    const entries = await a.$$eval(
      'application-timeline-api-page article',
      (nodes) =>
        nodes.map((n) => ({
          kind: n.getAttribute('data-kind'),
          href: n.querySelector('.card-actions a').getAttribute('href'),
          title: n.getAttribute('data-title'),
        }))
    );
    for (const entry of entries)
      if (!kinds.has(entry.kind)) {
        kinds.add(entry.kind);
        links.push(entry);
      }
    const more = await a.$$eval(
      'application-timeline-api-page button',
      (nodes) => nodes.some((n) => n.textContent.trim() === 'Older activity')
    );
    if (!more) break;
    await older(a);
  }
  assert.deepEqual([...kinds].sort(), [
    'application',
    'discussion',
    'release',
    'review',
    'suite',
  ]);
  for (const entry of links) {
    assert.ok(entry.href.startsWith('/'));
    await go(b, entry.href);
    await text(b, entry.title, 'body');
    assert.equal(
      (await b.$eval('body', (node) => node.textContent)).includes(
        'Page not found'
      ),
      false
    );
    if (entry.kind === 'application')
      await text(b, 'Reviewed application', 'app-application-overview-page');
    if (entry.kind === 'discussion')
      await text(
        b,
        'A current public discussion for the Explore feed.',
        'application-discussions'
      );
    if (entry.kind === 'review')
      await text(
        b,
        'A real public review in the activity feed.',
        'member-reviews'
      );
    if (entry.kind === 'suite')
      await text(b, 'Reviewed application', 'suite-publication-page .app-list');
    if (entry.kind === 'release')
      await text(b, 'fix: Fixed issue.', '.release-content');
  }
  // Saved exclusions apply to suite activity through the selected application context too.
  await click(stranger, 'Older activity');
  await text(stranger, 'End of the available activity.');
  assert.equal((await ids(stranger)).length, 0);
  await preferences(owner, (p) => {
    p.content.feedSortOrder = 'popular';
  });
  await go(a, route);
  await loaded(a);
  assert.equal((await ids(a))[0], topics[4].id);
  await preferences(owner, (p) => {
    p.content.feedSortOrder = 'recommended';
  });
  await options.restartAccount();
  for (const page of [a, b]) {
    await go(page, route);
    await loaded(page);
    assert.equal((await ids(page))[0], topics[3].id);
  }
  await preferences(owner, (p) => {
    p.privacy.allowPersonalization = false;
  });
  await go(a, route);
  await loaded(a);
  await text(a, 'Personalization is off');
  assert.deepEqual(await ids(a), first);
  options.setOffline(true);
  await click(a, 'Refresh timeline');
  await text(a, 'Timeline unavailable');
  assert.deepEqual(await ids(a), []);
  options.setOffline(false);
  await click(a, 'Retry timeline');
  await loaded(a);
  const pending = options.holdResponse();
  await click(a, 'Refresh timeline');
  await pending;
  await text(a, 'Loading application activity');
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
  await text(a, 'hidden on this page by your saved content choices');
  assert.deepEqual(await ids(a), []);
  await go(a, route);
  await loaded(a);
  const changingRoute = options.holdResponse();
  await click(a, 'Refresh timeline');
  await changingRoute;
  await a.click('application-timeline-api-page ui-breadcrumbs a[href="/"]');
  await a.waitForFunction(
    () => !document.querySelector('application-timeline-api-page')
  );
  options.releaseResponse();
  await text(a, 'Recent public', 'explore-feed');
  await go(a, '/apps/foreign-canonical/timeline');
  await loaded(a);
  assert.equal((await ids(a)).length, 1);
  await text(a, 'Foreign canonical content excluded');
  await go(a, '/apps/missing-application/timeline');
  await text(a, 'Application not found');
  assert.deepEqual(await ids(a), []);
  await preferences(owner, (p) => {
    p.content.feedSortOrder = 'recent';
    p.privacy.allowPersonalization = true;
  });
  for (const theme of ['light', 'dark']) {
    await b.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: theme },
    ]);
    for (const width of [1440, 768, 390]) {
      await b.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      await go(b, route);
      await loaded(b);
      await b.waitForFunction(
        (theme) => document.body.getAttribute('tuiTheme') === theme,
        {},
        theme
      );
      await delay(300);
      const layout = await b.$eval(
        'application-timeline-api-page',
        (element) => {
          const card = element.querySelector('article[data-kind="discussion"]');
          const gap = (before, after) =>
            Math.round(
              after.getBoundingClientRect().top -
                before.getBoundingClientRect().bottom
            );
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            headerGap: gap(
              card.querySelector('ui-card-header'),
              card.querySelector('ui-discussion-thread')
            ),
            metadataGap: gap(
              card.querySelector('h3'),
              card.querySelector('ui-card-header p')
            ),
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
        }
      );
      assert.equal(layout.overflow, false);
      assert.equal(layout.controlsFit, true);
      assert.equal(layout.headerGap, 16);
      assert.equal(layout.metadataGap, 4);
      layouts.push({ theme, viewport: width, ...layout });
      await b.screenshot({
        path: path.join(directory, `timeline-${theme}-${width}.png`),
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
          'Independent member, second session, other account and guest',
          'Five real content detail links',
          'URL paging, browser Back and refresh',
          'Persistent exclusions, favorite/vote ordering, personalization opt-out and Account restart',
          'Held response cancellation on account and route change',
          'Missing application and outage/retry',
          'Keyboard controls and three widths in both themes',
        ],
        substitutions: [
          'Local bearer-to-identity gateway',
          'External network blocked',
          'Existing publication fixtures and production materializers invoked directly',
        ],
      },
      null,
      2
    )
  );
  pass(
    'Application timeline independent browsers: five real content links, URL paging/Back, persistent account choices/favorites, source recovery, missing/foreign applications, account/route cancellation, keyboard controls and six responsive theme layouts'
  );
};
