const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

async function publicProfileCollectionBrowser(options, collection) {
  const {
    root,
    output,
    owner,
    follower,
    ownerId,
    accountOrigin,
    accountHeaders,
    privacy,
  } = options;
  const firstCount = collection.firstCount ?? 20;
  fs.mkdirSync(output, { recursive: true });
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  assert.ok(fs.existsSync(path.join(bundle, 'index.html')));
  const principals = { 'profile-owner': owner, 'profile-follower': follower };
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
  let offline = false;
  let heldCollection = null;
  let releaseCollection = null;
  const errors = [];
  const layouts = [];
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const uid =
          principals[
            String(request.headers.authorization).replace(/^Bearer /, '')
          ];
        const account =
          url.pathname === '/api/me' ||
          url.pathname.startsWith('/api/me/') ||
          url.pathname === '/api/profiles' ||
          url.pathname.startsWith('/api/profiles/');
        const discussion =
          url.pathname.startsWith('/api/application-discussions/') ||
          url.pathname.startsWith('/api/application-reviews/') ||
          url.pathname.startsWith('/api/article-comments/') ||
          url.pathname === '/api/discussion-selection';
        const upstreamOrigin = account
          ? accountOrigin()
          : discussion
          ? options.discussionOrigin()
          : options.origin();
        if (offline && url.pathname.endsWith('/' + collection.kind)) {
          response.writeHead(503, { 'content-type': 'application/json' });
          response.end('{}');
          return;
        }
        const chunks = [];
        let length = 0;
        for await (const chunk of request) {
          length += chunk.length;
          if (length > 65536) throw new Error('Oversized request');
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        const upstream = await fetch(
          upstreamOrigin + url.pathname + url.search,
          {
            method: request.method,
            headers: {
              ...(account
                ? uid
                  ? accountHeaders(uid)
                  : {
                      'x-ingress-auth': accountHeaders(owner)['x-ingress-auth'],
                      'x-anonymous': 'true',
                    }
                : discussion && uid
                ? options.discussionHeaders(uid)
                : {}),
              'content-type': 'application/json',
              'idempotency-key': request.headers['idempotency-key'] ?? '',
            },
            ...(body.length ? { body } : {}),
            signal: AbortSignal.timeout(12000),
          }
        );
        if (
          heldCollection &&
          url.pathname === `/api/profiles/${ownerId}/${collection.kind}`
        )
          await heldCollection;
        response.writeHead(upstream.status, {
          'content-type':
            upstream.headers.get('content-type') ?? 'application/json',
          'cache-control': 'no-store',
        });
        response.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      if (url.pathname.startsWith('/auth/')) {
        response.writeHead(401, { 'content-type': 'application/json' });
        response.end('{}');
        return;
      }
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
      fs.createReadStream(file)
        .on('error', () => response.destroy())
        .pipe(response);
    } catch {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end('{}');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  let activePage;
  try {
    browser = await puppeteer.launch({ headless: true });
    async function session(token) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', (request) =>
        request.url().startsWith(origin + '/') ||
        request.url().startsWith('blob:') ||
        request.url().startsWith('data:')
          ? void request.continue()
          : void request.abort()
      );
      await page.evaluateOnNewDocument((token) => {
        if (token) localStorage.setItem('_i', token);
        else localStorage.removeItem('_i');
      }, token);
      return page;
    }
    const ownerPage = await session('profile-owner');
    const reader = await session('');
    const independent = await session('');
    const approved = await session('profile-follower');
    const visit = async (page) => {
      activePage = page;
      await page.goto(`${origin}/profiles/${ownerId}`, {
        waitUntil: 'networkidle0',
      });
    };
    const text = (page, value) =>
      page.waitForFunction(
        (value) =>
          document
            .querySelector('public-profile-page')
            ?.textContent.includes(value),
        {},
        value
      );
    const click = async (page, label) => {
      await page.waitForFunction(
        (label) =>
          [...document.querySelectorAll('public-profile-page button')].some(
            (button) => button.textContent.trim() === label && !button.disabled
          ),
        {},
        label
      );
      await page.$$eval(
        'public-profile-page button',
        (buttons, label) =>
          buttons
            .find(
              (button) =>
                button.textContent.trim() === label && !button.disabled
            )
            .click(),
        label
      );
    };
    const links = (page) =>
      page.$$eval(`.shared-${collection.kind} a`, (links) =>
        links.map((link) => ({
          title: link.textContent.trim(),
          href: link.getAttribute('href'),
        }))
      );
    async function capture(page, state) {
      activePage = page;
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
          await page.evaluate(async () => {
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
          const layout = await page.evaluate((kind) => {
            const host = document.querySelector('public-profile-page');
            const header = host
              .querySelector('ui-page-header')
              .getBoundingClientRect();
            const content = host
              .querySelector('.profile-content')
              .getBoundingClientRect();
            return {
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              alignment: Math.abs(header.left - content.left),
              widthDelta: Math.abs(header.width - content.width),
              links: [...host.querySelectorAll(`.shared-${kind} a`)].length,
            };
          }, collection.kind);
          assert.equal(layout.overflow, false);
          assert.ok(layout.alignment <= 1);
          assert.ok(layout.widthDelta <= 1);
          layouts.push({ state, theme, width, ...layout });
          await page.screenshot({
            path: path.join(output, `${state}-${theme}-${width}.png`),
            fullPage: true,
          });
        }
    }
    await visit(reader);
    await text(reader, collection.title);
    await reader.waitForFunction(
      ({ kind, count }) =>
        document.querySelectorAll(`.shared-${kind} a`).length === count,
      {},
      { kind: collection.kind, count: firstCount }
    );
    const first = await links(reader);
    assert.equal(first.length, firstCount);
    await collection.assertFirst(first);
    await capture(reader, 'shared-first-page');
    if (collection.assertDetail) {
      await reader.goto(origin + first[0].href, { waitUntil: 'networkidle0' });
      await collection.assertDetail(reader);
      await visit(reader);
    }
    if (collection.assertOwnerDetail) {
      activePage = ownerPage;
      await collection.assertOwnerDetail(ownerPage, origin);
    }
    await visit(independent);
    assert.deepEqual(await links(independent), first);
    await click(reader, 'Next ' + collection.controls);
    await reader.waitForFunction(
      ({ kind, count }) =>
        document.querySelectorAll(`.shared-${kind} a`).length === count,
      {},
      { kind: collection.kind, count: collection.nextCount }
    );
    const nextLinks = await links(reader);
    if (collection.assertNext) await collection.assertNext(nextLinks, first);
    else
      assert.ok(
        nextLinks.every(
          (item) => !first.some((previous) => previous.href === item.href)
        )
      );
    await capture(reader, 'shared-next-page');
    await click(reader, 'Refresh ' + collection.controls);
    await reader.waitForFunction(
      ({ kind, count }) =>
        document.querySelectorAll(`.shared-${kind} a`).length === count,
      {},
      { kind: collection.kind, count: firstCount }
    );
    heldCollection = new Promise((resolve) => {
      releaseCollection = resolve;
    });
    await click(reader, 'Refresh ' + collection.controls);
    await text(reader, 'Loading ' + collection.controls);
    assert.deepEqual(await links(reader), []);
    await capture(reader, 'shared-loading');
    releaseCollection();
    releaseCollection = null;
    heldCollection = null;
    await reader.waitForFunction(
      ({ kind, count }) =>
        document.querySelectorAll(`.shared-${kind} a`).length === count,
      {},
      { kind: collection.kind, count: firstCount }
    );
    offline = true;
    await click(reader, 'Refresh ' + collection.controls);
    await text(reader, collection.title + ' could not be loaded');
    assert.deepEqual(await links(reader), []);
    await capture(reader, 'shared-unavailable');
    offline = false;
    await click(reader, 'Retry ' + collection.controls);
    await reader.waitForFunction(
      ({ kind, count }) =>
        document.querySelectorAll(`.shared-${kind} a`).length === count,
      {},
      { kind: collection.kind, count: firstCount }
    );
    await ownerPage.goto(origin + '/me/settings/privacy', {
      waitUntil: 'networkidle0',
    });
    await ownerPage.waitForSelector(
      `input[aria-label="${collection.setting}"]`
    );
    await ownerPage.$eval(
      `input[aria-label="${collection.setting}"]`,
      (input) => {
        if (input.checked) input.click();
      }
    );
    await ownerPage.$$eval('.settings-actions button', (buttons) =>
      buttons
        .find((button) => button.textContent.trim() === 'Save Changes')
        .click()
    );
    await ownerPage.waitForFunction(() =>
      document
        .querySelector('.settings-feedback')
        ?.textContent.includes('saved')
    );
    await visit(reader);
    await text(reader, collection.hidden);
    assert.deepEqual(await links(reader), []);
    await capture(reader, 'shared-hidden');
    await visit(ownerPage);
    await text(ownerPage, collection.changeSharing);
    assert.deepEqual(await links(ownerPage), []);
    await privacy('followers', true);
    await visit(approved);
    await click(approved, 'Request access');
    await text(approved, 'awaiting the member');
    await visit(ownerPage);
    await click(ownerPage, 'Approve');
    await text(ownerPage, 'Approved follower');
    await visit(approved);
    await approved.waitForFunction(
      ({ kind, count }) =>
        document.querySelectorAll(`.shared-${kind} a`).length === count,
      {},
      { kind: collection.kind, count: firstCount }
    );
    await capture(approved, 'shared-approved-follower');
    await visit(reader);
    await text(reader, 'This profile is for approved followers');
    assert.deepEqual(await links(reader), []);
    await capture(reader, 'shared-follower-gate');
    await click(ownerPage, 'Remove access');
    await visit(approved);
    await text(approved, 'This profile is for approved followers');
    assert.deepEqual(await links(approved), []);
    await privacy('private', true);
    await visit(independent);
    await text(independent, 'This profile is unavailable');
    await capture(independent, 'shared-private');
    await privacy('public', true);
    await collection.empty();
    await visit(reader);
    await text(reader, collection.emptyText);
    await capture(reader, 'shared-empty');
    if (collection.assertEmpty) {
      await collection.assertEmpty(reader);
      await capture(reader, 'shared-empty-next-page');
    }
    await collection.restore();
    await options.restartAccount();
    await visit(independent);
    await independent.waitForFunction(
      ({ kind, count }) =>
        document.querySelectorAll(`.shared-${kind} a`).length === count,
      {},
      { kind: collection.kind, count: collection.restoredCount }
    );
    await capture(independent, 'shared-restored');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, 'qualification.json'),
      JSON.stringify(
        {
          workflow: 'public-profile-' + collection.kind,
          layouts,
          errors,
          authority:
            'Compiled Account/Editorial/Discussion APIs, real SQL/OPA/Mongo; local ingress identities',
          exclusions: [
            'Production provider/edge',
            'Restore, rollback, load and soak',
          ],
        },
        null,
        2
      )
    );
    options.pass(
      `public profile ${collection.kind} portal: ${layouts.length} layouts, independent sessions, actual settings toggle, canonical routes, pagination, failure/retry, follower approval/removal, hidden/private/empty states and restart`
    );
  } catch (error) {
    if (activePage) {
      await activePage.screenshot({
        path: path.join(output, 'failure.png'),
        fullPage: true,
      });
      fs.writeFileSync(
        path.join(output, 'failure.txt'),
        await activePage.evaluate(() => document.body.innerText)
      );
    }
    throw error;
  } finally {
    if (releaseCollection) releaseCollection();
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
async function publicProfileFavoritesBrowser(options) {
  return publicProfileCollectionBrowser(options, {
    kind: 'favorites',
    title: 'Shared favorites',
    controls: 'shared favorites',
    setting: 'Show Favorites',
    hidden: 'Favorites are not shared',
    changeSharing: 'Change favorites sharing',
    emptyText: 'No shared public favorites',
    nextCount: 2,
    restoredCount: 4,
    assertFirst: (first) => {
      assert.ok(
        first.some(
          (item) => item.href === `/apps/${options.application.slug}/overview`
        )
      );
      assert.ok(
        first.some((item) => item.href === '/articles/shared-profile-article')
      );
      assert.ok(
        first.some(
          (item) =>
            item.href ===
            `/apps/${options.application.slug}/discussions/${options.topic.id}`
        )
      );
    },
    empty: async () => {
      for (const target of options.targets) await options.change(target, false);
    },
    restore: async () => {
      for (const target of options.targets.slice(0, 4))
        await options.change(target);
    },
  });
}
module.exports = {
  publicProfileFavoritesBrowser,
  publicProfileCollectionBrowser,
};
