/* Production portal -> local ingress substitution -> built account API. Profile HTTP responses are real. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const {
  accountPreferencesBrowser,
} = require('./account-preferences-browser.cjs');

async function privateProfileBrowser({
  root,
  accountOrigin,
  headers,
  identities,
  source,
  output,
}) {
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  assert.ok(
    fs.existsSync(path.join(bundle, 'index.html')),
    'Build the API aggregator portal first'
  );
  fs.mkdirSync(output, { recursive: true });
  let offline = false;
  let losePreferencesReceipt = false;
  let losePhotoReceipt = false;
  let loseFollowReceipt = false;
  let loseProfileReceipt = false;
  let loseBadgeReceipt = false;
  const badgeCommands = [];
  const profileCommands = [];
  const photoCommands = [];
  const followCommands = [];
  const principals = {
    'alice-session': 'BrowserAlice',
    'bob-session': 'BrowserBob',
    'stub-session': 'BrowserStub',
    'audience-owner-session': 'BrowserAudienceOwner',
    'audience-requester-session': 'BrowserAudienceRequester',
    'badge-staff-session': 'BrowserBadgeStaff',
    'badge-member-session': 'BrowserBadgeMember',
  };
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
      if (
        [
          '/api/me',
          '/api/me/profile',
          '/api/me/preferences',
          '/api/me/badges',
          '/api/me/exports',
        ].includes(url.pathname) ||
        url.pathname.startsWith('/api/me/profile/avatar') ||
        url.pathname.startsWith('/api/profiles') ||
        url.pathname.startsWith('/api/me/profile-follows') ||
        url.pathname.startsWith('/api/admin/profile-badges')
      ) {
        const uid =
          principals[
            String(request.headers.authorization).replace(/^Bearer /, '')
          ];
        const anonymousPublic =
          url.pathname.startsWith('/api/profiles') &&
          request.method === 'GET' &&
          !request.headers.authorization;
        if ((!uid && !anonymousPublic) || offline) {
          response.writeHead(offline ? 503 : 401, {
            'content-type': 'application/json',
          });
          response.end('{}');
          return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 2 * 1024 * 1024)
            throw new Error('Oversized qualification request');
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks);
        if (
          url.pathname.startsWith('/api/admin/profile-badges/') &&
          request.method === 'PUT'
        )
          badgeCommands.push({
            key: request.headers['idempotency-key'],
            body: raw.toString('utf8'),
          });
        if (url.pathname === '/api/me/profile' && request.method === 'PUT')
          profileCommands.push({
            key: request.headers['idempotency-key'],
            body: raw.toString('utf8'),
          });
        if (
          url.pathname === '/api/me/profile/avatar' &&
          ['PUT', 'DELETE'].includes(request.method)
        )
          photoCommands.push({
            method: request.method,
            key: request.headers['idempotency-key'],
          });
        if (
          url.pathname === '/api/me/profile-follows' &&
          request.method === 'PUT'
        )
          followCommands.push({
            key: request.headers['idempotency-key'],
            body: raw.toString('utf8'),
          });
        const upstream = await fetch(
          `${accountOrigin()}${url.pathname}${url.search}`,
          {
            method: request.method,
            headers: {
              ...(anonymousPublic
                ? {
                    'x-ingress-auth': headers('BrowserAlice')['x-ingress-auth'],
                    'x-anonymous': 'true',
                  }
                : headers(uid)),
              ...(uid === 'BrowserBadgeStaff'
                ? { 'x-user-claims': '{"roles":["identity:badge-manager"]}' }
                : {}),
              'idempotency-key': request.headers['idempotency-key'] ?? '',
              'content-type':
                request.headers['content-type'] ?? 'application/json',
              'if-match': request.headers['if-match'] ?? '',
              'x-avatar-bytes': request.headers['x-avatar-bytes'] ?? '',
              'x-avatar-sha256': request.headers['x-avatar-sha256'] ?? '',
            },
            ...(raw.length ? { body: raw } : {}),
            signal: AbortSignal.timeout(5000),
          }
        );
        const payload = Buffer.from(await upstream.arrayBuffer());
        const loseReceipt =
          (loseBadgeReceipt &&
            url.pathname.startsWith('/api/admin/profile-badges/') &&
            request.method === 'PUT' &&
            upstream.ok) ||
          (loseProfileReceipt &&
            url.pathname === '/api/me/profile' &&
            request.method === 'PUT' &&
            upstream.ok) ||
          (loseFollowReceipt &&
            url.pathname === '/api/me/profile-follows' &&
            request.method === 'PUT' &&
            upstream.ok) ||
          (losePhotoReceipt &&
            url.pathname === '/api/me/profile/avatar' &&
            ['PUT', 'DELETE'].includes(request.method) &&
            upstream.ok) ||
          (losePreferencesReceipt &&
            url.pathname === '/api/me/preferences' &&
            request.method === 'PUT' &&
            upstream.ok);
        if (loseReceipt) {
          losePreferencesReceipt = false;
          losePhotoReceipt = false;
          loseFollowReceipt = false;
          loseProfileReceipt = false;
          loseBadgeReceipt = false;
        }
        response.writeHead(loseReceipt ? 503 : upstream.status, {
          'content-type': loseReceipt
            ? 'application/json'
            : upstream.headers.get('content-type'),
          'cache-control': 'no-store',
        });
        response.end(loseReceipt ? '{}' : payload);
        return;
      }
      if (
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/auth/')
      ) {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end('{"error":"Outside profile qualification scope"}');
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
      response.end('{"error":"Profile gateway unavailable"}');
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
    const results = await Promise.allSettled([
      browser?.close(),
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
    ]);
    const failed = results.filter((item) => item.status === 'rejected');
    if (failed.length)
      throw new AggregateError(
        failed.map((item) => item.reason),
        'Profile browser cleanup failed'
      );
  }
  try {
    browser = await puppeteer.launch({ headless: true });
    async function newSession(token) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (
          request.url().startsWith(origin) ||
          request.url().startsWith('data:') ||
          request.url().startsWith('blob:')
        )
          void request.continue();
        else void request.abort();
      });
      await page.evaluateOnNewDocument((token) => {
        if (token === null) localStorage.removeItem('_i');
        else localStorage.setItem('_i', token);
      }, token);
      return page;
    }
    const page = await newSession('alice-session');
    const text = (value) =>
      page.waitForFunction(
        (value) => document.body.innerText.includes(value),
        { timeout: 10000 },
        value
      );
    async function setSession(value, target = page) {
      await target.evaluate((value) => {
        const oldValue = localStorage.getItem('_i');
        if (value === null) localStorage.removeItem('_i');
        else localStorage.setItem('_i', value);
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: '_i',
            oldValue,
            newValue: value,
            storageArea: localStorage,
          })
        );
      }, value);
    }
    async function settings() {
      await page.goto(`${origin}/me/settings/profile`, {
        waitUntil: 'networkidle0',
      });
      await page.waitForSelector('input[name="name"]', { visible: true });
    }
    async function capture(state, theme, width, target = page) {
      // Session changes briefly fade the heading back in after its skeleton.
      await target.waitForFunction(() => {
        const heading = document.querySelector('h1[uiPageTitle]');
        return (
          heading &&
          !heading.classList.contains('_skeleton') &&
          Number(getComputedStyle(heading).opacity) >= 0.99
        );
      });
      await target.mouse.move(0, 0);
      await target.evaluate(async () => {
        await new Promise(requestAnimationFrame);
        const transitions = document
          .getAnimations()
          .filter(
            (animation) =>
              animation instanceof CSSTransition &&
              animation.effect?.target instanceof Element &&
              animation.effect.target.closest(
                '.settings-content, .profile-content, public-profile-page'
              )
          );
        await Promise.race([
          Promise.allSettled(
            transitions.map((animation) => animation.finished)
          ),
          new Promise((resolve) => setTimeout(resolve, 1000)),
        ]);
      });
      const layout = await target.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        theme: document.body.getAttribute('tuiTheme'),
        header: document
          .querySelector('ui-page-header')
          ?.getBoundingClientRect().left,
        content: document
          .querySelector(
            '.settings-content, .profile-content, .badge-content, .error-section'
          )
          ?.getBoundingClientRect().left,
        fakeMetrics: document.querySelectorAll('.profile-stats dd').length,
        emptyProfileImages: [
          ...document.querySelectorAll('.user-profile-btn img'),
        ].filter((image) => !image.getAttribute('src')).length,
        photoButtonsFit: [
          ...document.querySelectorAll('profile-avatar-editor button'),
        ].every(
          (button) =>
            button.scrollWidth <= button.clientWidth + 1 &&
            [...button.children].every(
              (child) => child.scrollWidth <= child.clientWidth + 1
            )
        ),
        audienceButtonsFit: [
          ...document.querySelectorAll('public-profile-page button'),
        ].every(
          (button) =>
            button.scrollWidth <= button.clientWidth + 1 &&
            [...button.children].every(
              (child) => child.scrollWidth <= child.clientWidth + 1
            )
        ),
        profileCardTextMatchesTheme: (() => {
          const heading = document.querySelector(
            'public-profile-page .profile-card h2'
          );
          if (!heading) return true;
          const reference = document.createElement('span');
          reference.style.color = 'var(--tui-text-primary)';
          document.body.append(reference);
          const matches =
            getComputedStyle(heading).color ===
            getComputedStyle(reference).color;
          reference.remove();
          return matches;
        })(),
        photoCardGap: (() => {
          const header = document.querySelector(
            '.avatar-card .settings-card-header'
          );
          const content = document.querySelector('.avatar-section');
          return header && content
            ? content.getBoundingClientRect().top -
                header.getBoundingClientRect().bottom
            : null;
        })(),
      }));
      assert.equal(
        layout.overflow,
        false,
        `${state} ${theme} ${width}: horizontal overflow`
      );
      assert.equal(layout.theme, theme);
      if (layout.header !== undefined && layout.content !== undefined)
        assert.ok(
          Math.abs(layout.header - layout.content) < 2,
          'Header/content alignment'
        );
      assert.equal(layout.fakeMetrics, 0);
      assert.equal(layout.emptyProfileImages, 0);
      assert.equal(
        layout.photoButtonsFit,
        true,
        'Photo controls must not clip their labels'
      );
      assert.equal(
        layout.audienceButtonsFit,
        true,
        'Profile audience controls must not clip their labels'
      );
      assert.equal(
        layout.profileCardTextMatchesTheme,
        true,
        'Profile cards must use the active theme text color'
      );
      if (layout.photoCardGap !== null)
        assert.ok(
          Math.abs(layout.photoCardGap - 16) < 2,
          'Photo card retains the shared 16px content gap'
        );
      await target.screenshot({
        path: path.join(output, `${state}-${theme}-${width}.png`),
        fullPage: true,
      });
      evidence.push({ state, theme, width, layout });
    }
    if (process.env.WAPPS_PROFILE_BADGES_ONLY === '1') {
      const badgePortal =
        await require('./profile-badges-browser.cjs').profileBadgesBrowser({
          origin,
          newSession,
          setSession,
          capture,
          identities,
          source,
          discardReceipt: () => {
            loseBadgeReceipt = true;
          },
          commands: badgeCommands,
        });
      const saveEvidence = () =>
        fs.writeFileSync(
          path.join(output, 'layout.json'),
          JSON.stringify(
            {
              scope: 'staff profile badges',
              substitutions: [
                'local credential-to-ingress mapping',
                'unavailable unrelated APIs',
                'lost badge receipt after committed write',
              ],
              evidence,
              errors,
            },
            null,
            2
          ) + '\n'
        );
      assert.deepEqual(errors, []);
      saveEvidence();
      return {
        close,
        unavailable: async () => {
          await badgePortal.unavailable();
          saveEvidence();
        },
        recovered: async () => {
          await badgePortal.recovered();
          assert.deepEqual(errors, []);
          saveEvidence();
          console.log(
            `Badge browser: ${evidence.length} layouts, independent staff/member/public sessions, exact retry, conflict, revocation, history, privacy and restart passed.`
          );
        },
      };
    }
    if (process.env.WAPPS_PUBLIC_PROFILES_ONLY === '1') {
      const publicPortal =
        await require('./public-profiles-browser.cjs').publicProfilesBrowser({
          origin,
          newSession,
          setSession,
          capture,
          identities,
          output,
          discardNextReceipt: () => {
            loseFollowReceipt = true;
          },
          commands: followCommands,
          discardProfileReceipt: () => {
            loseProfileReceipt = true;
          },
          profileCommands,
        });
      assert.deepEqual(errors, []);
      fs.writeFileSync(
        path.join(output, 'layout.json'),
        JSON.stringify(
          {
            scope: 'public profiles and approved followers',
            substitutions: [
              'local credential-to-ingress mapping',
              'unavailable unrelated APIs',
              'lost follower receipts after committed writes',
            ],
            evidence,
          },
          null,
          2
        ) + '\n'
      );
      console.log(
        `Public profile browser: ${evidence.length} layouts, independent and anonymous sessions, approval, removal, conflicts, exact retry and photo audience passed.`
      );
      return {
        close,
        unavailable: publicPortal.unavailable,
        recovered: publicPortal.recovered,
      };
    }
    if (process.env.WAPPS_PROFILE_AVATARS_ONLY === '1') {
      const photosPortal =
        await require('./profile-avatars-browser.cjs').profileAvatarsBrowser({
          origin,
          newSession,
          setSession,
          capture,
          identities,
          output,
          discardNextReceipt: () => {
            losePhotoReceipt = true;
          },
          commands: photoCommands,
        });
      assert.deepEqual(errors, []);
      fs.writeFileSync(
        path.join(output, 'layout.json'),
        JSON.stringify(
          {
            scope: 'private profile avatars',
            substitutions: [
              'local credential-to-ingress mapping',
              'unavailable unrelated APIs',
              'lost photo receipts after committed writes',
            ],
            evidence,
          },
          null,
          2
        ) + '\n'
      );
      console.log(
        `Private photo browser: ${evidence.length} layouts, independent sessions, lost-response retry, private object URLs, conflicts and removal passed.`
      );
      return {
        close,
        unavailable: photosPortal.unavailable,
        recovered: photosPortal.recovered,
      };
    }
    for (const theme of ['light', 'dark']) {
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
      ]);
      for (const width of [1440, 768, 390]) {
        await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        await settings();
        assert.ok(await page.$('profile-avatar-editor input[type="file"]'));
        await capture('settings', theme, width);
        await page.goto(`${origin}/me/profile`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('profile-details');
        await capture('profile', theme, width);
        await setSession('stub-session');
        await text('Complete your profile');
        assert.equal(await page.$('profile-details'), null);
        await capture('unregistered', theme, width);
        await page.goto(`${origin}/me/settings/privacy`, {
          waitUntil: 'networkidle0',
        });
        await text('Export Your Account Data');
        await capture('privacy', theme, width);
        await settings();
        const current = await identities.getProfile('BrowserAlice');
        await identities.updateProfile(
          'BrowserAlice',
          {
            expectedRevision: current.revision,
            name: `Other session ${theme} ${width}`,
            bio: current.profile.bio,
            location: current.profile.location,
            socialLinks: current.profile.socialLinks,
          },
          `other-${theme}-${width}`
        );
        await page.$eval('input[name="name"]', (element) => {
          element.value = 'My unsaved edit';
          element.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.click('.settings-actions button:last-child');
        await text('changed in another session');
        assert.equal(
          await page.$eval('input[name="name"]', (element) => element.value),
          'My unsaved edit'
        );
        await capture('conflict', theme, width);
        await page.$$eval('button', (elements) =>
          elements
            .find((element) => element.textContent.includes('Discard edits'))
            .click()
        );
        await page.waitForFunction(
          (name) =>
            document.querySelector('input[name="name"]')?.value === name,
          {},
          `Other session ${theme} ${width}`
        );
        offline = true;
        await page.reload({ waitUntil: 'networkidle0' });
        await text('Could not load settings');
        assert.equal(await page.$('input[name="name"]'), null);
        await capture('unavailable', theme, width);
        offline = false;
        await page.click('ui-content-state button');
        await page.waitForSelector('input[name="name"]');
        await setSession(null);
        await text('Sign in to edit your profile');
        await capture('signed-out', theme, width);
      }
    }
    await settings();
    const second = await newSession('alice-session');
    await second.goto(`${origin}/me/settings/profile`, {
      waitUntil: 'networkidle0',
    });
    await second.waitForSelector('input[name="name"]');
    await page.$eval('input[name="name"]', (element) => {
      element.value = 'Saved across sessions';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.focus('input[name="name"]');
    let saveFocused = false;
    for (let step = 0; step < 30 && !saveFocused; step++) {
      await page.keyboard.press('Tab');
      saveFocused = await page.evaluate(() =>
        document.activeElement?.matches('.settings-actions button:last-child')
      );
    }
    assert.equal(saveFocused, true, 'Save is reachable by keyboard');
    await page.keyboard.press('Enter');
    await text('Profile saved to your account.');
    assert.equal(
      (await identities.getProfile('BrowserAlice')).profile.name,
      'Saved across sessions'
    );
    await second.reload({ waitUntil: 'networkidle0' });
    await second.waitForFunction(
      () =>
        document.querySelector('input[name="name"]')?.value ===
        'Saved across sessions'
    );
    await setSession('bob-session');
    await page.waitForFunction(
      () =>
        document.querySelector('input[name="name"]')?.value === 'Bob Browser'
    );
    assert.ok(
      !(await page.$eval('body', (body) => body.innerText)).includes(
        'Saved across sessions'
      )
    );
    await setSession('alice-session');
    await page.waitForFunction(
      () =>
        document.querySelector('input[name="name"]')?.value ===
        'Saved across sessions'
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem('wapps.my-profile.v1')),
      null
    );
    await page.goto(`${origin}/me/settings/privacy`, {
      waitUntil: 'networkidle0',
    });
    await page.evaluate(() => {
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        window.profileExportText = blob.text();
        return create(blob);
      };
    });
    await page.$$eval('button', (elements) =>
      elements
        .find((element) =>
          element.textContent.includes('Export Saved Preferences')
        )
        .click()
    );
    await text('Saved account preferences export downloaded.');
    const exported = await page.evaluate(async () =>
      JSON.parse(await window.profileExportText)
    );
    assert.equal(exported.profile, undefined);
    assert.ok(exported.scope.includes('Excludes account profile'));
    assert.ok(!JSON.stringify(exported).includes('alice-session'));
    const photosPortal =
      await require('./profile-avatars-browser.cjs').profileAvatarsBrowser({
        origin,
        newSession,
        setSession,
        capture,
        identities,
        output,
        discardNextReceipt: () => {
          losePhotoReceipt = true;
        },
        commands: photoCommands,
      });
    const preferencesPortal = await accountPreferencesBrowser({
      origin,
      newSession,
      setSession,
      capture,
      identities,
      setOffline: (value) => {
        offline = value;
      },
      discardNextReceipt: () => {
        losePreferencesReceipt = true;
      },
    });
    await settings();
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, 'layout.json'),
      JSON.stringify(
        {
          substitutions: [
            'local ingress credential mapping',
            'unavailable unrelated APIs',
            'controlled gateway failure',
            'one lost preferences receipt after a real committed write',
            'lost photo upload/removal receipts after real committed writes',
            'blocked external image/network requests',
          ],
          evidence,
        },
        null,
        2
      ) + '\n'
    );
    console.log(
      `Profile browser: ${evidence.length} layout states plus real saves, conflicts, independent sessions and account switching pass.`
    );
    return {
      close,
      unavailable: async () => {
        await preferencesPortal.unavailable();
        await page.reload({ waitUntil: 'networkidle0' });
        await text('Could not load settings');
      },
      recovered: async () => {
        await preferencesPortal.recovered();
        await photosPortal.recovered();
        await page.click('ui-content-state button');
        await page.waitForFunction(
          () =>
            document.querySelector('input[name="name"]')?.value ===
            'Saved across sessions'
        );
        assert.deepEqual(errors, []);
      },
    };
  } catch (error) {
    console.error('Profile/settings browser qualification failure:', error);
    console.error('Profile browser errors:', errors);
    await close();
    throw error;
  }
}

module.exports = { privateProfileBrowser };
