/* Compiled portal and real suite/catalog APIs. Shell profile and trusted ingress identities are fixtures. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const {
  defaultAccountPreferences,
} = require('../../libs/domains/customer/preferences/src');

async function suiteWorkspaceBrowser({
  root,
  origin: editorialOrigin,
  headers,
  restart,
  source,
  createTarget,
  projectSuite,
  output,
}) {
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  await createTarget('Browser Suite Alpha');
  const beta = await createTarget('Browser Suite Beta');
  const principals = {
    'suite-alice': 'SuiteBrowserAlice',
    'suite-bob': 'SuiteBrowserBob',
    'suite-reviewer': 'SuiteBrowserReviewer',
  };
  let loseReceipt = false;
  let offline = false;
  let metadataOffline = false;
  const commands = [];
  const errors = [];
  const layouts = [];
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
      const uid =
        principals[
          String(request.headers.authorization).replace(/^Bearer /, '')
        ];
      const send = (status, value) => {
        response.writeHead(status, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        });
        response.end(JSON.stringify(value));
      };
      if (
        url.pathname.startsWith('/api/me/suites') ||
        url.pathname.startsWith('/api/editorial/suite-reviews') ||
        url.pathname.startsWith('/api/catalog/')
      ) {
        const suite =
          url.pathname.startsWith('/api/me/suites') ||
          url.pathname.startsWith('/api/editorial/suite-reviews');
        if (
          (suite && !uid) ||
          (suite && offline) ||
          (!suite && metadataOffline)
        )
          return send(suite && !uid ? 401 : 503, {});
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 32768) throw new Error('Oversized request');
        }
        const upstream = await fetch(
          editorialOrigin() + url.pathname + url.search,
          {
            method: request.method,
            headers: {
              ...headers(
                uid,
                'default',
                uid === principals['suite-reviewer']
                  ? ['editorial:reviewer']
                  : []
              ),
              'idempotency-key': request.headers['idempotency-key'] ?? '',
            },
            ...(body ? { body } : {}),
            signal: AbortSignal.timeout(10000),
          }
        );
        const data = await upstream.json();
        if (suite && request.method !== 'GET') {
          commands.push({
            method: request.method,
            key: request.headers['idempotency-key'],
            status: upstream.status,
          });
          if (loseReceipt && upstream.ok) {
            loseReceipt = false;
            return send(503, {});
          }
        }
        return send(upstream.status, data);
      }
      if (url.pathname === '/api/me')
        return send(200, {
          identityId: uid,
          account: { status: 'ACTIVE' },
          profile: { name: uid },
        });
      if (url.pathname === '/api/me/profile')
        return send(200, {
          identityId: uid,
          revision: 1,
          registeredAt: 1,
          updatedAt: 1,
          profile: {
            name: uid,
            bio: null,
            location: null,
            avatarUri: null,
            socialLinks: {},
          },
        });
      if (url.pathname === '/api/me/preferences')
        return send(200, {
          identityId: uid,
          revision: 1,
          updatedAt: null,
          preferences: {
            ...defaultAccountPreferences(),
            content: { ...defaultAccountPreferences().content, showMatureContent: true },
          },
        });
      if (url.pathname === '/api/me/favorites')
        return send(200, { identityId: uid, revision: 1, favorites: [] });
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'))
        return send(404, {});
      const requested = path.resolve(bundle, '.' + url.pathname);
      const relative = path.relative(bundle, requested);
      const file =
        !relative.startsWith('..') &&
        fs.existsSync(requested) &&
        fs.statSync(requested).isFile()
          ? requested
          : path.join(bundle, 'index.html');
      response.writeHead(200, {
        'content-type': mime[path.extname(file)] ?? 'application/octet-stream',
      });
      fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end('{}');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    async function session(token) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', (request) =>
        request.url().startsWith(origin + '/') ||
        request.url().startsWith('data:')
          ? void request.continue()
          : void request.abort()
      );
      await page.evaluateOnNewDocument((token) => {
        if (token) localStorage.setItem('_i', token);
        else localStorage.removeItem('_i');
        localStorage.setItem(
          'wapps.suite-drafts.v1',
          '[{"title":"Never import this browser draft"}]'
        );
      }, token);
      return page;
    }
    const page = await session('suite-alice');
    const second = await session('suite-alice');
    const bob = await session('suite-bob');
    const go = (route, target = page) =>
      target.goto(origin + route, { waitUntil: 'networkidle0' });
    const text = async (value, target = page) => {
      try {
        await target.waitForFunction(
          (value) =>
            document
              .querySelector('private-suites-page, suite-publication-page, results-page')
              ?.textContent.includes(value),
          {},
          value
        );
      } catch (error) {
        await target.screenshot({
          path: path.join(output, 'failure.png'),
          fullPage: true,
        });
        const content = await target.evaluate(
          () =>
            document.querySelector(
              'private-suites-page, suite-publication-page, results-page'
            )?.textContent
        );
        throw new Error(
          `Expected ${value} at ${target.url()}; rendered ${content}`,
          { cause: error }
        );
      }
    };
    async function click(label, target = page) {
      await target.waitForFunction(
        (label) =>
          [
            ...document.querySelectorAll(
              'private-suites-page button, suite-publication-page button'
            ),
          ].some(
            (button) => button.textContent.trim() === label && !button.disabled
          ),
        {},
        label
      );
      await target.evaluate(
        (label) =>
          [
            ...document.querySelectorAll(
              'private-suites-page button, suite-publication-page button'
            ),
          ]
            .find(
              (button) =>
                button.textContent.trim() === label && !button.disabled
            )
            .click(),
        label
      );
    }
    async function fill(selector, value, target = page) {
      await target.$eval(
        selector,
        (input, value) => {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        },
        value
      );
    }
    async function capture(state, target = page) {
      for (const theme of ['light', 'dark'])
        for (const width of [390, 768, 1440]) {
          await target.setViewport({ width, height: 1000 });
          await target.emulateMediaFeatures([
            { name: 'prefers-color-scheme', value: theme },
          ]);
          await target.waitForFunction(
            (theme) => document.body.getAttribute('tuiTheme') === theme,
            {},
            theme
          );
          await target.evaluate(async () => {
            await document.fonts.ready;
            await Promise.allSettled(
              document
                .getAnimations()
                .filter((animation) =>
                  Number.isFinite(animation.effect?.getComputedTiming().endTime)
                )
                .map((animation) => animation.finished)
            );
          });
          const layout = await target.evaluate(() => {
            const host = document.querySelector(
              'private-suites-page, suite-publication-page, results-page'
            );
            const header = host
              .querySelector('ui-page-header, .detail-header, .detail-page ui-content-state')
              .getBoundingClientRect();
            const content = host
              .querySelector('.suite-workspace, .detail-header, .detail-page ui-content-state, .catalog-toolbar')
              .getBoundingClientRect();
            const title = host
              .querySelector('.page-header-title, .detail-header h1, .detail-page ui-content-state h2')
              .getBoundingClientRect();
            return {
              reading: !!host.querySelector('.detail-page'),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              titleWidth: title.width,
              minimumTitleWidth: Math.min(160, header.width / 2),
              alignment: Math.abs(header.left - content.left),
              gap: content.top - header.bottom,
              theme: document.body.getAttribute('tuiTheme'),
            };
          });
          assert.equal(
            layout.overflow,
            false,
            `${state}/${theme}/${width} overflow`
          );
          assert.ok(layout.alignment < 2);
          assert.ok(
            layout.titleWidth >= layout.minimumTitleWidth,
            `${state}/${theme}/${width}: header actions squeeze the title to ${layout.titleWidth}px`
          );
          assert.ok(
            layout.reading || Math.abs(layout.gap - 24) < 2,
            `${state}: gap ${layout.gap}`
          );
          const file = `${state}-${theme}-${width}.png`;
          await target.screenshot({
            path: path.join(output, file),
            fullPage: true,
          });
          layouts.push({ state, width, ...layout, file });
        }
    }
    await go('/my/suites');
    await text('No suites yet');
    await capture('empty');
    await go('/suites/create');
    await text('Browser Suite Alpha');
    await page.focus('#suite-title');
    await page.keyboard.press('Tab');
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'suite-description'
    );
    await fill('#suite-title', 'Research tools');
    await fill(
      '#suite-description',
      'A collection that persists across sessions.'
    );
    await page.click('input[aria-label="Include Browser Suite Alpha"]');
    await capture('create');
    loseReceipt = true;
    await click('Save suite');
    await text('Retry unconfirmed change');
    const originalKey = commands.at(-1).key;
    await click('Retry unconfirmed change');
    await page.waitForFunction(() =>
      location.pathname.startsWith('/my/suites/')
    );
    await text('Edit suite');
    assert.equal(commands.at(-1).key, originalKey);
    const detailPath = new URL(page.url()).pathname;
    const suiteId = detailPath.split('/').at(-1);
    assert.equal(
      Number(
        (
          await source.query(
            'SELECT COUNT(*) AS total FROM private_suites WHERE ownerIdentityId = ?',
            [principals['suite-alice']]
          )
        )[0].total
      ),
      1
    );
    await go(detailPath, second);
    await text('Research tools', second);
    await go(detailPath, bob);
    await text('Suite not found', bob);
    await capture('detail');
    await click('Edit suite');
    await text('Browser Suite Beta');
    await fill('#suite-title', 'Updated research tools');
    await page.click('input[aria-label="Include Browser Suite Beta"]');
    await page.click('button[aria-label="Remove Browser Suite Alpha"]');
    await click('Save suite');
    await text('Suite saved.');
    const [saved] = await source.query(
      'SELECT applicationIds, revision FROM private_suites WHERE id = ?',
      [suiteId]
    );
    assert.equal(Number(saved.revision), 2);
    assert.deepEqual(
      typeof saved.applicationIds === 'string'
        ? JSON.parse(saved.applicationIds)
        : saved.applicationIds,
      [beta.id]
    );
    await click('Edit suite', second);
    await fill('#suite-title', 'Stale overwrite', second);
    await click('Save suite', second);
    await text('This suite changed', second);
    await restart();
    await go(detailPath);
    await text('Updated research tools');
    await text('Browser Suite Beta');
    metadataOffline = true;
    await go(detailPath);
    await text('Application details could not be loaded');
    await capture('metadata-error');
    metadataOffline = false;
    await click('Retry application details');
    await text('Browser Suite Beta');
    offline = true;
    await go('/my/suites');
    await text('could not be loaded');
    await capture('account-error');
    offline = false;
    await click('Reload saved suites');
    await text('Updated research tools');
    await capture('list');
    await go(detailPath);
    await click('Delete suite');
    await click('Confirm deletion');
    await text('No suites yet');
    await go(detailPath, second);
    await text('Suite not found', second);
    await go('/suites/create');
    await fill('#suite-title', 'Private unfinished input');
    await page.evaluate(() => {
      const oldValue = localStorage.getItem('_i');
      localStorage.setItem('_i', 'suite-bob');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '_i',
          oldValue,
          newValue: 'suite-bob',
          storageArea: localStorage,
        })
      );
    });
    await page.waitForFunction(
      () => document.querySelector('#suite-title')?.value === ''
    );
    assert.equal(
      Number(
        (
          await source.query(
            'SELECT COUNT(*) AS total FROM private_suites WHERE ownerIdentityId = ?',
            [principals['suite-bob']]
          )
        )[0].total
      ),
      0
    );
    await require('./suite-publication-browser.cjs').suitePublicationBrowser({
      session,
      go,
      text,
      click,
      fill,
      capture,
      projectSuite,
      source,
      restart,
      commands,
      loseResponse: () => {
        loseReceipt = true;
      },
      metadataOutage: (value) => {
        metadataOffline = value;
      },
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, 'browser.json'),
      JSON.stringify(
        {
          layouts,
          commands,
          checks: [
            'create/list/reopen/edit/delete',
            'lost-response idempotent retry',
            'second independent session',
            'wrong-account denial',
            'stale edit conflict',
            'Editorial restart',
            'metadata/account outage states',
            'account-switch draft isolation',
            'browser drafts not imported',
          ],
          limitations: [
            'Shell profile/preferences responses are fixtures',
            'Ingress tokens are mapped to trusted headers locally',
            'Catalog projection publication is controlled',
          ],
        },
        null,
        2
      )
    );
    console.log(
      `PASS: private suite browser workflow and ${layouts.length} layout states`
    );
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}
module.exports = { suiteWorkspaceBrowser };
