const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const puppeteer = require('puppeteer');
const {
  MysqlCanonicalIdentities,
} = require('../../libs/adapters/account-mysql/src');

module.exports = async function qualifyAccountErasureBrowser(options) {
  const {
    root,
    output,
    accountSource,
    credentialApp,
    accountOrigin,
    headers,
    restartEditorial,
    restartDiscussion,
    restartAccount,
    pass,
  } = options;
  const identities = new MysqlCanonicalIdentities(accountSource);
  const principals = {
    'erase-owner-a': 'EraseBrowserOwner',
    'erase-owner-b': 'EraseBrowserOwner',
    'erase-lost': 'EraseBrowserLost',
    'erase-race': 'EraseBrowserRace',
    'erase-other': 'EraseBrowserOther',
  };
  const users = [...new Set(Object.values(principals))];
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  const directory = path.join(output, 'erasure-browser');
  fs.mkdirSync(directory, { recursive: true });
  const commands = [],
    requests = [],
    layouts = [],
    errors = [];
  let denyPrepare = false,
    releaseReceipt = () => undefined,
    receiptArrived = () => undefined;
  let heldReceipt = Promise.resolve();
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
      if (url.pathname === '/session-switch') {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end('<!doctype html><title>Session switch fixture</title>');
        return;
      }
      if (url.pathname === '/api/me' || url.pathname.startsWith('/api/me/')) {
        const token = String(request.headers.authorization).replace(
          /^Bearer /,
          ''
        );
        const uid = principals[token];
        if (
          !uid ||
          (denyPrepare &&
            url.pathname === '/api/me' &&
            request.method === 'GET')
        ) {
          response.writeHead(!uid ? 401 : 503, {
            'content-type': 'application/json',
          });
          response.end('{}');
          return;
        }
        const parts = [];
        for await (const part of request) parts.push(part);
        const body = Buffer.concat(parts);
        assert.ok(body.length < 1_000_000);
        const upstream = await fetch(
          accountOrigin() + url.pathname + url.search,
          {
            method: request.method,
            headers: {
              ...headers(uid),
              ...(request.headers['idempotency-key']
                ? { 'idempotency-key': request.headers['idempotency-key'] }
                : {}),
            },
            ...(body.length ? { body } : {}),
            signal: AbortSignal.timeout(15000),
          }
        );
        const bytes = Buffer.from(await upstream.arrayBuffer());
        requests.push({
          uid,
          path: url.pathname,
          method: request.method,
          status: upstream.status,
        });
        const deleting =
          request.method === 'DELETE' && url.pathname === '/api/me';
        if (deleting) commands.push({ uid, status: upstream.status });
        if (deleting && token === 'erase-race') {
          receiptArrived();
          await heldReceipt;
        }
        if (response.destroyed) return;
        const lost =
          deleting && token === 'erase-lost' && upstream.status === 202;
        if (lost) {
          receiptArrived();
          await delay(3500);
        }
        response.writeHead(lost ? 503 : upstream.status, {
          'content-type':
            upstream.headers.get('content-type') ?? 'application/json',
          'cache-control': 'no-store',
        });
        response.end(lost ? '{}' : bytes);
        return;
      }
      if (
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/auth/')
      ) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end('{}');
        return;
      }
      const file = path.resolve(bundle, '.' + decodeURIComponent(url.pathname));
      assert.ok(file.startsWith(bundle + path.sep) || file === bundle);
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
  let browser;
  try {
    for (const uid of users) {
      await credentialApp
        .auth()
        .createUser({ uid, email: `${uid}@example.test`, emailVerified: true });
      await identities.ensure({
        uid,
        provider: 'email',
        kind: 'user',
        activate: true,
      });
      await identities.enrollAccount(uid, uid, randomUUID());
    }
    await restartEditorial({
      EDITORIAL_ERASURE_WORKERS_FENCED: 'true',
      EDITORIAL_MEDIA_CLEANUP_ENABLED: 'true',
    });
    await restartDiscussion();
    await restartAccount();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await puppeteer.launch({ headless: true });
    const panel = 'account-erasure-panel';
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
      await page.evaluateOnNewDocument((token) => {
        localStorage.setItem('_i', token);
      }, token);
      await page.goto(origin + '/me/settings/privacy', {
        waitUntil: 'networkidle0',
      });
      await page.waitForSelector(panel + ' button', { visible: true });
      return page;
    }
    const text = (page, value) =>
      page.waitForFunction(
        (value) =>
          document
            .querySelector('account-erasure-panel')
            ?.textContent.includes(value),
        {},
        value
      );
    async function click(page, label) {
      await page.waitForFunction(
        (label) =>
          [...document.querySelectorAll('account-erasure-panel button')].some(
            (button) => button.textContent.trim() === label && !button.disabled
          ),
        {},
        label
      );
      await page.evaluate(
        (label) =>
          [...document.querySelectorAll('account-erasure-panel button')]
            .find((button) => button.textContent.trim() === label)
            .click(),
        label
      );
    }
    async function consent(page) {
      await click(page, 'Delete Account');
      await text(page, 'Type DELETE to confirm');
      assert.equal(
        await page.$eval(
          panel + ' .erasure-actions button',
          (button) => button.disabled
        ),
        true
      );
      await page.click(panel + ' input[type=checkbox]');
      await page.type(panel + ' input[type=text]', 'DELETE');
    }
    async function capture(page, state) {
      for (const theme of ['light', 'dark']) {
        await page.emulateMediaFeatures([
          { name: 'prefers-color-scheme', value: theme },
        ]);
        for (const width of [390, 768, 1440]) {
          await page.setViewport({ width, height: 1000 });
          await page.waitForFunction(
            (theme) => document.body.getAttribute('tuiTheme') === theme,
            {},
            theme
          );
          await page.evaluate(() => document.fonts.ready);
          // Let responsive/theme transitions finish before measuring or capturing.
          await delay(500);
          await page.$eval(panel, (element) =>
            element.scrollIntoView({ block: 'center' })
          );
          const layout = await page.evaluate(() => {
            const section = document
              .querySelector('account-erasure-panel section')
              .getBoundingClientRect();
            return {
              overflow: document.documentElement.scrollWidth > innerWidth,
              controlsFit: [
                ...document.querySelectorAll(
                  'account-erasure-panel button, account-erasure-panel input[type=text]'
                ),
              ].every((element) => {
                const box = element.getBoundingClientRect();
                return (
                  box.left >= section.left && box.right <= section.right + 1
                );
              }),
              header: document
                .querySelector('ui-page-header')
                .getBoundingClientRect().left,
              content: section.left,
              textColor: getComputedStyle(
                document.querySelector('account-erasure-panel section')
              ).color,
              surfaceColor: getComputedStyle(
                document.querySelector('account-erasure-panel section')
              ).backgroundColor,
            };
          });
          assert.equal(layout.overflow, false);
          assert.equal(layout.controlsFit, true);
          assert.ok(Math.abs(layout.header - layout.content) < 2);
          await page.screenshot({
            path: path.join(directory, `${state}-${theme}-${width}.png`),
          });
          layouts.push({ state, theme, width, ...layout });
        }
      }
    }
    const a = await session('erase-owner-a'),
      b = await session('erase-owner-b');
    denyPrepare = true;
    await click(a, 'Delete Account');
    await text(a, 'No deletion request was sent');
    assert.equal(commands.length, 0);
    denyPrepare = false;
    await consent(a);
    await click(a, 'Keep My Account');
    assert.equal(commands.length, 0);
    assert.equal(
      (await identities.find(principals['erase-owner-a'])).isDeleted,
      false
    );
    await consent(a);
    await capture(a, 'confirmation');
    await click(a, 'Permanently Delete Account');
    await text(a, 'Deletion accepted.');
    assert.equal(await a.evaluate(() => localStorage.getItem('_i')), null);
    assert.equal(
      await b.evaluate(
        async () =>
          (
            await fetch('/api/me', {
              headers: { Authorization: 'Bearer erase-owner-b' },
            })
          ).status
      ),
      401
    );
    await capture(a, 'accepted');
    await restartAccount();
    assert.equal(
      (await identities.find(principals['erase-owner-a'])).isDeleted,
      true
    );
    await text(a, 'cleanup is pending');

    const lost = await session('erase-lost');
    const lostSent = new Promise((resolve) => {
      receiptArrived = resolve;
    });
    await consent(lost);
    await click(lost, 'Permanently Delete Account');
    await lostSent;
    const backgroundDenial = lost.waitForResponse(
      (response) =>
        response.url().endsWith('/api/me/exports') && response.status() === 401
    );
    await lost.evaluate(() =>
      [...document.querySelectorAll('account-export-panel button')]
        .find((button) => button.textContent.trim() === 'Refresh Export Status')
        .click()
    );
    await backgroundDenial;
    await text(lost, 'may already have closed your account');
    assert.equal(await lost.evaluate(() => localStorage.getItem('_i')), null);
    assert.equal(
      (await identities.find(principals['erase-lost'])).isDeleted,
      true
    );
    await capture(lost, 'uncertain');

    heldReceipt = new Promise((resolve) => {
      releaseReceipt = resolve;
    });
    const arrived = new Promise((resolve) => {
      receiptArrived = resolve;
    });
    const race = await session('erase-race');
    await consent(race);
    await click(race, 'Permanently Delete Account');
    await arrived;
    // A real cross-tab storage event changes the browser session while the old server response is held.
    const switcher = await race.browserContext().newPage();
    await switcher.goto(origin + '/session-switch', {
      waitUntil: 'networkidle0',
    });
    await switcher.evaluate(() => localStorage.setItem('_i', 'erase-other'));
    await race.bringToFront();
    await race.waitForFunction(() =>
      [...document.querySelectorAll('account-erasure-panel button')].some(
        (button) =>
          button.textContent.trim() === 'Delete Account' && !button.disabled
      )
    );
    releaseReceipt();
    await delay(250);
    assert.equal(
      await race.evaluate(() => localStorage.getItem('_i')),
      'erase-other'
    );
    assert.equal(
      await race.$eval(panel, (element) =>
        element.textContent.includes('Deletion accepted.')
      ),
      false
    );
    assert.equal(
      await race.$eval(panel, (element) =>
        element.textContent.includes('EraseBrowserRace')
      ),
      false
    );
    assert.equal(
      (await identities.find(principals['erase-other'])).isDeleted,
      false
    );
    await click(race, 'Delete Account');
    await text(race, 'Confirm deletion of EraseBrowserOther');
    await click(race, 'Keep My Account');
    assert.deepEqual(commands, [
      { uid: principals['erase-owner-a'], status: 202 },
      { uid: principals['erase-lost'], status: 202 },
      { uid: principals['erase-race'], status: 202 },
    ]);
    const erased = [
      principals['erase-owner-a'],
      principals['erase-lost'],
      principals['erase-race'],
    ];
    let complete = false;
    for (let attempt = 0; attempt < 1800; attempt++) {
      const jobs = await accountSource.query(
        'SELECT identityId,completedAt,failedAt FROM identity_erasure_jobs WHERE identityId IN (?,?,?)',
        erased
      );
      assert.equal(jobs.length, 3);
      assert.ok(jobs.every((row) => row.failedAt === null));
      if (jobs.every((row) => row.completedAt !== null)) {
        complete = true;
        break;
      }
      await accountSource.query(
        'UPDATE identity_erasure_jobs SET availableAt=? WHERE identityId IN (?,?,?) AND leaseToken IS NULL AND completedAt IS NULL AND failedAt IS NULL AND availableAt>?',
        [Date.now(), ...erased, Date.now()]
      );
      await delay(100);
    }
    assert.ok(
      complete,
      'Browser-initiated deletion must complete through the compiled coordinator'
    );
    for (const uid of erased) {
      assert.equal(
        (await identities.requestDeletion(uid)).cleanup,
        'completed'
      );
      await assert.rejects(
        credentialApp.auth().getUser(uid),
        (error) => error.code === 'auth/user-not-found'
      );
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, 'erasure-browser.json'),
      JSON.stringify(
        {
          layouts,
          commands,
          errors,
          authority:
            'Compiled portal and Account/Editorial/Discussion with real MySQL, Mongo, OPA, Firebase emulator; controlled same-origin trusted ingress, withheld/lost HTTP receipts and accelerated unleased test scheduling',
          exclusions: [
            'Production ingress and deployment',
            'Full reload recovery of in-memory terminal notice',
            'Unstructured personal information embedded in retained public content',
          ],
        },
        null,
        2
      )
    );
    pass(
      'Compiled privacy-page erasure: fresh account verification, typed consent/cancel, accepted and lost responses, independent old-session denial, late receipt across actual cross-tab session change, exact one-request behavior, real coordinator/credential completion and 18 responsive/theme layouts'
    );
  } catch (error) {
    const pages = [];
    for (const page of (await browser?.pages()) ?? []) {
      pages.push({
        url: page.url(),
        panel: await page.evaluate(
          () =>
            document.querySelector('account-erasure-panel')?.textContent ?? null
        ),
      });
    }
    fs.writeFileSync(
      path.join(output, 'erasure-browser-failure.json'),
      JSON.stringify(
        { error: error.message, commands, requests, pages },
        null,
        2
      )
    );
    throw error;
  } finally {
    releaseReceipt();
    await browser?.close();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await credentialApp.auth().deleteUsers(users);
  }
};
