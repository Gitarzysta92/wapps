const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const puppeteer = require('puppeteer');

async function qualifyAccountExportBrowser({
  root,
  output,
  accountOrigin,
  headers,
  owner,
  other,
  source,
  restartAccount,
  pass,
}) {
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  assert.ok(fs.existsSync(path.join(bundle, 'index.html')));
  const directory = path.join(output, 'browser');
  fs.mkdirSync(directory, { recursive: true });
  const principals = {
    'export-owner-a': owner,
    'export-owner-b': owner,
    'export-other': other,
  };
  const commands = [],
    layouts = [],
    errors = [];
  let offline = false,
    loseReceipt = true,
    blockDownload = false;
  let releaseDownload = () => undefined,
    downloadStarted = () => undefined;
  let heldDownload = Promise.resolve();
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
      if (url.pathname === '/api/me' || url.pathname.startsWith('/api/me/')) {
        const uid =
          principals[
            String(request.headers.authorization).replace(/^Bearer /, '')
          ];
        const isExport = url.pathname.startsWith('/api/me/exports');
        if (!uid || (offline && isExport)) {
          response.writeHead(!uid ? 401 : 503, {
            'content-type': 'application/json',
          });
          response.end('{}');
          return;
        }
        const parts = [];
        let size = 0;
        for await (const part of request) {
          size += part.length;
          assert.ok(size < 1_000_000);
          parts.push(part);
        }
        const body = Buffer.concat(parts);
        const key = request.headers['idempotency-key'];
        if (isExport && request.method === 'POST')
          commands.push({ uid, key, body: body.toString('utf8') });
        const upstream = await fetch(
          accountOrigin() + url.pathname + url.search,
          {
            method: request.method,
            headers: {
              ...headers(uid),
              ...(key ? { 'idempotency-key': key } : {}),
            },
            ...(body.length ? { body } : {}),
            signal: AbortSignal.timeout(15000),
          }
        );
        const payload = Buffer.from(await upstream.arrayBuffer());
        const lost =
          loseReceipt &&
          isExport &&
          request.method === 'POST' &&
          upstream.status === 202;
        if (lost) loseReceipt = false;
        if (blockDownload && url.pathname.endsWith('/download')) {
          downloadStarted();
          await heldDownload;
        }
        if (response.destroyed) return;
        response.writeHead(lost ? 503 : upstream.status, {
          'content-type': lost
            ? 'application/json'
            : upstream.headers.get('content-type') ?? 'application/json',
          'cache-control': 'no-store',
          ...(!lost && upstream.headers.has('content-disposition')
            ? {
                'content-disposition': upstream.headers.get(
                  'content-disposition'
                ),
              }
            : {}),
        });
        response.end(lost ? '{}' : payload);
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end('{}');
        return;
      }
      const file = path.resolve(bundle, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(bundle + path.sep) && file !== bundle)
        throw new Error('Invalid static path');
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
  const lock = source.createQueryRunner();
  let locked = false;
  try {
    browser = await puppeteer.launch({ headless: true });
    async function session(token) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
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
      await page.evaluateOnNewDocument((token) => {
        localStorage.setItem('_i', token);
        const original = URL.createObjectURL.bind(URL);
        URL.createObjectURL = (blob) => {
          if (blob.type === 'application/gzip') window.exportedArchive = blob;
          return original(blob);
        };
      }, token);
      await page.goto(origin + '/me/settings/privacy', {
        waitUntil: 'networkidle0',
      });
      await page.waitForSelector('account-export-panel', { visible: true });
      return page;
    }
    const a = await session('export-owner-a'),
      b = await session('export-owner-b'),
      stranger = await session('export-other');
    const text = (page, value) =>
      page.waitForFunction(
        (value) =>
          document
            .querySelector('account-export-panel')
            ?.textContent.includes(value),
        { timeout: 20000 },
        value
      );
    async function click(page, label) {
      await page.waitForFunction(
        (label) =>
          [...document.querySelectorAll('account-export-panel button')].some(
            (button) => button.textContent.trim() === label && !button.disabled
          ),
        {},
        label
      );
      await page.evaluate(
        (label) =>
          [...document.querySelectorAll('account-export-panel button')]
            .find((button) => button.textContent.trim() === label)
            .click(),
        label
      );
    }
    await text(stranger, 'You have no account export yet.');
    await lock.connect();
    await lock.query('LOCK TABLES application_drafts WRITE');
    locked = true;
    await click(a, 'Request Account Export');
    await text(a, 'Retry the same request');
    const replay = a.waitForResponse(
      (response) =>
        response.url() === origin + '/api/me/exports' &&
        response.request().method() === 'POST' &&
        response.status() === 202
    );
    await click(a, 'Retry Same Export Request');
    await replay;
    assert.equal(commands.length, 2);
    assert.equal(commands[0].key, commands[1].key);
    assert.equal(commands[0].body, '{}');
    await click(b, 'Refresh Export Status');
    await lock.query('UNLOCK TABLES');
    locked = false;
    await text(a, 'Your archive is ready.');
    await text(b, 'Your archive is ready.');
    const latest = await (
      await fetch(accountOrigin() + '/api/me/exports', {
        headers: headers(owner),
      })
    ).json();
    const job = latest.job;
    assert.equal(job.status, 'ready');
    const denied = await stranger.evaluate(
      async (id) =>
        (
          await fetch(`/api/me/exports/${id}/download`, {
            headers: { Authorization: 'Bearer export-other' },
          })
        ).status,
      job.id
    );
    assert.equal(denied, 403);
    await click(a, 'Download Account Archive');
    await text(a, 'verified archive was sent to your browser downloads');
    const bytes = Buffer.from(
      await a.evaluate(async () => [
        ...new Uint8Array(await window.exportedArchive.arrayBuffer()),
      ])
    );
    assert.equal(createHash('sha256').update(bytes).digest('hex'), job.sha256);
    const entries = gunzipSync(bytes)
      .toString('utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.equal(entries[0].identityId, owner);
    assert.equal(entries.at(-1).captures.length, 4);
    const versions = entries
      .filter(
        (row) =>
          row.type === 'record' &&
          row.source === 'discussion' &&
          row.collection === 'payload-versions'
      )
      .map((row) => row.data);
    assert.ok(
      versions.some(
        (row) =>
          row.content === 'Runtime private discussion' && row.current === false
      )
    );
    assert.ok(
      versions.some(
        (row) =>
          row.content === 'Runtime private discussion after edit' &&
          row.current === true
      )
    );
    assert.equal(
      JSON.stringify(entries).includes('Foreign runtime private text'),
      false
    );
    pass(
      'Browser-downloaded archive includes registered historical and current Discussion bytes while excluding foreign private content'
    );
    await restartAccount();
    await b.reload({ waitUntil: 'networkidle0' });
    await text(b, 'Your archive is ready.');

    for (const theme of ['light', 'dark']) {
      await a.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
      ]);
      for (const width of [1440, 768, 390]) {
        await a.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        await a.reload({ waitUntil: 'networkidle0' });
        await text(a, 'Your archive is ready.');
        await a.waitForFunction(
          (theme) => document.body.getAttribute('tuiTheme') === theme,
          {},
          theme
        );
        const layout = await a.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          theme: document.body.getAttribute('tuiTheme'),
          header: document
            .querySelector('ui-page-header')
            .getBoundingClientRect().left,
          content: document
            .querySelector('.settings-content')
            .getBoundingClientRect().left,
          controlsFit: [
            ...document.querySelectorAll('account-export-panel button'),
          ].every((button) => button.scrollWidth <= button.clientWidth + 1),
        }));
        assert.equal(layout.overflow, false);
        assert.equal(layout.controlsFit, true);
        assert.ok(Math.abs(layout.header - layout.content) < 2);
        await a.screenshot({
          path: path.join(directory, `account-export-${theme}-${width}.png`),
          fullPage: true,
        });
        layouts.push({ theme, width, ...layout });
      }
    }
    offline = true;
    await click(a, 'Refresh Export Status');
    await text(a, 'Current export status is unavailable.');
    assert.equal(
      await a.evaluate(
        () =>
          [...document.querySelectorAll('account-export-panel button')].find(
            (button) => button.textContent.includes('Download Account Archive')
          ).disabled
      ),
      true
    );
    offline = false;
    await click(a, 'Refresh Export Status');
    await text(a, 'Your archive is ready.');
    await a.evaluate(() => {
      window.exportedArchive = null;
    });
    heldDownload = new Promise((resolve) => {
      releaseDownload = resolve;
    });
    const started = new Promise((resolve) => {
      downloadStarted = resolve;
    });
    blockDownload = true;
    await click(a, 'Download Account Archive');
    await started;
    await a.evaluate(() => {
      const oldValue = localStorage.getItem('_i');
      localStorage.setItem('_i', 'export-other');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '_i',
          oldValue,
          newValue: 'export-other',
          storageArea: localStorage,
        })
      );
    });
    releaseDownload();
    blockDownload = false;
    await text(a, 'You have no account export yet.');
    assert.equal(await a.evaluate(() => window.exportedArchive), null);
    await click(b, 'Remove Account Archive');
    await text(b, 'The export was cancelled and its archive removed.');
    assert.equal(
      (
        await fetch(accountOrigin() + `/api/me/exports/${job.id}/download`, {
          headers: headers(owner),
        })
      ).status,
      409
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(directory, 'qualification.json'),
      JSON.stringify(
        {
          layouts,
          checks: [
            'real-service archive request and exact lost-response retry',
            'independent sessions and browser reload after Account restart',
            'verified four-source download and cross-owner denial',
            'unavailable status disables download',
            'session switch cancels private download',
            'archive removal',
            'mobile/tablet/desktop in both themes',
          ],
          substitutions: [
            'local gateway maps fixture bearer tokens to trusted ingress identity headers; no deployed Firebase token validation is claimed',
          ],
        },
        null,
        2
      )
    );
    pass(
      'Compiled privacy-page account export passes real-service request/retry, independent sessions, verified download, restart/reload, denial, outage, session cancellation, removal and six responsive/theme layouts'
    );
  } finally {
    releaseDownload();
    if (locked) await lock.query('UNLOCK TABLES');
    await lock.release();
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

module.exports = { qualifyAccountExportBrowser };
