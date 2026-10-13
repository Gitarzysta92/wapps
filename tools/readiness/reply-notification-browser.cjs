const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');
const puppeteer = require('puppeteer');

module.exports = async function qualifyReplyNotificationBrowser(options) {
  const {
    root,
    output,
    accountOrigin,
    discussionOrigin,
    editorialOrigin,
    headers,
    owner,
    other,
    application,
    article,
    topic,
    artTopic,
    preferences,
    restartAccount,
    pass,
  } = options;
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  assert.ok(fs.existsSync(path.join(bundle, 'index.html')));
  const directory = path.join(output, 'reply-browser');
  fs.mkdirSync(directory, { recursive: true });
  const principals = {
    'reply-owner-a': owner,
    'reply-owner-b': owner,
    'reply-other': other,
  };
  const errors = [],
    layouts = [],
    reads = [];
  let offline = false,
    loseRead = false,
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
        const account =
          url.pathname === '/api/me' || url.pathname.startsWith('/api/me/');
        const discussion =
          /^\/api\/(application-discussions|article-comments)\//.test(
            url.pathname
          );
        const catalog = /^\/api\/(catalog|media)\//.test(url.pathname);
        const notification = url.pathname.startsWith('/api/me/notifications');
        if (
          (!uid && account) ||
          (offline && notification) ||
          (!account && !discussion && !catalog)
        ) {
          response.writeHead(
            !uid && account ? 401 : offline && notification ? 503 : 404,
            { 'content-type': 'application/json' }
          );
          response.end('{}');
          return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          assert.ok(size < 1_000_000);
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        const upstream = await fetch(
          (account
            ? accountOrigin()
            : discussion
            ? discussionOrigin()
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
            signal: AbortSignal.timeout(15000),
          }
        );
        const bytes = Buffer.from(await upstream.arrayBuffer());
        const read = notification && request.method === 'PUT';
        if (read)
          reads.push({
            uid,
            status: upstream.status,
            body: JSON.parse(body.toString()),
          });
        const lost = loseRead && read && upstream.status === 200;
        if (lost) loseRead = false;
        if (hold && notification && request.method === 'GET' && uid === owner) {
          started();
          await held;
        }
        if (response.destroyed) return;
        response.writeHead(lost ? 503 : upstream.status, {
          'content-type':
            upstream.headers.get('content-type') ?? 'application/json',
          'cache-control': 'no-store',
        });
        response.end(lost ? '{}' : bytes);
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
  let browser;
  const selector = 'app-notifications-page';
  async function text(page, value, scope = selector) {
    await page.bringToFront();
    await page.waitForFunction(
      (scope, value) =>
        document.querySelector(scope)?.textContent.includes(value),
      { timeout: 20000 },
      scope,
      value
    );
  }
  async function click(page, label) {
    await page.bringToFront();
    await page.waitForFunction(
      (label) =>
        [...document.querySelectorAll('app-notifications-page button')].some(
          (b) => b.textContent.trim() === label && !b.disabled
        ),
      {},
      label
    );
    await page.evaluate(
      (label) =>
        [...document.querySelectorAll('app-notifications-page button')]
          .find((b) => b.textContent.trim() === label && !b.disabled)
          .click(),
      label
    );
  }
  async function go(page, route = '/notifications') {
    await page.bringToFront();
    await page.goto(origin + route, { waitUntil: 'networkidle0' });
  }
  try {
    browser = await puppeteer.launch({ headless: true });
    async function session(token) {
      const context = await browser.createBrowserContext(),
        page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
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
      await page.evaluateOnNewDocument(
        (token) => localStorage.setItem('_i', token),
        token
      );
      await go(page);
      return page;
    }
    const a = await session('reply-owner-a'),
      b = await session('reply-owner-b'),
      stranger = await session('reply-other');
    await text(a, 'A reply in Reviewed application');
    await text(b, 'A reply in Approved article text');
    await text(stranger, 'No reply notifications yet');
    assert.equal(
      await stranger.$$eval(
        'app-notifications-page ui-medium-card',
        (items) => items.length
      ),
      0
    );
    loseRead = true;
    await click(a, 'Mark as read');
    await text(a, 'Notifications could not be loaded');
    assert.equal(
      await a.$$eval(
        'app-notifications-page ui-medium-card',
        (items) => items.length
      ),
      0
    );
    assert.equal(reads.length, 1);
    assert.equal(reads[0].status, 200);
    await click(a, 'Try again');
    await text(a, 'A reply in Reviewed application');
    await restartAccount();
    await go(b);
    await text(b, 'A reply in Reviewed application');
    assert.equal(
      await b.$$eval(
        'app-notifications-page ui-medium-card button',
        (items) =>
          items.filter((b) => b.textContent.trim() === 'Mark as read').length
      ),
      1
    );
    assert.equal(reads.length, 1, 'Uncertain read must not auto-retry');

    for (const theme of ['light', 'dark']) {
      await a.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
      ]);
      for (const width of [1440, 768, 390]) {
        await a.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        await go(a);
        await text(a, 'A reply in Reviewed application');
        await a.waitForFunction(
          (theme) => document.body.getAttribute('tuiTheme') === theme,
          {},
          theme
        );
        await a.evaluate(() => document.fonts.ready);
        await delay(500);
        const layout = await a.evaluate(() => {
          const box = (selector) =>
            document.querySelector(selector).getBoundingClientRect();
          const controls = [
            ...document.querySelectorAll(
              'app-notifications-page button, app-notifications-page a[tuiButton]'
            ),
          ];
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            header: box('app-notifications-page ui-page-header').left,
            content: box('.inbox-content').left,
            cardGap:
              box('.inbox-content ui-medium-card .card-body').top -
              box('.notification-heading').bottom,
            controlsFit: controls.every(
              (b) =>
                b.scrollWidth <= b.clientWidth + 1 &&
                b.getBoundingClientRect().right <= innerWidth + 1
            ),
            theme: document.body.getAttribute('tuiTheme'),
          };
        });
        assert.equal(layout.overflow, false);
        assert.equal(layout.controlsFit, true);
        assert.ok(Math.abs(layout.header - layout.content) < 2);
        assert.equal(layout.cardGap, 16);
        await a.screenshot({
          path: path.join(
            directory,
            `reply-notifications-${theme}-${width}.png`
          ),
          fullPage: true,
        });
        layouts.push({ theme, width, ...layout });
      }
    }
    for (const [href, content, scope] of [
      [
        `/apps/${application.slug}/discussions/${topic.id}`,
        'A real reply from another member.',
        'application-discussions',
      ],
      [
        `/articles/${article.slug}?thread=${artTopic.id}`,
        'A real article reply.',
        'article-comments',
      ],
    ]) {
      await go(a);
      await text(a, 'A reply in Reviewed application');
      await a.click(`app-notifications-page a[href="${href}"]`);
      await text(a, content, scope);
      assert.equal(new URL(a.url()).pathname + new URL(a.url()).search, href);
    }
    for (let count = 0; count < 9; count++) {
      const receipt = await options.reply();
      await options.settled(receipt.id);
    }
    await go(a);
    await text(a, 'Older notifications');
    assert.equal(
      await a.$$eval(
        'app-notifications-page ui-medium-card',
        (items) => items.length
      ),
      10
    );
    await click(a, 'Older notifications');
    await text(a, 'A reply in Approved article text');
    assert.equal(
      await a.$$eval(
        'app-notifications-page ui-medium-card',
        (items) => items.length
      ),
      2
    );
    await click(a, 'Refresh latest');
    await text(a, 'Older notifications');
    assert.equal(
      await a.$$eval(
        'app-notifications-page ui-medium-card',
        (items) => items.length
      ),
      10
    );
    await preferences(false);
    await go(a);
    await text(a, 'Reply notifications are off');
    await preferences(true);
    await click(a, 'Refresh latest');
    await text(a, 'A reply in Reviewed application');
    offline = true;
    await click(a, 'Refresh latest');
    await text(a, 'Notifications could not be loaded');
    assert.equal(
      await a.$$eval(
        'app-notifications-page ui-medium-card',
        (items) => items.length
      ),
      0
    );
    offline = false;
    await click(a, 'Try again');
    await text(a, 'A reply in Reviewed application');
    hold = true;
    held = new Promise((resolve) => {
      release = resolve;
    });
    const pending = new Promise((resolve) => {
      started = resolve;
    });
    await click(a, 'Refresh latest');
    await pending;
    await text(a, 'Loading notifications');
    await a.evaluate(() => {
      const oldValue = localStorage.getItem('_i');
      localStorage.setItem('_i', 'reply-other');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '_i',
          oldValue,
          newValue: 'reply-other',
          storageArea: localStorage,
        })
      );
    });
    hold = false;
    release();
    await text(a, 'No reply notifications yet');
    assert.equal(
      await a.$$eval(
        'app-notifications-page ui-medium-card',
        (items) => items.length
      ),
      0
    );
    await go(b, '/');
    await b.waitForSelector('home-page');
    await go(b, '/auth/callback');
    await text(b, 'Invalid OAuth callback', 'oauth-callback');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(directory, 'qualification.json'),
      JSON.stringify(
        {
          layouts,
          reads,
          checks: [
            'Independent account/session inboxes',
            'Lost read response and persisted receipt after restart',
            'Application and article links open real materialized conversations',
            'Disabled preferences, loading, unavailable and explicit retry',
            'Session change cancels held private response',
            'Bounded older-page navigation replaces prior items; refresh returns to latest',
            'Lazy Home and existing OAuth callback routes',
            'Three widths in both themes',
          ],
          substitutions: [
            'Local bearer-to-canonical-identity gateway instead of deployed ingress',
            'External network blocked',
            'Production materialization functions invoked directly for conversation projections',
          ],
        },
        null,
        2
      )
    );
    pass(
      'Independent compiled-portal browsers qualify inbox isolation, read persistence, lost response recovery, real conversation links, preference/failure/session states and six responsive theme layouts'
    );
  } finally {
    release();
    await browser?.close();
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
};
