/* Browser contract/layout checks use the production bundle and local HTTP fixtures, not live account services. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const root = path.resolve(
  __dirname,
  '../../dist/apps/portals/aggregator/entrypoints/csr'
);
const output = '/tmp/wapps-readiness/identity-browser';
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

async function main() {
  fs.mkdirSync(output, { recursive: true });
  assert.ok(
    fs.existsSync(path.join(root, 'index.html')),
    'Build aggregator-csr first'
  );
  let mode = 'success';
  const commands = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'POST' || url.pathname === '/auth/methods') {
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const body = raw ? JSON.parse(raw) : null;
      commands.push({
        path: url.pathname,
        body,
        key: request.headers['idempotency-key'],
      });
      response.setHeader('content-type', 'application/json');
      if (mode === 'unavailable') {
        response.statusCode = 503;
        response.end('{"error":"Service unavailable"}');
        return;
      }
      if (mode === 'expired' && url.pathname.endsWith('/verify')) {
        response.statusCode = 400;
        response.end(
          '{"error":"This reset link has expired. Request a new link."}'
        );
        return;
      }
      const fixtures = {
        '/auth/methods': {
          methods: [
            {
              provider: 'EMAIL_PASSWORD',
              displayName: 'Email and password',
              enabled: true,
            },
          ],
        },
        '/auth/password-reset/verify': { valid: true },
        '/auth/password-reset/complete': { completed: true },
        '/auth/register': {
          token: 'fixture-token',
          refreshToken: 'fixture-refresh',
          uid: 'FixtureUid',
          expiresIn: '3600',
        },
        '/api/password-recovery': { accepted: true },
      };
      if (!(url.pathname in fixtures)) {
        response.statusCode = 404;
        response.end('{}');
        return;
      }
      response.end(JSON.stringify(fixtures[url.pathname]));
      return;
    }
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    )
      file = path.join(root, 'index.html');
    response.setHeader(
      'content-type',
      mime[path.extname(file)] ?? 'application/octet-stream'
    );
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const evidence = [];
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().startsWith(origin) || request.url().startsWith('data:'))
        void request.continue();
      else void request.abort();
    });
    const text = (value) =>
      page.waitForFunction(
        (value) => document.body.innerText.includes(value),
        {},
        value
      );
    for (const theme of ['light', 'dark']) {
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
      ]);
      for (const width of [1440, 768, 820, 390]) {
        await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        await page.goto(
          `${origin}/auth/action?mode=resetPassword&oobCode=fixture-code`,
          { waitUntil: 'networkidle0' }
        );
        try {
          await page.waitForSelector('#reset-password', {
            visible: true,
            timeout: 5000,
          });
        } catch (error) {
          await page.screenshot({
            path: `${output}/failure.png`,
            fullPage: true,
          });
          console.error(
            JSON.stringify({
              errors,
              requestedPaths: commands.map((command) => command.path),
              text: await page.$eval('body', (body) =>
                body.innerText.slice(0, 2500)
              ),
            })
          );
          throw error;
        }
        assert.equal(
          new URL(page.url()).search,
          '',
          'Action code must leave browser history'
        );
        const layout = await page.evaluate(() => ({
          overflow:
            document.documentElement.scrollWidth > window.innerWidth + 1,
          header: document.querySelector('h1')?.getBoundingClientRect().left,
          form: document
            .querySelector('password-reset-container')
            ?.getBoundingClientRect().left,
          theme: document.body.getAttribute('tuiTheme'),
          background: getComputedStyle(document.documentElement)
            .backgroundColor,
          stylesheets: [
            ...document.querySelectorAll('link[rel=stylesheet]'),
          ].map((link) => ({
            path: new URL(link.href).pathname,
            media: link.media,
          })),
        }));
        console.log(JSON.stringify({ theme, width, layout }));
        assert.equal(layout.theme, theme, 'Requested theme must be active');
        assert.ok(
          layout.stylesheets.every((link) => link.media !== 'print'),
          'Application stylesheets must apply even when external requests fail'
        );
        assert.equal(
          layout.overflow,
          false,
          `Horizontal overflow at ${width}/${theme}`
        );
        assert.ok(
          Math.abs(layout.header - layout.form) < 2,
          'Page title and form must share the content column'
        );
        await page.screenshot({
          path: `${output}/reset-${theme}-${width}.png`,
          fullPage: true,
        });
        await page.type('#reset-password', 'new-password');
        await page.keyboard.press('Tab');
        assert.equal(
          await page.$eval(
            '#reset-password-confirmation',
            (field) => field === document.activeElement
          ),
          true,
          'Keyboard order must reach password confirmation'
        );
        await page.type('#reset-password-confirmation', 'new-password');
        await page.keyboard.press('Tab');
        assert.equal(
          await page.$eval(
            'password-reset-container button[type=submit]',
            (button) => button === document.activeElement
          ),
          true,
          'Keyboard order must reach submit'
        );
        await page.keyboard.press('Enter');
        await text('Your password has been changed');
        await page.screenshot({
          path: `${output}/reset-success-${theme}-${width}.png`,
          fullPage: true,
        });
        await page.click(
          '.account-options a[routedDialogButton="identity/authenticate"]'
        );
        await page.waitForSelector('login-form', { visible: true });
        await page.click('button[routedDialogButton="identity/register"]');
        await page.waitForSelector('registration-form', { visible: true });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1
          ),
          false
        );
        await page.screenshot({
          path: `${output}/registration-${theme}-${width}.png`,
          fullPage: true,
        });
        await page.click(
          '[data-component-id="registration-dialog"] a[routedDialogButton="identity/recover"]'
        );
        await page.waitForSelector('password-reset-request-form', {
          visible: true,
        });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1
          ),
          false
        );
        await page.screenshot({
          path: `${output}/recovery-${theme}-${width}.png`,
          fullPage: true,
        });
        evidence.push({
          theme,
          width,
          layout,
          resetConfirmed: true,
          keyboardSubmission: true,
          registrationLayout: true,
          recoveryLayout: true,
        });
      }
    }
    mode = 'expired';
    await page.goto(
      `${origin}/auth/action?mode=resetPassword&oobCode=expired`,
      { waitUntil: 'networkidle0' }
    );
    await text('This reset link has expired');
    assert.equal(await page.$('#reset-password'), null);
    mode = 'success';
    await page.click('.account-options a');
    await page.waitForSelector('login-form', { visible: true });
    await page.click('button[routedDialogButton="identity/register"]');
    await page.waitForSelector('registration-form', { visible: true });
    for (const [name, value] of Object.entries({
      nickname: 'Alice',
      email: 'alice@example.test',
      password: 'password',
      passwordConfirmation: 'password',
    }))
      await page.type(
        `registration-form input[formcontrolname="${name}"]`,
        value
      );
    mode = 'unavailable';
    await page.click('registration-form button[type=submit]');
    await text('The service is unavailable');
    assert.equal(
      await page.$eval(
        'registration-form button[type=submit]',
        (button) => button.disabled
      ),
      false
    );
    mode = 'success';
    await page.click('registration-form button[type=submit]');
    await text('Your account is ready');
    const registrations = commands.filter(
      (command) => command.path === '/auth/register'
    );
    assert.equal(registrations.length, 2);
    assert.ok(registrations[0].key);
    assert.equal(registrations[0].key, registrations[1].key);
    assert.equal(
      await page.evaluate(() =>
        Object.values(localStorage).some((value) => value.includes('password'))
      ),
      false
    );
    await page.screenshot({
      path: `${output}/registration-success-mobile-dark.png`,
      fullPage: true,
    });
    await page.click(
      '[data-component-id="registration-dialog"] a[routedDialogButton="identity/recover"]'
    );
    await page.waitForSelector('password-reset-request-form', {
      visible: true,
    });
    await page.type('password-reset-request-form input', 'alice@example.test');
    mode = 'unavailable';
    await page.click('password-reset-request-form button[type=submit]');
    await text('The service is unavailable');
    assert.equal(
      await page.$eval(
        'password-reset-request-form button[type=submit]',
        (button) => button.disabled
      ),
      false
    );
    mode = 'success';
    await page.click('password-reset-request-form button[type=submit]');
    await text('If this email has an account');
    assert.equal(
      commands.filter((command) => command.path === '/api/password-recovery')
        .length,
      2
    );
    assert.deepEqual(errors, [], 'No browser runtime errors');
    fs.writeFileSync(
      `${output}/results.json`,
      JSON.stringify(
        {
          status: 'passed',
          apiMode: 'local-fixtures',
          layouts: evidence,
          registrationRetry: true,
          recovery: true,
          expiredCode: true,
          runtimeErrors: errors,
        },
        null,
        2
      )
    );
    console.log(
      'Eight theme/viewport layouts, keyboard reset completion, expired links, registration retry and recovery retry passed with local HTTP fixtures.'
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
