/* Compiled portal and real application draft APIs. Shell profile and trusted ingress identities are fixtures. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const {
  defaultAccountPreferences,
} = require('../../libs/domains/customer/preferences/src');

async function applicationDraftBrowser({
  root,
  origin: editorialOrigin,
  headers,
  restart,
  source,
  output,
  publicationWorkflow,
  ownershipWorkflow,
  mediaWorkflow,
  releaseWorkflow,
  articleWorkflow,
  discussionOrigin,
  discussionHeaders,
  commentWorkflow,
  accountOrigin,
  accountHeaders,
  workflowOnly = false,
  healthOrigin,
  discoveryOrigin,
  preferencesFixture,
}) {
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  assert(
    fs.existsSync(path.join(bundle, 'index.html')),
    'Build the portal before browser qualification'
  );
  const principals = {
    'draft-alice': 'DraftBrowserAlice',
    'draft-bob': 'DraftBrowserBob',
    'draft-reviewer': 'DraftBrowserReviewer',
    'ownership-reviewer': 'OwnershipBrowserReviewer',
    'comment-moderator': 'CommentBrowserModerator',
  };
  let loseReceipt = false;
  let offline = false;
  let readBarrier;
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
      const accountRequest =
        accountOrigin && url.pathname === '/api/me/favorites';
      const commentRequest =
        discussionOrigin &&
        (url.pathname.startsWith('/api/article-comments/') ||
          url.pathname === '/api/discussion-selection' ||
          url.pathname === '/api/me/discussions' ||
          url.pathname.startsWith('/api/application-discussions/') ||
          url.pathname.startsWith('/api/application-reviews/'));
      if (
        accountRequest ||
        commentRequest ||
        url.pathname.startsWith('/api/me/suites') ||
        url.pathname.startsWith('/api/editorial/suite-reviews') ||
        url.pathname.startsWith('/api/me/articles') ||
        url.pathname.startsWith('/api/me/article-covers') ||
        url.pathname.startsWith('/api/media/articles/') ||
        url.pathname.startsWith('/api/editorial/article-reviews') ||
        url.pathname.startsWith('/api/me/releases') ||
        url.pathname.startsWith('/api/editorial/release-reviews') ||
        url.pathname.startsWith('/api/me/application-drafts') ||
        url.pathname.startsWith('/api/me/application-images') ||
        url.pathname.startsWith('/api/media/applications/') ||
        url.pathname.startsWith('/api/editorial/application-reviews') ||
        url.pathname.startsWith('/api/me/ownership-claims') ||
        url.pathname.startsWith('/api/editorial/ownership-reviews') ||
        url.pathname.startsWith('/api/catalog/')
      ) {
        const isPublic =
          (commentRequest &&
            request.method === 'GET' &&
            url.pathname !== '/api/me/discussions') ||
          url.pathname.startsWith('/api/catalog/') ||
          url.pathname.startsWith('/api/media/applications/') ||
          url.pathname.startsWith('/api/media/articles/');
        if (
          (!uid && !isPublic) ||
          (typeof offline === 'function' ? offline(url.pathname) : offline)
        )
          return send(!uid && !isPublic ? 401 : 503, {});
        const chunks = [];
        let length = 0;
        for await (const chunk of request) {
          length += chunk.length;
          if (length > 8 * 1024 * 1024) throw new Error('Oversized request');
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        const upstream = await fetch(
          (accountRequest
            ? accountOrigin()
            : commentRequest
            ? discussionOrigin()
            : healthOrigin &&
              url.pathname.startsWith('/api/catalog/application-health/')
            ? healthOrigin()
            : discoveryOrigin && url.pathname === '/api/catalog/discover'
            ? discoveryOrigin()
            : editorialOrigin()) +
            url.pathname +
            url.search,
          {
            method: request.method,
            headers: {
              ...(accountRequest
                ? accountHeaders(uid)
                : commentRequest
                ? discussionHeaders(
                    uid,
                    uid === principals['comment-moderator'] ? ['admin'] : []
                  )
                : uid
                ? headers(
                    uid,
                    'default',
                    uid === principals['draft-reviewer']
                      ? ['editorial:reviewer']
                      : uid === principals['ownership-reviewer']
                      ? ['editorial:ownership-reviewer']
                      : []
                  )
                : {}),
              'idempotency-key': request.headers['idempotency-key'] ?? '',
              'content-type':
                request.headers['content-type'] ?? 'application/json',
              ...(request.headers['if-match']
                ? { 'if-match': request.headers['if-match'] }
                : {}),
            },
            ...(body.length ? { body } : {}),
            signal: AbortSignal.timeout(10000),
          }
        );
        const binary = upstream.headers
          .get('content-type')
          ?.startsWith('image/webp');
        const data = binary
          ? Buffer.from(await upstream.arrayBuffer())
          : await upstream.json();
        if (request.method !== 'GET') {
          commands.push({
            method: request.method,
            route: url.pathname,
            key: request.headers['idempotency-key'],
            status: upstream.status,
          });
          if (
            loseReceipt &&
            upstream.ok &&
            (typeof loseReceipt !== 'function' ||
              loseReceipt(url.pathname, request.method))
          ) {
            loseReceipt = false;
            return send(503, {});
          }
        }
        if (binary) {
          response.writeHead(upstream.status, {
            'content-type': 'image/webp',
            'cache-control': 'no-store',
            'x-content-type-options': 'nosniff',
          });
          return response.end(data);
        }
        if (request.method === 'GET') await readBarrier?.(url.pathname);
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
      if (url.pathname === '/api/me/preferences') {
        if (typeof offline === 'function' ? offline(url.pathname) : offline)
          return send(503, { message: 'Preferences unavailable' });
        const value = {
          identityId: uid,
          revision: 1,
          updatedAt: null,
          preferences: preferencesFixture
            ? preferencesFixture(uid, defaultAccountPreferences())
            : defaultAccountPreferences(),
        };
        await readBarrier?.(url.pathname);
        return send(200, value);
      }
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
        request.url().startsWith('blob:' + origin + '/') ||
        request.url().startsWith('data:')
          ? void request.continue()
          : void request.abort()
      );
      await page.evaluateOnNewDocument((token) => {
        if (token) localStorage.setItem('_i', token);
        else localStorage.removeItem('_i');
        localStorage.setItem(
          'wapps.aggregator.application-drafts.v1',
          '[{"title":"Never import this browser application draft"}]'
        );
      }, token);
      return page;
    }
    const page = await session('draft-alice');
    const second = await session('draft-alice');
    const bob = await session('draft-bob');
    const go = (route, target = page) =>
      target.goto(origin + route, { waitUntil: 'networkidle0' });
    const text = async (value, target = page) => {
      try {
        await target.waitForFunction(
          (value) =>
            document
              .querySelector(
                'private-suites-page, suite-publication-page, application-drafts-page, application-publication-page, application-ownership-page, application-editing-page, app-release-workspace, app-release-devlog, app-article-workspace, app-article-catalog, favorites-page, app-application-discussions-api-page, app-application-reviews-api-page, app-my-discussions-api-page, app-application-overview-page, application-health-api-page, application-timeline-api-page, discover-api-page, results-page, home-page'
              )
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
              'private-suites-page, suite-publication-page, application-drafts-page, application-publication-page, application-ownership-page, application-editing-page, app-release-workspace, app-release-devlog, app-article-workspace, app-article-catalog, favorites-page, app-application-discussions-api-page, app-application-reviews-api-page, app-my-discussions-api-page, app-application-overview-page, application-health-api-page, application-timeline-api-page, discover-api-page, results-page, home-page'
            )?.textContent
        );
        throw new Error(
          `Expected ${value} at ${target.url()}; browser errors ${JSON.stringify(
            errors
          )}; rendered ${content}`,
          { cause: error }
        );
      }
    };
    async function click(label, target = page) {
      await target.waitForFunction(
        (label) =>
          [
            ...document.querySelectorAll(
              'private-suites-page button, suite-publication-page button, application-drafts-page button, application-publication-page button, application-ownership-page button, application-editing-page button, app-release-workspace button, app-release-devlog button, app-article-workspace button, app-article-catalog button, favorites-page button, app-application-discussions-api-page button, app-application-reviews-api-page button, app-my-discussions-api-page button, app-application-overview-page button, application-health-api-page button, application-timeline-api-page button, discover-api-page button, results-page button, home-page button'
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
              'private-suites-page button, suite-publication-page button, application-drafts-page button, application-publication-page button, application-ownership-page button, application-editing-page button, app-release-workspace button, app-release-devlog button, app-article-workspace button, app-article-catalog button, favorites-page button, app-application-discussions-api-page button, app-application-reviews-api-page button, app-my-discussions-api-page button, app-application-overview-page button, application-health-api-page button, application-timeline-api-page button, discover-api-page button, results-page button, home-page button'
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
      await target.waitForSelector(selector, { visible: true });
      await target.$eval(
        selector,
        (input, value) => {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        },
        value
      );
    }
    async function capture(state, target = page, inspect) {
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
              'private-suites-page, suite-publication-page, application-drafts-page, application-publication-page, application-ownership-page, application-editing-page, app-release-workspace, app-release-devlog, app-article-workspace, app-article-catalog, favorites-page, app-application-discussions-api-page, app-application-reviews-api-page, app-my-discussions-api-page, app-application-overview-page, application-health-api-page, application-timeline-api-page, discover-api-page, results-page, home-page'
            );
            const home = host.matches('home-page');
            const header = host
              .querySelector(
                home
                  ? '.search-container'
                  : 'ui-page-header, ui-content-state.page-header'
              )
              .getBoundingClientRect();
            const contentElement = host.querySelector(
              home
                ? '.dropdown'
                : '.suite-workspace, .application-workspace, .favorites-page, .discussion-page, .review-page, .discussions-content, .hero-section, .health-content, .timeline-content, .discovery-content, .catalog-toolbar'
            );
            const content = contentElement?.getBoundingClientRect() ?? header;
            return {
              home,
              inputBorders: [
                ...host.querySelectorAll(
                  '.suite-input, .application-draft-input, .review-field, .discovery-input'
                ),
              ].map((input) =>
                Number.parseFloat(getComputedStyle(input).borderTopWidth)
              ),
              navigationRows: [
                ...host.querySelectorAll('[slot="navigation"] a'),
              ].map((link) => Math.round(link.getBoundingClientRect().top)),
              cardGaps: [
                ...host.querySelectorAll(
                  '.application-draft-card, .health-monitor, .discovery-card'
                ),
              ].map((card) => {
                const [heading, content] = card.children;
                return (
                  content.getBoundingClientRect().top -
                  heading.getBoundingClientRect().bottom
                );
              }),
              headingGaps: [
                ...host.querySelectorAll(
                  '.application-draft-heading, .cover-heading, .comment-heading, .discussion-heading, .health-heading, .discovery-group-heading'
                ),
              ]
                .filter((heading) => heading.children.length > 1)
                .map((heading) => {
                  const [title, description] = heading.children;
                  return (
                    description.getBoundingClientRect().top -
                    title.getBoundingClientRect().bottom
                  );
                }),
              commentSection: (() => {
                const comments = host.querySelector('article-comments');
                if (!comments) return null;
                return {
                  gap:
                    comments.getBoundingClientRect().top -
                    comments.previousElementSibling.getBoundingClientRect()
                      .bottom,
                  padding: Number.parseFloat(
                    getComputedStyle(comments).paddingTop
                  ),
                };
              })(),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              resultsGap: (() => {
                const catalog = host.querySelector('.catalog');
                if (!catalog) return null;
                return (
                  catalog.getBoundingClientRect().top -
                  catalog.previousElementSibling.getBoundingClientRect().bottom
                );
              })(),
              alignment: Math.abs(header.left - content.left),
              gap: contentElement ? content.top - header.bottom : null,
              theme: document.body.getAttribute('tuiTheme'),
            };
          });
          assert.equal(
            layout.overflow,
            false,
            `${state}/${theme}/${width} overflow`
          );
          assert.ok(layout.alignment < 2);
          if (layout.resultsGap !== null)
            assert.ok(
              Math.abs(layout.resultsGap - 24) < 2,
              `${state}: results gap ${layout.resultsGap}`
            );
          if (layout.commentSection) {
            assert.ok(
              Math.abs(layout.commentSection.gap - 32) < 2,
              `${state}: comments section gap ${layout.commentSection.gap}`
            );
            assert.equal(layout.commentSection.padding, 24);
          }
          assert(
            layout.inputBorders.every((border) => border > 0),
            `${state}: missing themed input border`
          );
          assert(
            new Set(layout.navigationRows).size <= 1,
            `${state}: section navigation wrapped`
          );
          for (const gap of layout.cardGaps)
            assert.ok(Math.abs(gap - 16) < 2, `${state}: card gap ${gap}`);
          for (const gap of layout.headingGaps)
            assert.ok(
              Math.abs(gap - 8) < 2,
              `${state}: description gap ${gap}`
            );
          assert.ok(
            layout.gap === null ||
              Math.abs(layout.gap - (layout.home ? 4 : 24)) < 2,
            `${state}: gap ${layout.gap}`
          );
          const extra = inspect ? await inspect(target) : {};
          const file = `${state}-${theme}-${width}.png`;
          await target.screenshot({
            path: path.join(output, file),
            fullPage: true,
          });
          layouts.push({ state, width, ...layout, ...extra, file });
        }
      console.log(
        `PASS: portal layout ${state} at three widths in both themes`
      );
    }
    if (!workflowOnly) {
      await go('/my/apps');
      await text('No application drafts yet');
      await capture('empty');
      await go('/apps/register');
      await text('Application details');
      await page.focus('#application-draft-name');
      await page.keyboard.press('Tab');
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        'application-draft-slug'
      );
      await fill('#application-draft-name', 'Browser Draft');
      await fill('#application-draft-slug', 'browser-draft');
      await fill('#application-draft-website', 'https://example.test');
      await fill(
        '#application-draft-description',
        'A durable browser application draft with enough detail.'
      );
      await capture('create');
      loseReceipt = true;
      await click('Save draft');
      await text('Retry unconfirmed change');
      const key = commands.at(-1).key;
      await capture('uncertain');
      await click('Retry unconfirmed change');
      await page.waitForFunction(() =>
        new URLSearchParams(location.search).has('draftId')
      );
      await text('Edit application draft');
      assert.equal(commands.at(-1).key, key);
      const draftUrl = new URL(page.url());
      const route = draftUrl.pathname + draftUrl.search;
      const id = draftUrl.searchParams.get('draftId');
      const rows = await source.query(
        'SELECT id, revision FROM application_drafts WHERE ownerIdentityId = ?',
        [principals['draft-alice']]
      );
      assert.equal(rows.length, 1);
      assert.equal(Number(rows[0].revision), 1);
      await go(route, second);
      await text('Edit application draft', second);
      assert.equal(
        await second.$eval(
          '#application-draft-name',
          (element) => element.value
        ),
        'Browser Draft'
      );
      await go(route, bob);
      await text('not found', bob);
      assert.equal(await bob.$('#application-draft-name'), null);
      await capture('wrong-account', bob);

      await fill('#application-draft-name', 'Browser Draft Updated');
      await click('Save draft');
      await text('Application draft saved to your account.');
      await page.waitForFunction(
        () =>
          document.querySelector('#application-draft-name')?.value ===
          'Browser Draft Updated'
      );
      // A second same-route save must use the reread revision, not the original revision.
      await fill('#application-draft-name', 'Browser Draft Final');
      await click('Save draft');
      await text('Application draft saved to your account.');
      await page.waitForFunction(
        () =>
          document.querySelector('#application-draft-name')?.value ===
          'Browser Draft Final'
      );
      await capture('edited');
      await fill('#application-draft-name', 'Stale session edit', second);
      await click('Save draft', second);
      await text('This draft changed', second);
      await capture('conflict', second);
      await click('Reload application drafts', second);
      await second.waitForFunction(
        () =>
          document.querySelector('#application-draft-name')?.value ===
          'Browser Draft Final'
      );
      assert.equal(
        Number(
          (
            await source.query(
              'SELECT revision FROM application_drafts WHERE id = ?',
              [id]
            )
          )[0].revision
        ),
        3
      );
      await restart();
      await go(route, second);
      await text('Edit application draft', second);
      assert.equal(
        await second.$eval(
          '#application-draft-name',
          (element) => element.value
        ),
        'Browser Draft Final'
      );
      await go('/my/apps');
      await text('Browser Draft Final');
      await capture('list');
      offline = true;
      await go('/my/apps');
      await text('could not be loaded');
      await capture('unavailable');
      offline = false;
      await click('Reload application drafts');
      await text('Browser Draft Final');
      await click('Delete draft');
      await text('Delete Browser Draft Final?');
      await capture('delete-confirmation');
      await click('Confirm deletion');
      await text('No application drafts yet');
      await text('Application draft deleted.');
      await capture('deleted');
      await go(route, second);
      await text('not found', second);
      assert.equal(await second.$('#application-draft-name'), null);
      await go('/apps/register');
      await fill('#application-draft-name', 'Unsaved private data');
      await page.evaluate(() => {
        localStorage.setItem('_i', 'draft-bob');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: '_i',
            newValue: 'draft-bob',
            storageArea: localStorage,
          })
        );
      });
      await page.waitForFunction(
        () => document.querySelector('#application-draft-name')?.value === ''
      );
      assert.equal(
        (
          await source.query(
            'SELECT id FROM application_drafts WHERE ownerIdentityId = ?',
            [principals['draft-bob']]
          )
        ).length,
        0
      );
    }
    const extraWorkflow =
      commentWorkflow ??
      articleWorkflow ??
      releaseWorkflow ??
      mediaWorkflow ??
      ownershipWorkflow ??
      publicationWorkflow;
    const workflowChecks = extraWorkflow
      ? await extraWorkflow({
          origin,
          session,
          go,
          text,
          click,
          fill,
          capture,
          commands,
          holdNextRead: (route) => {
            let entered, release;
            const started = new Promise((resolve) => {
              entered = resolve;
            });
            const pending = new Promise((resolve) => {
              release = resolve;
            });
            readBarrier = async (path) => {
              if (path !== route) return;
              readBarrier = undefined;
              entered();
              await pending;
            };
            return { started, release };
          },
          loseResponse: (predicate) => {
            loseReceipt = predicate ?? true;
          },
          setOffline: (value) => {
            offline = value;
          },
        })
      : [];
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, 'browser.json'),
      JSON.stringify(
        {
          layouts,
          commands,
          checks: [
            ...(workflowOnly
              ? []
              : [
                  'create/list/reopen/edit/delete',
                  'lost committed response and identical retry',
                  'independent browser persistence',
                  'wrong-account denial',
                  'same-route canonical revision reload',
                  'stale edit conflict',
                  'API restart',
                  'truthful outage and recovery',
                  'account-switch isolation',
                  'browser-local drafts not imported',
                  'keyboard form navigation',
                ]),
            ...workflowChecks,
          ],
          limitations: [
            'Shell account/profile/preferences use fixtures',
            'Ingress tokens map to trusted headers locally',
            ...(commentWorkflow
              ? [
                  'Production identity/ingress, database restore/rollback, load and soak remain unqualified',
                ]
              : articleWorkflow
              ? [
                  'Production identity/ingress, restore/rollback, load and soak remain unqualified; comment qualification is recorded separately',
                ]
              : releaseWorkflow
              ? [
                  'Public DNS, production identity/ingress, gateway, database restart/restore/rollback, load and soak remain unqualified',
                ]
              : mediaWorkflow
              ? [
                  'Public DNS and deployed identity/ingress are unqualified; ownership grants in media checks use SQL fixtures',
                ]
              : ownershipWorkflow
              ? ['Media and deployed public DNS remain separate workflows']
              : publicationWorkflow
              ? ['Ownership verification and media remain separate workflows']
              : [
                  'Submission, publication and ownership verification remain separate workflows',
                ]),
          ],
        },
        null,
        2
      )
    );
    console.log(
      `PASS: application draft browser workflow and ${layouts.length} layout states`
    );
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}
module.exports = { applicationDraftBrowser };
