const assert = require('node:assert/strict');

module.exports = async function homePreviewBrowserChecks({
  session,
  go,
  text,
  fill,
  capture,
  setOffline,
  holdNextRead,
  expected,
}) {
  const page = await session('draft-bob');
  const guest = await session('');
  const detail = await session('draft-alice');
  const requests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/catalog/discover') requests.push(url);
  });
  const count = (target = page) =>
    target.$$eval('.result-entry', (entries) => entries.length);
  const waitCount = (number, target = page) =>
    target.waitForFunction(
      (number) => document.querySelectorAll('.result-entry').length === number,
      {},
      number
    );
  async function phrase(value, target = page) {
    await target.bringToFront();
    await target.focus('multi-search input');
    await fill('multi-search input', value, target);
  }
  async function open(value, target = page) {
    await target.bringToFront();
    await go('/?search=' + encodeURIComponent(value), target);
    await target.focus('multi-search input');
  }
  async function switchAccount(token, target = page) {
    await target.evaluate((token) => {
      if (token) localStorage.setItem('_i', token);
      else localStorage.removeItem('_i');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '_i',
          newValue: token || null,
          storageArea: localStorage,
        })
      );
    }, token);
  }
  async function keyboard(selector, target = page) {
    await target.bringToFront();
    await target.focus(selector);
    await target.keyboard.press('Enter');
  }
  async function navigate(selector, route) {
    await keyboard(selector);
    await page.waitForFunction(
      (route) => location.pathname === route,
      {},
      route
    );
  }
  async function started(hold) {
    let timer;
    try {
      await Promise.race([
        hold.started,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Expected held read')),
            12000
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  await open('team');
  await text('Team suite 00', page);
  assert.equal(await count(), 9);
  assert.equal(
    await page.$eval('multi-search input', (input) =>
      input.getAttribute('aria-label')
    ),
    'Search applications articles suites'
  );
  assert.equal(
    requests.length,
    1,
    'One grouped preview request for the phrase'
  );
  const query = requests[0].searchParams;
  assert.equal(query.get('pageSize'), '3');
  for (const kind of ['application', 'article', 'suite'])
    assert.equal(query.get(kind + 'Page'), '1');
  const groups = await page.$$eval('.preview-list > li', (groups) =>
    groups.map((group) => ({
      total: Number(
        group.querySelector('.group-total').textContent.replace(/[()]/g, '')
      ),
      names: [...group.querySelectorAll('.entry-name')].map((entry) =>
        entry.textContent.trim()
      ),
      links: [...group.querySelectorAll('.result-entry')].map((entry) =>
        entry.getAttribute('href')
      ),
    }))
  );
  assert.deepEqual(
    groups.map((group) => group.total),
    expected.groups.map((group) => group.total)
  );
  assert.deepEqual(
    groups.map((group) => group.names),
    expected.groups.map((group) => group.items.map((item) => item.title))
  );
  assert.match(
    await page.$eval('.full-search-redirect', (link) => link.textContent),
    new RegExp(
      String(expected.groups.reduce((sum, group) => sum + group.total, 0))
    )
  );
  assert(
    groups[2].links.every((link) => /^\/suites\/[0-9a-f-]{36}$/.test(link)),
    'Suites use canonical UUID destinations'
  );
  await capture('home-preview-groups', page);
  await page.focus(
    '.preview-list > li:last-child .result-entries li:last-child a'
  );
  await capture('home-preview-last-suite', page, async (target) => {
    const visible = await target.$eval(
      '.preview-list > li:last-child .result-entries li:last-child a',
      (link) => {
        link.scrollIntoView({ block: 'nearest' });
        const entry = link.getBoundingClientRect();
        const viewport = link
          .closest('.multisearch-result')
          .getBoundingClientRect();
        return entry.top >= viewport.top && entry.bottom <= viewport.bottom + 1;
      }
    );
    assert(
      visible,
      'Keyboard users can reach the last suite inside the scrollable preview'
    );
    return { lastSuiteVisible: visible };
  });
  await open('team', guest);
  await text('Team suite 00', guest);
  assert.equal(
    await count(guest),
    9,
    'Independent guest reads the approved General content'
  );

  for (let index = 0; index < groups.length; index++) {
    await go(groups[index].links[0], detail);
    await text(groups[index].names[0], detail);
  }
  await navigate('.result-entry', groups[0].links[0] + '/overview');
  await text('Team application 00', page);
  await page.goBack({ waitUntil: 'networkidle0' });
  await page.focus('multi-search input');
  await text('Team suite 00', page);
  await navigate('.preview-list > li:nth-child(2) .group-header', '/discover');
  await text('Team article 00', page);
  assert.equal(new URL(page.url()).searchParams.get('type'), 'articles');
  assert.equal(new URL(page.url()).searchParams.get('search'), 'team');
  await page.goBack({ waitUntil: 'networkidle0' });
  await page.focus('multi-search input');
  await text('Team suite 00', page);
  await navigate('.full-search-redirect', '/discover');
  await text('Team suite 00', page);
  assert.equal(new URL(page.url()).pathname, '/discover');
  assert.equal(new URL(page.url()).searchParams.get('type'), null);
  console.log(
    'PASS: Home grouped source totals and keyboard detail/group/all-results navigation'
  );

  await open('Classification');
  await waitCount(9);
  await switchAccount('draft-alice');
  await waitCount(3);
  assert.equal(
    await page.$$eval(
      '.preview-list > li',
      (groups) =>
        groups.filter((group) =>
          group.textContent.includes('2 hidden in this preview')
        ).length
    ),
    3
  );
  await switchAccount('draft-bob');
  await waitCount(9);
  await switchAccount('');
  await waitCount(3);
  await switchAccount('draft-bob');
  await waitCount(9);

  const preferences = holdNextRead('/api/me/preferences');
  try {
    await switchAccount('draft-alice');
    await started(preferences);
    await text('Loading content preferences...', page);
    assert.equal(await count(), 0);
    assert.equal(await page.$('.group-header'), null);
    await capture('home-preview-preferences-loading', page);
  } finally {
    preferences.release();
  }
  await waitCount(3);

  const delayed = holdNextRead('/api/catalog/discover');
  let cancelled = false;
  const onFailed = (request) => {
    if (new URL(request.url()).pathname === '/api/catalog/discover')
      cancelled = true;
  };
  page.on('requestfailed', onFailed);
  try {
    await switchAccount('draft-bob');
    await started(delayed);
    await text('Searching...', page);
    assert.equal(await count(), 0);
    await switchAccount('draft-alice');
    await waitCount(3);
  } finally {
    delayed.release();
  }
  await page.waitForNetworkIdle();
  page.off('requestfailed', onFailed);
  assert(cancelled, 'The obsolete account preview HTTP request is cancelled');
  assert.equal(
    await count(),
    3,
    'A delayed response cannot restore the old account choices'
  );
  console.log(
    'PASS: Home same-phrase account changes, preference loading and cancelled stale requests'
  );

  await phrase('mature');
  await text('1 hidden in this preview', page);
  assert.equal(await count(), 0);
  assert.equal(
    await page.$$eval('.group-header', (groups) => groups.length),
    3
  );
  assert.equal(
    await page.$('.no-results'),
    null,
    'Filtered groups are not empty search results'
  );
  await capture('home-preview-hidden', page);
  await switchAccount('draft-bob');
  await waitCount(3);

  setOffline((route) => route === '/api/me/preferences');
  await switchAccount('draft-alice');
  await text('Your content preferences could not be loaded.', page);
  assert.equal(await count(), 0);
  await capture('home-preview-preferences-error', page);
  setOffline(false);
  const beforeRetry = requests.length;
  await keyboard('home-search-results button', page);
  await text('1 hidden in this preview', page);
  assert.equal(
    requests.length,
    beforeRetry + 1,
    'Preference retry triggers exactly one refreshed preview'
  );

  setOffline((route) => route === '/api/catalog/discover');
  await phrase('team');
  await text('Discover is temporarily unavailable.', page);
  assert.equal(await page.$('.no-results'), null);
  assert.equal(await count(), 0);
  await capture('home-preview-search-error', page);
  setOffline(false);
  await keyboard('home-search-results button', page);
  await text('Team suite 00', page);
  assert.equal(await count(), 9);

  const beforeInvalid = requests.length;
  await phrase('x'.repeat(101));
  await text('Use at most 100 characters', page);
  assert.equal(requests.length, beforeInvalid);
  await phrase('no-such-public-preview');
  await text('No results', page);
  assert.equal(await count(), 0);
  await capture('home-preview-empty', page);
  const beforeBlank = requests.length;
  await phrase('');
  await page.waitForFunction(
    () => !document.querySelector('home-search-results')
  );
  assert.equal(requests.length, beforeBlank);
  await phrase('team');
  await text('Team suite 00', page);
  await page.keyboard.press('Escape');
  assert.equal(await page.$('.dropdown'), null);
  await page.focus('multi-search input');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.pathname === '/discover');
  await text('Team suite 00', page);
  assert.equal(new URL(page.url()).pathname, '/discover');
  assert.equal(new URL(page.url()).searchParams.get('search'), 'team');
  await open('team');
  await navigate('button[aria-label="Submit search"]', '/discover');
  await text('Team article 00', page);
  assert.equal(new URL(page.url()).pathname, '/discover');

  return [
    'Home previews use one bounded grouped real Discover request, preserve source totals and canonical application/article/suite links',
    'Independent guests/members, account changes, preference loading/failure/retry and cancelled late reads enforce current approved content choices',
    'All-hidden previews retain counts and navigation; genuine empty, invalid, blank and unavailable results stay distinct',
    'Keyboard result/group/all-results links, Enter/button submission, Escape and Back preserve the intended search',
    'Home preview result/loading/hidden/error/empty states pass six responsive theme layouts each',
  ];
};
