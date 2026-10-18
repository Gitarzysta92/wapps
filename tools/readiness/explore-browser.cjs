const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const puppeteer = require('puppeteer');

module.exports = async function qualifyExploreBrowser(options) {
  const {
    root,
    output,
    accountOrigin,
    editorialOrigin,
    discussionOrigin,
    bffOrigin,
    headers,
    owner,
    other,
    topics,
    pass,
  } = options;
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  const directory = path.join(output, 'explore-browser');
  fs.mkdirSync(directory, { recursive: true });
  const principals = {
    'explore-owner-a': owner,
    'explore-owner-b': owner,
    'explore-other': other,
  };
  const errors = [],
    layouts = [],
    links = [];
  let offline = false,
    coverOffline = false,
    preferencesOffline = false,
    preferenceHold = false,
    releasePreferences = () => undefined,
    preferencesStarted = () => undefined,
    preferencesHeld = Promise.resolve(),
    selectionsOffline = false,
    selectionsHold = false,
    releaseSelections = () => undefined,
    selectionsStarted = () => undefined,
    selectionsHeld = Promise.resolve(),
    hold = false,
    release = () => undefined,
    started = () => undefined,
    held = Promise.resolve();
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
  };
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const uid =
        principals[
          String(request.headers.authorization).replace(/^Bearer /, '')
        ];
      if (url.pathname.startsWith('/api/')) {
        const account = /^\/api\/(me|profiles)(\/|$)/.test(url.pathname);
        const discussion =
          /^\/api\/(application-discussions|application-reviews|article-comments|discussion-selection)(\/|$)/.test(
            url.pathname
          );
        const explore =
          ['/api/explore', '/api/digest'].includes(url.pathname) ||
          /^\/api\/applications\/[^/]+\/timeline$/.test(url.pathname);
        const unavailableCover =
          coverOffline && url.pathname.startsWith('/api/media/articles/');
        const preferenceRead =
          url.pathname === '/api/me/preferences' && request.method === 'GET';
        const selectionRead = /\/(app|article|suite|discussion)-selection$/.test(url.pathname);
        if (
          (account && !uid) ||
          (explore && offline) ||
          unavailableCover ||
          (preferenceRead && preferencesOffline) ||
          (selectionRead && selectionsOffline)
        ) {
          response.writeHead(account && !uid ? 401 : 503, {
            'content-type': 'application/json',
          });
          response.end('{}');
          return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          assert.ok(size <= 1_000_000);
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        const upstream = await fetch(
          (account
            ? accountOrigin()
            : discussion
            ? discussionOrigin()
            : explore
            ? bffOrigin()
            : editorialOrigin()) +
            url.pathname +
            url.search,
          {
            method: request.method,
            headers: {
              ...(uid ? headers(uid) : {}),
              ...(request.headers['idempotency-key']
                ? { 'idempotency-key': request.headers['idempotency-key'] }
                : {}),
            },
            ...(body.length ? { body } : {}),
            signal: AbortSignal.timeout(20000),
          }
        );
        const bytes = Buffer.from(await upstream.arrayBuffer());
        if (hold && explore && uid === owner) {
          started();
          await held;
        }
        if (preferenceHold && preferenceRead) {
          preferencesStarted();
          await preferencesHeld;
        }
        if (selectionsHold && selectionRead && uid === owner) {
          selectionsStarted();
          await selectionsHeld;
        }
        if (response.destroyed) return;
        response.writeHead(upstream.status, {
          'content-type':
            upstream.headers.get('content-type') ?? 'application/json',
          'cache-control': 'no-store',
        });
        response.end(bytes);
        return;
      }
      const file = path.resolve(bundle, '.' + decodeURIComponent(url.pathname));
      assert.ok(file === bundle || file.startsWith(bundle + path.sep));
      const selected =
        fs.existsSync(file) && fs.statSync(file).isFile()
          ? file
          : path.join(bundle, 'index.html');
      response.writeHead(200, {
        'content-type':
          mime[path.extname(selected)] ?? 'application/octet-stream',
      });
      fs.createReadStream(selected).pipe(response);
    } catch (error) {
      errors.push(error.message);
      if (!response.headersSent) response.writeHead(503);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const accepted = async (response) => {
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return body;
  };
  async function preferences(uid, change) {
    const current = await accepted(
      await fetch(accountOrigin() + '/api/me/preferences', {
        headers: headers(uid),
      })
    );
    change(current.preferences);
    return accepted(
      await fetch(accountOrigin() + '/api/me/preferences', {
        method: 'PUT',
        headers: { ...headers(uid), 'idempotency-key': randomUUID() },
        body: JSON.stringify({
          expectedRevision: current.revision,
          preferences: current.preferences,
        }),
      })
    );
  }
  async function go(page, route = '/') {
    await page.bringToFront();
    await page.goto(origin + route, { waitUntil: 'networkidle0' });
  }
  async function text(page, value, selector = 'explore-feed') {
    await page.bringToFront();
    await page.waitForFunction(
      (selector, value) =>
        document.querySelector(selector)?.textContent.includes(value),
      { timeout: 20000 },
      selector,
      value
    );
  }
  async function click(page, label, selector = 'explore-feed') {
    await page.bringToFront();
    await page.waitForFunction(
      (label, selector) =>
        [...document.querySelectorAll(selector + ' button')].some(
          (b) => b.textContent.trim() === label && !b.disabled
        ),
      {},
      label,
      selector
    );
    await page.evaluate(
      (label, selector) =>
        [...document.querySelectorAll(selector + ' button')]
          .find((b) => b.textContent.trim() === label && !b.disabled)
          .focus(),
      label,
      selector
    );
    await page.keyboard.press('Enter');
  }
  const ids = (page) =>
    page.$$eval('explore-feed article', (nodes) =>
      nodes.map((n) => n.getAttribute('data-id'))
    );
  let browser;
  try {
    await preferences(owner, (p) => {
      p.display.theme = 'auto';
      p.content.feedSortOrder = 'recent';
      p.content.showMatureContent = true;
      p.content.contentFilters.excludedCategories = [];
    });
    await preferences(other, (p) => {
      p.content.showMatureContent = true;
      p.content.contentFilters.excludedCategories = ['category-export'];
    });
    browser = await puppeteer.launch({ headless: true });
    async function session(token) {
      const context = await browser.createBrowserContext(),
        page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (
          message.type() === 'error' &&
          /\bNG\d{4}\b|NullInjectorError/.test(message.text())
        )
          errors.push(message.text());
      });
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (
          [origin, 'data:', 'blob:'].some((prefix) =>
            request.url().startsWith(prefix)
          )
        )
          void request.continue();
        else void request.abort();
      });
      await page.evaluateOnNewDocument((token) => {
        if (token) localStorage.setItem('_i', token);
      }, token);
      await go(page);
      return page;
    }
    const a = await session('explore-owner-a'),
      b = await session('explore-owner-b'),
      stranger = await session('explore-other'),
      guest = await session(null);
    await text(a, 'Explore topic');
    await text(b, 'Explore topic');
    await text(guest, 'hidden on this page by your saved content choices');
    assert.deepEqual(await ids(guest), []);
    await text(stranger, 'hidden on this page by your saved content choices');
    assert.equal((await ids(stranger)).length, 0);
    assert.deepEqual(await ids(a), await ids(b));
    assert.equal((await ids(a)).length, 10);
    const firstPage = await ids(a);
    await click(a, 'Older activity');
    await a.waitForFunction(
      (first) => {
        const ids = [...document.querySelectorAll('explore-feed article')].map(
          (n) => n.getAttribute('data-id')
        );
        return ids.length > 0 && ids.every((id) => !first.includes(id));
      },
      {},
      firstPage
    );
    const olderUrl = a.url(),
      olderIds = await ids(a);
    assert.ok(new URL(olderUrl).searchParams.get('activity'));
    await a.click('explore-feed article[data-kind="discussion"] a');
    await a.waitForSelector('application-discussions');
    await a.goBack({ waitUntil: 'networkidle0' });
    await text(a, 'Recent public');
    await a.waitForFunction(
      (expected) =>
        JSON.stringify(
          [...document.querySelectorAll('explore-feed article')].map((n) =>
            n.getAttribute('data-id')
          )
        ) === JSON.stringify(expected),
      {},
      olderIds
    );
    assert.equal(a.url(), olderUrl);
    await click(a, 'Refresh activity');
    await text(a, 'Explore topic');
    assert.deepEqual(await ids(a), firstPage);
    const kinds = new Set();
    for (let page = 0; page < 15; page++) {
      await text(a, 'Recent public');
      const entries = await a.$$eval('explore-feed article', (nodes) =>
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
          layouts.push(...await require('./rich-activity-browser-checks.cjs')(a, entry.kind, directory));
          if (entry.kind === 'article') {
            coverOffline = true;
            await a.reload({ waitUntil: 'networkidle0' });
            await text(a, 'Retry article cover');
            await text(a, 'Article summary.');
            const article = 'article[data-kind="article"]';
            assert.ok(await a.$(`${article} .card-actions a`));
            coverOffline = false;
            await click(a, 'Retry article cover');
            await a.waitForFunction(() => {
              const img = document.querySelector(
                'explore-feed article[data-kind="article"] article-cover-image img'
              );
              return img && img.complete && img.naturalWidth > 0;
            });
          }
        }
      const older = await a.$$eval('explore-feed button', (nodes) =>
        nodes.some((n) => n.textContent.trim() === 'Older activity')
      );
      if (!older) break;
      const previous = await ids(a);
      await click(a, 'Older activity');
      await a.waitForFunction(
        (previous) =>
          JSON.stringify(
            [...document.querySelectorAll('explore-feed article')].map((n) =>
              n.getAttribute('data-id')
            )
          ) !== JSON.stringify(previous) &&
          !document
            .querySelector('explore-feed')
            ?.textContent.includes('Loading activity'),
        {},
        previous
      );
    }
    assert.deepEqual([...kinds].sort(), [
      'application',
      'article',
      'discussion',
      'release',
      'review',
      'suite',
    ]);
    await a.evaluate(() => window.scrollTo(0, 0));
    await a.waitForFunction(() => {
      const canvas = document.querySelector('.section__feed canvas.ui-wobble-outline');
      const bounds = canvas?.getBoundingClientRect();
      return bounds && bounds.width > 0 && bounds.right <= innerWidth + 1;
    });
    for (const entry of links) {
      await go(b, entry.href);
      assert.equal(
        new URL(b.url()).pathname,
        new URL(entry.href, origin).pathname
      );
      await text(b, entry.title, 'body');
      const body = await b.$eval('body', (element) => element.textContent);
      assert.equal(body.includes('Page not found'), false, entry.kind);
      if (entry.kind === 'review')
        await text(
          b,
          'A real public review in the activity feed.',
          'member-reviews'
        );
      if (entry.kind === 'discussion')
        await text(
          b,
          'A current public discussion for the Explore feed.',
          'application-discussions'
        );
      if (entry.kind === 'article')
        await text(b, 'Retained article body.', 'app-article-catalog .article-body');
      if (entry.kind === 'suite')
        await text(b, 'Reviewed application', 'suite-publication-page .app-list');
      if (entry.kind === 'release')
        await text(b, 'fix: Fixed issue.', '.release-content');
    }
    await accepted(
      await fetch(
        discussionOrigin() +
          `/api/application-discussions/${options.application.id}/${topics[4].id}/vote`,
        {
          method: 'PUT',
          headers: { ...headers(other), 'idempotency-key': randomUUID() },
          body: JSON.stringify({
            expectedRevision: topics[4].revision,
            value: 1,
          }),
        }
      )
    );
    await options.project(topics[4].id);
    await preferences(owner, (p) => {
      p.content.feedSortOrder = 'popular';
    });
    await go(a);
    await text(a, 'Explore topic');
    assert.equal((await ids(a))[0], topics[4].id);
    const favorite = await accepted(
      await fetch(accountOrigin() + '/api/me/favorites', {
        headers: headers(owner),
      })
    );
    await accepted(
      await fetch(accountOrigin() + '/api/me/favorites', {
        method: 'PUT',
        headers: { ...headers(owner), 'idempotency-key': randomUUID() },
        body: JSON.stringify({
          expectedRevision: favorite.revision,
          target: { kind: 'discussions', id: topics[3].id },
          saved: true,
        }),
      })
    );
    await preferences(owner, (p) => {
      p.content.feedSortOrder = 'recommended';
      p.privacy.allowPersonalization = true;
    });
    await options.restartAccount();
    await go(a);
    await text(a, 'Explore topic');
    assert.equal((await ids(a))[0], topics[3].id);
    await go(b);
    await text(b, 'Explore topic');
    assert.equal((await ids(b))[0], topics[3].id);
    await preferences(owner, (p) => {
      p.privacy.allowPersonalization = false;
    });
    await go(a);
    await text(a, 'Personalization is off');
    assert.deepEqual(await ids(a), firstPage);
    offline = true;
    await click(a, 'Refresh activity');
    await text(a, 'Could not load activity');
    assert.equal((await ids(a)).length, 0);
    offline = false;
    await click(a, 'Retry');
    await text(a, 'Explore topic');
    hold = true;
    held = new Promise((resolve) => {
      release = resolve;
    });
    const pending = new Promise((resolve) => {
      started = resolve;
    });
    await click(a, 'Refresh activity');
    await pending;
    await text(a, 'Loading activity');
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
    hold = false;
    release();
    await text(a, 'hidden on this page by your saved content choices');
    assert.equal((await ids(a)).length, 0);
    for (const theme of ['light', 'dark']) {
      await b.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
      ]);
      for (const width of [1440, 768, 390]) {
        await b.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        await go(b);
        await text(b, 'Explore topic');
        await b.waitForFunction(
          (theme) => document.body.getAttribute('tuiTheme') === theme,
          {},
          theme
        );
        await delay(500);
        await b.$eval('explore-feed', (node) =>
          node.scrollIntoView({ block: 'start' })
        );
        const layout = await b.$eval('explore-feed', (element) => {
          const card = element.querySelector('article[data-kind="discussion"]'),
            head = card.querySelector('ui-card-header'),
            title = card.querySelector('h3');
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            width: element.getBoundingClientRect().width,
            gap: Math.round(
              card.querySelector('ui-discussion-thread').getBoundingClientRect().top - head.getBoundingClientRect().bottom
            ),
            metadataGap: Math.round(
              head.querySelector('p').getBoundingClientRect().top -
                title.getBoundingClientRect().bottom
            ),
            controlsFit: [...element.querySelectorAll('button')].every(
              (button) => {
                const b = button.getBoundingClientRect();
                return (
                  b.left >= -1 &&
                  b.right <= innerWidth + 1 &&
                  button.scrollWidth <= button.clientWidth + 1
                );
              }
            ),
          };
        });
        assert.equal(layout.overflow, false);
        assert.equal(layout.controlsFit, true);
        assert.equal(layout.gap, 16);
        assert.equal(layout.metadataGap, 4);
        layouts.push({ theme, viewport: width, ...layout });
        await b.screenshot({
          path: path.join(directory, `explore-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
    for (const workflow of [
      ...(options.digest ? ['./digest-browser.cjs'] : []),
      ...(options.timeline ? ['./timeline-browser.cjs'] : []),
      ...(options.timeline ? ['./feed-content-preferences-browser.cjs'] : []),
      ...(options.favoritesContentPreferences ? ['./favorites-content-preferences-browser.cjs'] : []),
    ])
      await require(workflow)({
        ...options,
        a,
        b,
        stranger,
        guest,
        go,
        text,
        click,
        preferences,
        setSelectionsOffline: (value) => { selectionsOffline = value; },
        holdSelections: () => {
          selectionsHold = true;
          selectionsHeld = new Promise((resolve) => { releaseSelections = resolve; });
          return new Promise((resolve) => { selectionsStarted = resolve; });
        },
        releaseSelections: () => { selectionsHold = false; releaseSelections(); },
        setPreferencesOffline: (value) => {
          preferencesOffline = value;
        },
        holdPreferences: () => {
          preferenceHold = true;
          preferencesHeld = new Promise((resolve) => {
            releasePreferences = resolve;
          });
          return new Promise((resolve) => {
            preferencesStarted = resolve;
          });
        },
        releasePreferences: () => {
          preferenceHold = false;
          releasePreferences();
        },
        setOffline: (value) => {
          offline = value;
        },
        setCoverOffline: (value) => {
          coverOffline = value;
        },
        holdResponse: () => {
          hold = true;
          held = new Promise((resolve) => {
            release = resolve;
          });
          return new Promise((resolve) => {
            started = resolve;
          });
        },
        releaseResponse: () => {
          hold = false;
          release();
        },
      });
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(directory, 'qualification.json'),
      JSON.stringify(
        {
          layouts,
          links,
          checks: [
            'Independent member browsers read legacy public pages; guests hide unclassified content',
            'Saved category exclusions, favorites and personalization opt-out survive restart',
            'Held activity response is cancelled after session switch',
            'Real content links for six kinds',
            'Original rich card sections use live metadata for all six kinds',
            'Protected article cover failure/retry preserves excerpt and navigation',
            'Faded decoration does not overflow on resize and returns when scrolled back',
            'Bounded replacing pages and refresh',
            'Paging, refresh and retry controls respond to keyboard activation',
            'Unavailable/retry states',
            'Three widths in both themes',
          ],
          substitutions: [
            'Local bearer-to-identity gateway',
            'External network blocked',
            'Existing public publication fixtures; production materializer functions run directly',
          ],
        },
        null,
        2
      )
    );
    pass(
      'Explore independent browsers: six rich card kinds and content links, protected cover failure/retry, paging, persistent preferences/favorite order, personalization off, category exclusions, session cancellation and 42 responsive theme layouts'
    );
  } catch (error) {
    const diagnostics = [];
    for (const [index, page] of ((await browser?.pages()) ?? []).entries()) {
      diagnostics.push({
        url: page.url(),
        text: await page
          .$eval('body', (body) => body.textContent)
          .catch(() => ''),
      });
      await page
        .screenshot({
          path: path.join(directory, `failure-${index}.png`),
          fullPage: true,
        })
        .catch(() => undefined);
    }
    fs.writeFileSync(
      path.join(directory, 'failure.json'),
      JSON.stringify({ error: error.stack, errors, diagnostics }, null, 2)
    );
    throw error;
  } finally {
    release();
    releasePreferences();
    releaseSelections();
    await browser?.close();
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
};
