/* Called by the real-store catalog suite; HTTP catalog responses are never mocked. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

async function catalogPortalBrowser({ root, bffOrigin, output }) {
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  assert.ok(
    fs.existsSync(path.join(bundle, 'index.html')),
    'Build the API-mode aggregator-csr bundle first'
  );
  fs.mkdirSync(output, { recursive: true });
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
      if (url.pathname.startsWith('/api/catalog/')) {
        const upstream = await fetch(
          `${bffOrigin()}${url.pathname}${url.search}`,
          { signal: AbortSignal.timeout(20_000) }
        );
        response.writeHead(upstream.status, {
          'content-type':
            upstream.headers.get('content-type') ?? 'application/json',
          'cache-control': 'no-store',
        });
        response.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      if (
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/auth/')
      ) {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end('{"error":"Outside catalog qualification scope"}');
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
      response.end('{"error":"Catalog gateway unavailable"}');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    const requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().startsWith(origin + '/api/'))
        requests.push({ url: response.url(), status: response.status() });
    });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith(origin + '/') || url.startsWith('data:'))
        void request.continue();
      else void request.abort();
    });
    const text = (value) =>
      page.waitForFunction(
        (value) => document.body.textContent.includes(value),
        {},
        value
      );
    const go = async (url, expected) => {
      await page.goto(origin + url, { waitUntil: 'domcontentloaded' });
      try {
        await text(expected);
      } catch (error) {
        await page.screenshot({
          path: path.join(output, 'failure.png'),
          fullPage: true,
        });
        console.error(
          JSON.stringify({
            url,
            expected,
            errors,
            requests,
            text: await page.$eval('body', (body) =>
              body.innerText.slice(0, 4000)
            ),
          })
        );
        throw error;
      }
    };
    const evidence = [];
    async function layout(name, theme, width) {
      const measured = await page.evaluate((name) => {
        const home = name.startsWith('home-');
        const header = document.querySelector(
          home ? '.search-container' : 'ui-page-header'
        );
        const content = document.querySelector(
          home
            ? '.dropdown'
            : '.items-grid, .directory-grid, .hero-section, .discovery-content'
        );
        const frame = (element) => {
          const box = element?.getBoundingClientRect();
          return box
            ? { x: box.x, width: box.width, top: box.top, bottom: box.bottom }
            : null;
        };
        return {
          theme: document.body.getAttribute('tuiTheme'),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          header: frame(header),
          content: frame(content),
          title: frame(document.querySelector('h1')),
          breadcrumbs: frame(document.querySelector('ui-breadcrumbs')),
          heroInfo: frame(document.querySelector('.hero-info')),
        };
      }, name);
      await page.screenshot({
        path: path.join(output, `${name}-${theme}-${width}.png`),
        fullPage: true,
      });
      console.log(
        JSON.stringify({ catalogLayout: { name, theme, width, ...measured } })
      );
      assert.equal(measured.theme, theme);
      assert.equal(
        measured.overflow,
        false,
        `${name} overflows at ${width}/${theme}`
      );
      assert.ok(
        measured.header && measured.content,
        `${name} content is missing`
      );
      assert.ok(
        Math.abs(measured.header.x - measured.content.x) < 2,
        `${name} title/content alignment`
      );
      assert.ok(
        Math.abs(measured.header.width - measured.content.width) < 2,
        `${name} title/content width`
      );
      if (measured.breadcrumbs && measured.title) {
        assert.ok(
          measured.title.top >= measured.breadcrumbs.bottom,
          `${name} breadcrumb/title overlap`
        );
      }
      if (name === 'overview') {
        assert.ok(
          measured.heroInfo &&
            measured.heroInfo.top >= measured.content.top &&
            measured.heroInfo.bottom <= measured.content.bottom + 1,
          'Overview information must not be clipped when the cover is absent'
        );
      }
      assert.deepEqual(errors, [], 'Browser application errors');
      evidence.push({ name, theme, width, ...measured });
    }
    async function previewState(phrase, expected) {
      await go(
        '/?search=' + encodeURIComponent(phrase),
        'Could not load activity'
      );
      await page.focus('multi-search input');
      await page.waitForFunction(
        (expected) =>
          document
            .querySelector('home-search-results')
            ?.textContent.includes(expected),
        {},
        expected
      );
      assert.deepEqual(errors, [], 'Browser application errors');
      assert.equal(await page.$('application-teaser-feed-item'), null);
      assert.equal(
        await page.$eval('explore-feed', (feed) =>
          feed.textContent.includes('No news items')
        ),
        false
      );
    }
    return {
      async qualifyLayouts() {
        for (const theme of ['light', 'dark']) {
          for (const width of [390, 768, 1440]) {
            await page.setViewport({ width, height: 1000 });
            await page.emulateMediaFeatures([
              { name: 'prefers-color-scheme', value: theme },
            ]);
            await previewState('alpha', 'Alpha 50%_!');
            assert.equal(
              await page.$eval('multi-search input', (input) =>
                input.getAttribute('aria-label')
              ),
              'Search applications articles suites'
            );
            assert.equal(
              await page.$$eval('.result-entry', (items) => items.length),
              1
            );
            assert.equal(
              await page.$eval('.result-entry', (item) =>
                item.getAttribute('href')
              ),
              '/apps/alpha'
            );
            assert.deepEqual(
              await page.$$eval('.result-entry tui-badge', (badges) =>
                badges.map((badge) => badge.textContent.trim()).sort()
              ),
              ['free', 'open source']
            );
            assert.equal(
              await page.$eval('home-search-results', (view) =>
                view.textContent.includes('Photo Snap')
              ),
              false
            );
            await layout('home-results', theme, width);
            await page.click('.result-entry');
            await text('Member ratings unavailable.');
            await previewState('no-such-catalog-record', 'No results');
            await layout('home-empty', theme, width);
            await previewState('x'.repeat(101), 'Use at most 100 characters');
            assert.equal(await page.$('.no-results'), null);
            await layout('home-error', theme, width);
            await go('/app?search=alpha', 'Alpha 50%_!');
            assert.equal(
              await page.$$eval('.discovery-card', (cards) => cards.length),
              1
            );
            assert.equal(
              await page.$eval('.discovery-card h3 a', (item) =>
                item.getAttribute('href')
              ),
              '/apps/alpha'
            );
            assert.equal(
              await page.evaluate(() =>
                document.body.textContent.includes('Photo Snap')
              ),
              false
            );
            await layout('results', theme, width);
            await go('/categories', 'Browse applications in Editors.');
            assert.equal(await page.$('.app-count'), null);
            assert.equal(await page.$('.featured-apps'), null);
            await layout('categories', theme, width);
            await page.click('a.directory-link[href="/categories/editors"]');
            await page.waitForSelector('.item-main[href="/apps/alpha"]');
            await page.click('.item-main[href="/apps/alpha"]');
            await text('Member ratings unavailable.');
            assert.equal(
              await page.$eval('h1', (title) => title.textContent.trim()),
              'Alpha 50%_!'
            );
            assert.ok(await page.$('a[href="/tags/open-source"]'));
            assert.equal(
              await page.evaluate(() =>
                document.body.textContent.includes('No discussions yet')
              ),
              false
            );
            await layout('overview', theme, width);
            await go('/tags', 'Browse applications tagged with Open source.');
            await layout('tags', theme, width);
          }
        }
        await previewState('a', 'Applications');
        assert.equal(
          await page.$$eval('.result-entry', (entries) => entries.length),
          3
        );
        assert.match(
          await page.$eval('.full-search-redirect', (link) => link.textContent),
          /4/
        );
        await page.click('.group-header');
        await text('4 matching results');
        assert.equal(
          new URL(page.url()).searchParams.get('type'),
          'applications'
        );
        assert.equal(new URL(page.url()).searchParams.get('search'), 'a');
        await previewState('alpha', 'Alpha 50%_!');
        await page.click('button[aria-label="Submit search"]');
        await text('1 matching results');
        assert.equal(new URL(page.url()).searchParams.get('search'), 'alpha');
        await go('/app?pageSize=3', 'Page 1 of 2');
        assert.equal(
          await page.$$eval('.discovery-card', (cards) => cards.length),
          3
        );
        await page.click('button[aria-label="Next Applications page"]');
        await text('Page 2 of 2');
        assert.equal(
          await page.$$eval('.discovery-card', (cards) => cards.length),
          1
        );
        assert.equal(
          await page.$eval('.discovery-card h3', (title) =>
            title.textContent.trim()
          ),
          'Gamma'
        );
        await page.reload({ waitUntil: 'domcontentloaded' });
        await text('Page 2 of 2');
        await go(
          '/app?pageSize=3&category=tools&tag=free&tag=open-source',
          '1 matching results'
        );
        assert.equal(
          await page.$$eval('.discovery-card', (cards) => cards.length),
          1
        );
        await go(
          '/app?search=missing-catalog-record',
          'No matching results on this page'
        );
        assert.equal(await page.$('.discovery-card'), null);
        fs.writeFileSync(
          path.join(output, 'layout.json'),
          JSON.stringify(evidence, null, 2) + '\n'
        );
      },
      previewState,
      async detailState(title) {
        await go('/apps/alpha/overview', title);
        assert.equal(
          await page.$eval('h1', (heading) => heading.textContent.trim()),
          title
        );
        assert.deepEqual(errors, [], 'Browser application errors');
      },
      async unavailableCatalog() {
        await go('/app', 'Discover unavailable');
        assert.equal(await page.$('.discovery-card'), null);
        assert.equal(
          await page.evaluate(() =>
            document.body.textContent.includes(
              'No matching results on this page'
            )
          ),
          false
        );
        assert.deepEqual(errors, [], 'Browser application errors');
      },
      async stop() {
        try {
          await browser.close();
        } finally {
          await new Promise((resolve) => server.close(resolve));
        }
      },
    };
  } catch (error) {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    throw error;
  }
}

module.exports = { catalogPortalBrowser };
