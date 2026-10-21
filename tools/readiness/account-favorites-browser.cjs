/* Compiled portal and real account/catalog responses; only trusted ingress claims are substituted. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

async function accountFavoritesBrowser({
  root,
  accountOrigin,
  catalogOrigin,
  headers,
  identities,
  favorites,
  createTarget,
  renameTarget,
  deleteTarget,
  publishTarget,
  restartAccount,
  output,
  suiteWorkflow,
}) {
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  assert.ok(
    fs.existsSync(path.join(bundle, 'index.html')),
    'Build the API portal first'
  );
  fs.mkdirSync(output, { recursive: true });
  const principals = {
    'favorites-alice': 'FavoritesBrowserAlice',
    'favorites-bob': 'FavoritesBrowserBob',
  };
  for (const uid of Object.values(principals))
    await identities.ensure({
      uid,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
  const alice = principals['favorites-alice'];
  const first = await createTarget('favorite-browser-first');
  await publishTarget(first.id);
  let offline = false;
  let catalogOffline = false;
  let loseReceipt = false;
  const commands = [];
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.json': 'application/json',
  };
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const account = [
        '/api/me',
        '/api/me/profile',
        '/api/me/preferences',
        '/api/me/favorites',
      ].includes(url.pathname);
      const catalog = url.pathname.startsWith('/api/catalog/');
      if (account || catalog) {
        const uid =
          principals[
            String(request.headers.authorization).replace(/^Bearer /, '')
          ];
        if ((account && (!uid || offline)) || (catalog && catalogOffline)) {
          response.writeHead(account && !uid ? 401 : 503, {
            'content-type': 'application/json',
          });
          response.end('{}');
          return;
        }
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 32768) throw new Error('Oversized fixture request');
        }
        const upstream = await fetch(
          `${account ? accountOrigin() : catalogOrigin}${url.pathname}${
            url.search
          }`,
          {
            method: request.method,
            headers: account
              ? {
                  ...headers(uid),
                  'idempotency-key': request.headers['idempotency-key'] ?? '',
                }
              : { accept: 'application/json' },
            ...(body ? { body } : {}),
            signal: AbortSignal.timeout(6000),
          }
        );
        const payload = Buffer.from(await upstream.arrayBuffer());
        const write =
          url.pathname === '/api/me/favorites' && request.method === 'PUT';
        if (write)
          commands.push({
            uid,
            key: request.headers['idempotency-key'],
            body: JSON.parse(body),
            status: upstream.status,
          });
        const lose = write && upstream.ok && loseReceipt;
        if (lose) loseReceipt = false;
        response.writeHead(lose ? 503 : upstream.status, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        });
        response.end(lose ? '{}' : payload);
        return;
      }
      if (
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/auth/')
      ) {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end('{}');
        return;
      }
      let file = path.resolve(bundle, '.' + decodeURIComponent(url.pathname));
      if (
        !file.startsWith(bundle + path.sep) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile()
      )
        file = path.join(bundle, 'index.html');
      response.writeHead(200, {
        'content-type': mime[path.extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end('{}');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const errors = [];
  const evidence = [];
  const failures = [];
  try {
    browser = await puppeteer.launch({ headless: true });
    async function session(token) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (
          request.url().startsWith(origin + '/') ||
          request.url().startsWith('data:')
        )
          void request.continue();
        else void request.abort();
      });
      await page.evaluateOnNewDocument((token) => {
        localStorage.setItem('_i', token);
        localStorage.setItem(
          'wapps.favorites.v1',
          JSON.stringify({ applications: ['quick-task'] })
        );
      }, token);
      return page;
    }
    const page = await session('favorites-alice');
    const second = await session('favorites-alice');
    const bob = await session('favorites-bob');
    const text = (value, target = page) =>
      target.waitForFunction(
        (value) =>
          document
            .querySelector(
              'favorites-page, app-application-overview-page, suite-publication-page'
            )
            ?.textContent.includes(value),
        { timeout: 12000 },
        value
      );
    const go = (route, target = page) =>
      target.goto(origin + route, { waitUntil: 'networkidle0' });
    async function click(label, target = page, selector = 'button') {
      await target.waitForFunction(
        (label, selector) =>
          [...document.querySelectorAll(selector)].some(
            (button) => button.textContent.trim() === label && !button.disabled
          ),
        { timeout: 10000 },
        label,
        selector
      );
      await target.evaluate(
        (label, selector) =>
          [...document.querySelectorAll(selector)]
            .find(
              (button) =>
                button.textContent.trim() === label && !button.disabled
            )
            .click(),
        label,
        selector
      );
    }
    const reload = () =>
      click('Reload favorites', page, 'ui-page-header button');
    async function capture(state, theme, width) {
      await page.mouse.move(0, 0);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(requestAnimationFrame);
        await Promise.allSettled(
          document
            .getAnimations()
            .filter((animation) => {
              const timing = animation.effect?.getComputedTiming();
              return timing && Number.isFinite(timing.endTime);
            })
            .map((animation) => animation.finished)
        );
      });
      const layout = await page.evaluate(() => {
        const header = document
          .querySelector(
            'favorites-page ui-page-header, suite-publication-page ui-page-header'
          )
          .getBoundingClientRect();
        const content = document
          .querySelector('.favorites-page, .suite-workspace')
          .getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          theme: document.body.getAttribute('tuiTheme'),
          headerLeft: header.left,
          contentLeft: content.left,
          gap: content.top - header.bottom,
          clippedTargets: [
            ...document.querySelectorAll('.favorites-page__target'),
          ].filter((node) => node.scrollWidth > node.clientWidth + 1).length,
        };
      });
      assert.equal(
        layout.overflow,
        false,
        `${state} ${theme} ${width}: horizontal overflow`
      );
      assert.equal(layout.theme, theme);
      assert.ok(
        Math.abs(layout.headerLeft - layout.contentLeft) <= 1,
        'Header/content column alignment'
      );
      assert.ok(
        Math.abs(layout.gap - 24) <= 2,
        `Expected 24px header gap, got ${layout.gap}`
      );
      assert.equal(layout.clippedTargets, 0);
      await page.screenshot({
        path: path.join(output, `${state}-${theme}-${width}.png`),
        fullPage: true,
      });
      evidence.push({ state, theme, width, ...layout });
    }
    await go('/me/favorite');
    await text('No favorites yet');
    await go('/apps/favorite-browser-first/overview');
    await page.waitForSelector('favorite-toggle-button button:not([disabled])');
    const before = await favorites.read(alice);
    loseReceipt = true;
    await click('Add to Favorites', page, 'favorite-toggle-button button');
    await text('Could not confirm the change');
    assert.equal((await favorites.read(alice)).revision, before.revision + 1);
    await click('Add to Favorites', page, 'favorite-toggle-button button');
    await page.waitForSelector(
      'favorite-toggle-button button[aria-pressed="true"]'
    );
    assert.equal(commands[0].key, commands[1].key);
    assert.deepEqual(commands[0].body, commands[1].body);
    assert.equal(
      (await favorites.read(alice)).revision,
      before.revision + 1,
      'Lost response replay must not advance twice'
    );
    await go('/me/favorite', second);
    await text('favorite-browser-first', second);
    await go('/me/favorite', bob);
    await text('No favorites yet', bob);
    await restartAccount();
    await go('/me/favorite');
    await text('favorite-browser-first');
    await renameTarget(first.id, 'favorite-browser-renamed');
    await reload();
    await text('Saved item details could not be loaded');
    await publishTarget(first.id);
    await reload();
    await page.waitForSelector(
      '.favorites-page a[href="/apps/favorite-browser-renamed"]'
    );
    const saved = await favorites.read(alice);
    await identities.updateProfile(
      alice,
      {
        expectedRevision: saved.revision,
        name: 'Concurrent profile edit',
        bio: null,
        location: null,
        socialLinks: {},
      },
      'favorites-browser-profile'
    );
    await click(
      'Remove from Favorites',
      page,
      '.favorites-page favorite-toggle-button button'
    );
    await text('Your account changed');
    await reload();
    await text('favorite-browser-first');
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
        await capture('saved', theme, width);
        catalogOffline = true;
        await reload();
        await text('Saved item details could not be loaded');
        await capture('metadata-error', theme, width);
        catalogOffline = false;
        await reload();
        await text('favorite-browser-first');
        offline = true;
        await reload();
        await text('Favorites could not be loaded');
        await capture('account-error', theme, width);
        offline = false;
        await reload();
        await text('favorite-browser-first');
      }
    await deleteTarget(first.id, 2);
    await reload();
    await text('Unavailable application');
    assert.equal(
      await page.$('.favorites-page a[href="/apps/favorite-browser-renamed"]'),
      null
    );
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
        await capture('unavailable-target', theme, width);
      }
    await click(
      'Remove from Favorites',
      page,
      '.favorites-page favorite-toggle-button button'
    );
    await text('No favorites yet');
    assert.deepEqual((await favorites.read(alice)).favorites, []);
    const last = await createTarget('favorite-browser-offline');
    await publishTarget(last.id);
    await go('/apps/favorite-browser-offline/overview');
    await click('Add to Favorites', page, 'favorite-toggle-button button');
    await page.waitForSelector(
      'favorite-toggle-button button[aria-pressed="true"]'
    );
    catalogOffline = true;
    await go('/me/favorite');
    await text('Saved item details could not be loaded');
    await click(
      'Remove from Favorites',
      page,
      '.favorites-page favorite-toggle-button button'
    );
    await text('No favorites yet');
    catalogOffline = false;
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
        await capture('empty', theme, width);
      }
    await go('/my/favourite/apps');
    await text('Favorite applications');
    await go('/my/favourites/suites');
    await text('No favorites yet');
    await go('/me/favorite');
    await page.evaluate(() => {
      const oldValue = localStorage.getItem('_i');
      localStorage.setItem('_i', 'favorites-bob');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '_i',
          oldValue,
          newValue: 'favorites-bob',
          storageArea: localStorage,
        })
      );
    });
    await text('No favorites yet');
    assert.deepEqual(
      (await favorites.read(principals['favorites-bob'])).favorites,
      []
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('wapps.favorites.v1')).applications[0]
      ),
      'quick-task',
      'Demo data must remain isolated'
    );
    if (suiteWorkflow)
      await suiteWorkflow({
        page,
        second,
        bob,
        alice,
        go,
        text,
        click,
        capture,
        commands,
        controls: {
          loseReceipt: () => {
            loseReceipt = true;
          },
          catalogOffline: (value) => {
            catalogOffline = value;
          },
          accountOffline: (value) => {
            offline = value;
          },
        },
      });
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, 'evidence.json'),
      JSON.stringify(
        {
          evidence,
          commands,
          errors,
          limitations: [
            'Fixture trusted ingress claims',
            'Controlled catalog publication and command policy',
            'Account broker and Firebase unavailable',
            'No production session, database restart, restore or deployment qualification',
          ],
        },
        null,
        2
      )
    );
    console.log(
      `Favorites browser: ${evidence.length} layout states, canonical add/removal, lost receipt retry, independent sessions, account restart, revision conflict, rename/delete/lag and outage removal pass.`
    );
  } catch (error) {
    console.error(error);
    if (browser) {
      for (const [index, page] of (await browser.pages()).entries()) {
        fs.writeFileSync(
          path.join(output, `failure-${index}.html`),
          await page.content()
        );
        await page.screenshot({
          path: path.join(output, `failure-${index}.png`),
          fullPage: true,
        });
      }
    }
    failures.push(error);
  } finally {
    for (const action of [
      async () => browser?.close(),
      () =>
        new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        ),
    ]) {
      try {
        await action();
      } catch (error) {
        failures.push(error);
      }
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length)
    throw new AggregateError(
      failures,
      'Favorites browser qualification/cleanup failed'
    );
}
module.exports = { accountFavoritesBrowser };
