const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const sharp = require('sharp');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');

async function articleCoverBrowser(options) {
  const { root, output, source, reader, projections, headers } = options;
  const fields = {
    title: 'A reviewed article with a cover',
    slug: 'browser-cover-' + randomUUID(),
    excerpt: 'The submitted image stays frozen while private changes continue.',
    byline: 'A public author',
    category: 'Guides',
    tags: ['privacy'],
    sections: [
      {
        heading: 'Introduction',
        paragraphs: ['Reviewed text and an independently approved image.'],
      },
    ],
  };
  async function json(method, route, body) {
    const response = await fetch(options.origin() + '/api/' + route, {
      method,
      headers: {
        ...headers('DraftBrowserAlice'),
        'idempotency-key': randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    assert.ok(response.ok, JSON.stringify(result));
    return result;
  }
  const draft = await json('POST', 'me/articles', fields);
  const firstFile = path.join(output, 'cover-green.png'),
    secondFile = path.join(output, 'cover-blue.png');
  for (const [file, width, height, background] of [
    [firstFile, 320, 180, 'green'],
    [secondFile, 120, 60, 'blue'],
  ])
    await sharp({ create: { width, height, channels: 3, background } })
      .png()
      .toFile(file);
  // All mutations below are made through the compiled portal; this helper only delivers committed materialization.
  const materialize = async () =>
    projections.publish(
      projectEditorialSnapshot(await reader.read('article', draft.id))
    );
  await require('./application-draft-browser.cjs').applicationDraftBrowser({
    ...options,
    workflowOnly: true,
    articleWorkflow: async ({
      session,
      go,
      text,
      click,
      fill,
      capture,
      commands,
      loseResponse,
      setOffline,
    }) => {
      const author = await session('draft-alice'),
        independent = await session('draft-alice'),
        reviewer = await session('draft-reviewer');
      const stranger = await session('draft-bob'),
        publicReader = await session('');
      const route = '/my/articles/' + draft.id;
      const idle = (page) =>
        page.waitForFunction(
          () =>
            document
              .querySelector('app-article-workspace .application-workspace')
              ?.getAttribute('aria-busy') === 'false'
        );
      const readyUploads = (page) => text('Upload confirmed.', page);
      const image = async (page, selector, width, alt) => {
        await page.waitForFunction(
          (selector, width, alt) => {
            const element = document.querySelector(selector);
            return (
              element?.complete &&
              element.naturalWidth === width &&
              (!alt || element.alt === alt)
            );
          },
          {},
          selector,
          width,
          alt
        );
      };
      const choose = async (page, file, selector = '#article-cover-file') => {
        await page.waitForSelector(selector);
        await page.waitForFunction(
          (selector) => !document.querySelector(selector)?.disabled,
          {},
          selector
        );
        await (await page.$(selector)).uploadFile(file);
      };
      await go(route, author);
      await text('No retained cover uploads', author);
      await capture('cover-empty-workspace', author);
      await choose(author, firstFile);
      await readyUploads(author);
      await click('Use this cover', author);
      await fill(
        '#article-cover-alt',
        'The approved green article cover',
        author
      );
      await click('Save article and cover', author);
      await text('Article draft saved to your account.', author);
      await idle(author);
      await image(
        author,
        '[aria-label="Selected article cover"] img',
        320,
        'The approved green article cover'
      );
      await capture('cover-saved-draft', author);
      const first = (await json('GET', 'me/articles/' + draft.id)).cover;
      assert.equal(first.alt, 'The approved green article cover');
      await go(route, independent);
      await text('The description is public', independent);
      await image(
        independent,
        '[aria-label="Selected article cover"] img',
        320,
        first.alt
      );
      await click('Submit saved article', author);
      await idle(author);
      await text('submitted', author);
      await capture('cover-frozen-submission', author);

      const prior = commands.length;
      loseResponse(
        (url, method) =>
          url.startsWith('/api/me/article-covers/') &&
          url.endsWith('/content') &&
          method === 'PUT'
      );
      await choose(author, secondFile);
      await text('The image change could not be confirmed.', author);
      await capture('cover-unconfirmed-upload', author);
      const original = commands
        .slice(prior)
        .find(
          (command) =>
            command.method === 'PUT' && command.route.endsWith('/content')
        );
      assert.ok(original);
      await author.reload({ waitUntil: 'networkidle0' });
      await text('Resolve the last cover request', author);
      await choose(author, firstFile, '#article-cover-retry');
      await text('Select the exact original file', author);
      assert.equal(
        commands.filter((command) => command.key === original.key).length,
        1
      );
      await choose(author, secondFile, '#article-cover-retry');
      await readyUploads(author);
      const retried = commands.filter(
        (command) => command.key === original.key
      );
      assert.equal(retried.length, 2);
      assert.ok(
        retried.every(
          (command) =>
            command.route === original.route && command.status === 200
        )
      );
      await click('Use this cover', author);
      await fill(
        '#article-cover-alt',
        'A blue cover awaiting later review',
        author
      );
      await click('Save article and cover', author);
      await idle(author);
      await image(
        author,
        '[aria-label="Selected article cover"] img',
        120,
        'A blue cover awaiting later review'
      );
      await image(
        author,
        '[aria-label="Submitted article"] img',
        320,
        first.alt
      );
      await capture('cover-private-replacement-frozen-review', author);

      await fill(
        '#article-cover-alt',
        'Unsaved competing description',
        independent
      );
      await click('Save article and cover', independent);
      await text('The article changed', independent);
      assert.equal(
        await independent.$eval('#article-cover-alt', (input) => input.value),
        'Unsaved competing description'
      );
      await capture('cover-draft-conflict', independent);
      await click('Reload saved article', independent);
      await click('Confirm reload', independent);
      await idle(independent);
      await image(
        independent,
        '[aria-label="Selected article cover"] img',
        120,
        'A blue cover awaiting later review'
      );

      await go('/editorial/articles/' + draft.id, reviewer);
      await text('Review article', reviewer);
      await image(
        reviewer,
        '[aria-label="Submitted article"] img',
        320,
        first.alt
      );
      await capture('cover-independent-review', reviewer);
      await reviewer.evaluate(() =>
        [...document.querySelectorAll('button')]
          .find(
            (button) =>
              button.textContent.trim() === 'Approve submitted article'
          )
          .focus()
      );
      await reviewer.keyboard.press('Enter');
      await idle(reviewer);
      await text('approved', reviewer);
      await materialize();
      await go('/articles/' + fields.slug, publicReader);
      await text(fields.title, publicReader);
      await image(
        publicReader,
        'app-article-catalog article-cover-image img',
        320,
        first.alt
      );
      await capture('cover-anonymous-public-detail', publicReader);
      await go('/articles', publicReader);
      await text(fields.title, publicReader);
      await image(
        publicReader,
        'app-article-catalog article-cover-image img',
        320,
        first.alt
      );
      await capture('cover-public-listing', publicReader);
      await go(route, stranger);
      await text('Article not found', stranger);
      assert.equal(
        await stranger.$$eval(
          'article-cover-image img',
          (images) => images.length
        ),
        0
      );
      await capture('cover-other-account-denied', stranger);

      await options.restart();
      await go(route, author);
      await text('The description is public', author);
      await image(
        author,
        '[aria-label="Selected article cover"] img',
        120,
        'A blue cover awaiting later review'
      );
      setOffline(true);
      await click('Reload cover uploads', author);
      await text('Article covers are unavailable', author);
      await capture('cover-service-unavailable', author);
      setOffline(false);
      await click('Reload cover uploads', author);
      await text('Ready cover', author);
      await click('Withdraw article', author);
      await click('Confirm withdraw', author);
      await idle(author);
      assert.equal(
        (await projections.find('article', draft.id)).deletedAt,
        null
      );
      await go('/articles/' + fields.slug, publicReader);
      await text('Article not found', publicReader);
      assert.equal(
        await publicReader.$$eval(
          'article-cover-image img',
          (images) => images.length
        ),
        0
      );
      await capture('cover-withdrawn-public-detail', publicReader);
      loseResponse(
        (route, method) =>
          route === '/api/me/article-covers' && method === 'POST'
      );
      await choose(author, firstFile);
      await text('The image change could not be confirmed.', author);
      await author.evaluate(() => {
        localStorage.setItem('_i', 'draft-bob');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: '_i',
            newValue: 'draft-bob',
            storageArea: localStorage,
          })
        );
      });
      await text('Article not found', author);
      assert.equal(
        await author.$$eval(
          'article-cover-image img',
          (images) => images.length
        ),
        0
      );
      assert.equal(
        await author.evaluate(() =>
          sessionStorage.getItem('wapps.article-cover.intent.v1')
        ),
        null
      );
      await capture('cover-account-switch', author);
      return [
        'Saved cover upload and required alternative text',
        'Persistent exact retry after response loss and reload',
        'Wrong source refusal',
        'Independent session conflicts',
        'Frozen review despite private cover edits',
        'Keyboard approval',
        'Anonymous public cover reads',
        'Wrong-account isolation',
        'API restart persistence',
        'Truthful service outage recovery',
        'Immediate withdrawal with stale projection',
        'Session switch clears private previews',
      ];
    },
  });
  assert.ok(source);
}
module.exports = { articleCoverBrowser };
