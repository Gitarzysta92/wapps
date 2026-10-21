/* Real compiled identity services behind a local gateway, no fabricated profile/session responses. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

async function emailVerificationBrowser({
  root,
  output,
  authOrigin,
  accountOrigin,
  secret,
  alice,
  bob,
  codeFor,
  providerOutage,
  restart,
}) {
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  assert.ok(
    fs.existsSync(path.join(bundle, 'index.html')),
    'Build the API portal first'
  );
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
  let loseCompletion = false;
  let completions = 0;
  let requests = 0;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (
        url.pathname.startsWith('/auth/') &&
        url.pathname !== '/auth/action'
      ) {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          assert.ok(body.length <= 32768);
        }
        const upstream = await fetch(
          `${authOrigin()}${url.pathname}${url.search}`,
          {
            method: req.method,
            headers: {
              'content-type': 'application/json',
              authorization: req.headers.authorization ?? '',
              'idempotency-key': req.headers['idempotency-key'] ?? '',
            },
            ...(body ? { body } : {}),
            signal: AbortSignal.timeout(15000),
          }
        );
        const payload = Buffer.from(await upstream.arrayBuffer());
        if (url.pathname === '/auth/email-verification/request') requests++;
        if (url.pathname === '/auth/email-verification/complete') {
          completions++;
          if (loseCompletion && upstream.ok) {
            loseCompletion = false;
            res
              .writeHead(503, { 'content-type': 'application/json' })
              .end('{}');
            return;
          }
        }
        res
          .writeHead(upstream.status, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(payload);
        return;
      }
      if (url.pathname.startsWith('/api/me')) {
        const validation = await fetch(`${authOrigin()}/validate`, {
          headers: { authorization: req.headers.authorization ?? '' },
          signal: AbortSignal.timeout(15000),
        });
        await validation.arrayBuffer();
        if (!validation.ok) {
          res
            .writeHead(validation.status, {
              'content-type': 'application/json',
            })
            .end('{}');
          return;
        }
        assert.equal(validation.headers.get('x-ingress-auth'), secret);
        const upstream = await fetch(
          `${accountOrigin()}${url.pathname}${url.search}`,
          {
            headers: {
              'x-ingress-auth': validation.headers.get('x-ingress-auth'),
              'x-user-id': validation.headers.get('x-user-id'),
              'x-user-claims': validation.headers.get('x-user-claims') ?? '{}',
            },
            signal: AbortSignal.timeout(15000),
          }
        );
        res
          .writeHead(upstream.status, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          .end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        res
          .writeHead(503, { 'content-type': 'application/json' })
          .end('{"error":"Outside identity qualification"}');
        return;
      }
      let file = path.resolve(bundle, '.' + decodeURIComponent(url.pathname));
      if (
        !file.startsWith(bundle + path.sep) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile()
      )
        file = path.join(bundle, 'index.html');
      res.writeHead(200, {
        'content-type': mime[path.extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    } catch {
      if (!res.headersSent)
        res.writeHead(503, { 'content-type': 'application/json' });
      res.end('{}');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const evidence = [];
  const errors = [];
  async function close() {
    await browser?.close();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
  const text = (page, value) =>
    page.waitForFunction(
      (value) => document.body.innerText.includes(value),
      { timeout: 15000 },
      value
    );
  async function click(page, label) {
    const buttons = await page.$$('button');
    for (const button of buttons)
      if (
        (await button.evaluate((element) => element.textContent.trim())) ===
        label
      ) {
        await button.click();
        return;
      }
    throw new Error(`Missing action: ${label}`);
  }
  async function settings(page) {
    await page.goto(`${origin}/me/settings/profile`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('email-verification-status', { visible: true });
  }
  async function capture(page, state) {
    for (const theme of ['light', 'dark']) {
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
      ]);
      for (const width of [390, 768, 1440]) {
        await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        await page.waitForFunction(
          (theme) => document.body.getAttribute('tuiTheme') === theme,
          {},
          theme
        );
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise(requestAnimationFrame);
          await Promise.race([
            Promise.allSettled(
              document
                .getAnimations()
                .filter(
                  (animation) =>
                    animation instanceof CSSTransition &&
                    animation.playState === 'running'
                )
                .map((animation) => animation.finished)
            ),
            new Promise((resolve) => setTimeout(resolve, 1000)),
          ]);
        });
        const layout = await page.evaluate(() => {
          const header = document
            .querySelector('ui-page-header')
            ?.getBoundingClientRect();
          const content = document
            .querySelector('.settings-content, .reset-content')
            ?.getBoundingClientRect();
          const card = document.querySelector('[aria-label="Sign-in email"]');
          const cardHeader = card
            ?.querySelector('header')
            ?.getBoundingClientRect();
          const verification = card
            ?.querySelector('email-verification-status')
            ?.getBoundingClientRect();
          return {
            emailColor: verification
              ? getComputedStyle(
                  card.querySelector('email-verification-status')
                ).color
              : null,
            primaryColor: getComputedStyle(document.body).color,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            alignment:
              header && content ? Math.abs(header.left - content.left) : null,
            contentGap: header && content ? content.top - header.bottom : null,
            cardGap:
              verification && cardHeader
                ? verification.top - cardHeader.bottom
                : null,
          };
        });
        assert.equal(
          layout.overflow,
          false,
          `${state} ${theme}/${width} overflow`
        );
        if (layout.emailColor !== null)
          assert.equal(
            layout.emailColor,
            layout.primaryColor,
            `${state} readable verification text`
          );
        assert.ok(
          layout.alignment !== null && layout.alignment < 2,
          `${state} column alignment`
        );
        assert.ok(
          Math.abs(layout.contentGap - 24) < 2,
          `${state} content gap ${layout.contentGap}`
        );
        if (layout.cardGap !== null)
          assert.ok(
            Math.abs(layout.cardGap - 16) < 2,
            `${state} card gap ${layout.cardGap}`
          );
        const file = `${state}-${theme}-${width}.png`;
        await page.screenshot({
          path: path.join(output, file),
          fullPage: true,
        });
        evidence.push({ state, theme, width, file, ...layout });
      }
    }
  }
  try {
    browser = await puppeteer.launch({ headless: true });
    async function session(credentials) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if ((req.headers()['referer'] ?? '').includes('oobCode='))
          errors.push('Email action code appeared in a referrer');
        if (req.url().startsWith(origin) || req.url().startsWith('data:'))
          void req.continue();
        else void req.abort();
      });
      if (credentials)
        await page.evaluateOnNewDocument((value) => {
          localStorage.setItem('_i', value.token);
          localStorage.setItem('auth_refresh_token', value.refreshToken);
        }, credentials);
      return page;
    }
    const a = await session(alice),
      b = await session(bob),
      action = await session();
    await settings(a);
    await text(a, 'Email not verified');
    await capture(a, 'unverified');
    await settings(b);
    await text(b, bob.email);
    assert.equal(
      await b.evaluate(
        (email) => document.body.innerText.includes(email),
        alice.email
      ),
      false
    );
    await click(a, 'Request verification email');
    await text(a, 'Verification email requested.');
    assert.equal(requests, 1);
    await capture(a, 'request-accepted');
    const code = await codeFor(alice.email);
    await action.goto(
      `${origin}/auth/action?mode=verifyEmail&oobCode=${code}`,
      { waitUntil: 'networkidle0' }
    );
    await text(action, 'Confirm that you want to verify');
    assert.equal(action.url(), `${origin}/auth/action`);
    assert.equal(completions, 0);
    assert.equal(
      await action.evaluate(
        (code) =>
          Object.values(localStorage).some((value) => value.includes(code)),
        code
      ),
      false
    );
    await capture(action, 'link-ready');
    loseCompletion = true;
    const confirm = await action.$('email-verification-action button');
    await confirm.focus();
    await action.keyboard.press('Enter');
    await text(action, 'Email verification could not be confirmed');
    assert.equal(completions, 1);
    await capture(action, 'uncertain-completion');
    await click(a, 'Refresh status');
    await text(a, 'Email verified');
    await capture(a, 'verified');
    await click(action, 'Check link again');
    await text(action, 'invalid or no longer available');
    await capture(action, 'used-link');
    await restart();
    await settings(a);
    await text(a, 'Email verified');
    assert.equal(
      await b.evaluate(
        (email) => document.body.innerText.includes(email),
        alice.email
      ),
      false
    );
    providerOutage(true);
    await click(b, 'Refresh status');
    await text(b, 'could not be confirmed');
    assert.equal(
      await b.evaluate(() =>
        document.body.innerText.includes('Email not verified')
      ),
      false
    );
    await capture(b, 'provider-unavailable');
    providerOutage(false);
    await click(b, 'Refresh status');
    await text(b, 'Email not verified');
    await click(b, 'Request verification email');
    await text(b, 'Verification email requested.');
    const bobCode = await codeFor(bob.email);
    await action.goto(
      `${origin}/auth/action?mode=verifyEmail&oobCode=${bobCode}`,
      { waitUntil: 'networkidle0' }
    );
    await text(action, 'Confirm that you want to verify');
    await click(action, 'Verify email');
    await text(action, 'email address for this link is now verified');
    await capture(action, 'completed');
    assert.equal(await action.evaluate(() => localStorage.getItem('_i')), null);
    await click(b, 'Refresh status');
    await text(b, 'Email verified');
    await action.goto(
      `${origin}/auth/action?mode=verifyEmail&mode=resetPassword&oobCode=invalid`,
      { waitUntil: 'networkidle0' }
    );
    await text(action, 'incomplete or unsupported');
    await capture(action, 'unsupported-link');
    await action.goto(
      `${origin}/auth/action?mode=verifyEmail&oobCode=missing-code`,
      { waitUntil: 'networkidle0' }
    );
    await text(action, 'invalid or no longer available');
    await capture(action, 'invalid-link');
    await b.evaluate(() => {
      const oldValue = localStorage.getItem('_i');
      localStorage.removeItem('_i');
      localStorage.removeItem('auth_refresh_token');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '_i',
          oldValue,
          newValue: null,
          storageArea: localStorage,
        })
      );
    });
    await text(b, 'Sign in to edit your profile');
    assert.equal(
      await b.evaluate(
        (email) => document.body.innerText.includes(email),
        bob.email
      ),
      false
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, 'browser-evidence.json'),
      JSON.stringify(
        {
          evidence,
          states: [...new Set(evidence.map((value) => value.state))],
          errors,
          requests,
          completions,
        },
        null,
        2
      )
    );
    console.log(
      `Email verification portal: ${evidence.length} layouts, explicit keyboard confirmation, code scrubbing, private account isolation, uncertain completion, status refresh and restart passed.`
    );
    return { close };
  } catch (error) {
    providerOutage(false);
    await close();
    throw error;
  }
}
module.exports = { emailVerificationBrowser };
