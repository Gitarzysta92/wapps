const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

async function profileTotalsBrowser(options) {
  const {
    root,
    output: parentOutput,
    owner,
    follower,
    ownerId,
    accountOrigin,
    accountHeaders,
    privacy,
  } = options;
  const output = path.join(parentOutput, 'profile-totals');
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
          url.pathname.startsWith('/api/admin/profile-badges') ||
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
        if (offline && url.pathname.endsWith('/' + 'totals')) {
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
          url.pathname === `/api/profiles/${ownerId}/${'totals'}`
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

  let browser, activePage;
  try {
    browser = await puppeteer.launch({ headless: true });
    async function session(token) {
      const context = await browser.createBrowserContext(),
        page = await context.newPage();
      page.setDefaultTimeout(20000);
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
    const ownerPage = await session('profile-owner'),
      reader = await session(''),
      independent = await session(''),
      approved = await session('profile-follower');
    const visit = async (page, own = false) => {
      activePage = page;
      await page.goto(origin + (own ? '/me/profile' : `/profiles/${ownerId}`), {
        waitUntil: 'networkidle0',
      });
    };
    const text = (page, value) =>
      page.waitForFunction(
        (value) =>
          document.querySelector('profile-totals')?.textContent.includes(value),
        {},
        value
      );
    const numbers = (page) =>
      page.$$eval('profile-totals dd', (nodes) =>
        nodes.map((node) => node.textContent.trim())
      );
    const expected = (value) =>
      ['discussions', 'favorites', 'suites', 'articles'].map((key) =>
        value[key] === null ? 'Not shared' : String(value[key])
      );
    const ready = async (page, value = options.expected) => {
      await page.waitForFunction(
        () => document.querySelectorAll('profile-totals dd').length === 4
      );
      assert.deepEqual(await numbers(page), expected(value));
    };
    const click = (page, label) =>
      page.$$eval(
        'profile-totals button',
        (buttons, label) => {
          const button = buttons.find(
            (button) => button.textContent.trim() === label
          );
          if (!button) throw new Error('Missing totals control');
          button.click();
        },
        label
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
                .filter((a) =>
                  Number.isFinite(a.effect?.getComputedTiming().endTime)
                )
                .map((a) => a.finished)
            );
          });
          const layout = await page.evaluate(() => {
            const host = document.querySelector(
                'public-profile-page, my-profile-page'
              ),
              header = host
                .querySelector('ui-page-header')
                .getBoundingClientRect(),
              totals = host
                .querySelector('profile-totals')
                .getBoundingClientRect();
            const section = host.querySelector('profile-totals section');
            const title = section.querySelector('h2').getBoundingClientRect();
            const description = section
              .querySelector('header p')
              .getBoundingClientRect();
            const sectionHeader = section.querySelector('header');
            return {
              descriptionGap: description.top - title.bottom,
              contentGap:
                sectionHeader.nextElementSibling.getBoundingClientRect().top -
                sectionHeader.getBoundingClientRect().bottom,
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              alignment: Math.abs(header.left - totals.left),
              widthDelta: Math.abs(header.width - totals.width),
              values: [...host.querySelectorAll('profile-totals dd')].map(
                (node) => node.textContent.trim()
              ),
            };
          });
          assert.equal(layout.descriptionGap, 8);
          assert.equal(layout.contentGap, 24);
          assert.equal(layout.overflow, false);
          assert.ok(layout.alignment <= 1);
          assert.ok(layout.widthDelta <= 1);
          layouts.push({ state, theme, width, ...layout });
          await page.screenshot({
            path: path.join(output, `${state}-${theme}-${width}.png`),
            fullPage: true,
          });
          await (
            await page.$('profile-totals')
          ).screenshot({
            path: path.join(output, `${state}-${theme}-${width}-totals.png`),
          });
        }
    }
    await visit(reader);
    await ready(reader);
    await capture(reader, 'public-totals');
    await visit(independent);
    await ready(independent);
    await visit(ownerPage, true);
    await ready(ownerPage);
    await capture(ownerPage, 'owner-totals');
    await visit(approved, true);
    await ready(approved, {
      discussions: 0,
      favorites: 0,
      suites: 0,
      articles: 0,
    });
    await capture(approved, 'empty-totals');
    heldCollection = new Promise((resolve) => {
      releaseCollection = resolve;
    });
    await click(reader, 'Refresh profile totals');
    await text(reader, 'Loading profile totals');
    assert.deepEqual(await numbers(reader), []);
    await capture(reader, 'loading-totals');
    releaseCollection();
    heldCollection = null;
    releaseCollection = null;
    await ready(reader);
    offline = true;
    await click(reader, 'Refresh profile totals');
    await text(reader, 'Profile totals could not be loaded');
    assert.deepEqual(await numbers(reader), []);
    await capture(reader, 'unavailable-totals');
    offline = false;
    await click(reader, 'Retry profile totals');
    await ready(reader);
    await privacy('public', false, {
      showSuites: false,
      showDiscussions: false,
      showFavorites: false,
    });
    await click(reader, 'Refresh profile totals');
    await ready(reader, {
      discussions: null,
      favorites: null,
      suites: null,
      articles: null,
    });
    await capture(reader, 'hidden-totals');
    await visit(ownerPage);
    await ready(ownerPage, {
      discussions: null,
      favorites: null,
      suites: null,
      articles: null,
    });
    await visit(ownerPage, true);
    await ready(ownerPage);
    await privacy('followers', true);
    const requesterId = (await options.identities.getProfile(follower))
      .publicId;
    const follow = {
      ownerId,
      requesterId,
      action: 'request',
      expectedRevision: 0,
    };
    await options
      .account(follower, 'me/profile-follows', 'PUT', follow)
      .then(options.accepted);
    await options
      .account(owner, 'me/profile-follows', 'PUT', {
        ...follow,
        action: 'approve',
        expectedRevision: 1,
      })
      .then(options.accepted);
    await visit(approved);
    await ready(approved);
    await capture(approved, 'approved-follower-totals');
    await options
      .account(owner, 'me/profile-follows', 'PUT', {
        ...follow,
        action: 'remove',
        expectedRevision: 2,
      })
      .then(options.accepted);
    await visit(approved);
    assert.equal(await approved.$('profile-totals'), null);
    await privacy('private', true);
    await visit(reader);
    assert.equal(await reader.$('profile-totals'), null);
    await privacy('public', true);
    await options.restartAccount();
    await visit(independent);
    await ready(independent);
    await capture(independent, 'restored-totals');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, 'qualification.json'),
      JSON.stringify(
        {
          workflow: 'profile-totals',
          layouts,
          errors,
          authority:
            'Compiled Account/Editorial/Discussion, real SQL/OPA/Mongo and production publication commands; local ingress identities',
          exclusions: [
            'Production credential ingress',
            'Restore, rollback, load and soak',
          ],
        },
        null,
        2
      )
    );
    options.pass(
      `profile totals portal: ${layouts.length} layouts, complete counts, hidden/zero/loading/unavailable, independent sessions, owner preview, follower removal and process restart`
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
module.exports = { profileTotalsBrowser };
