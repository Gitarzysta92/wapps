const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  publicProfileCollectionBrowser,
} = require('./public-profile-favorites-browser.cjs');

async function publicProfileDiscussionsBrowser(options) {
  const first = await options.read();
  const detailLayouts = [];
  async function captureDetail(page, state) {
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
        const overflow = await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.allSettled(
            document
              .getAnimations()
              .filter((animation) =>
                Number.isFinite(animation.effect?.getComputedTiming().endTime)
              )
              .map((animation) => animation.finished)
          );
          return document.documentElement.scrollWidth > innerWidth + 1;
        });
        assert.equal(overflow, false);
        detailLayouts.push({ state, theme, width, overflow });
        await page.screenshot({
          path: path.join(options.output, `${state}-${theme}-${width}.png`),
          fullPage: true,
        });
      }
  }
  await publicProfileCollectionBrowser(options, {
    kind: 'discussions',
    title: 'Shared discussions',
    controls: 'shared discussions',
    setting: 'Show Discussions',
    hidden: 'Discussions are not shared',
    changeSharing: 'Change discussion sharing',
    emptyText: 'No shared public discussions',
    firstCount: 10,
    nextCount: 2,
    restoredCount: 10,
    assertDetail: async (page) => {
      await page.waitForFunction(
        (text) =>
          document
            .querySelector('article-comments')
            ?.textContent.includes(text),
        {},
        options.linkedThreadText
      );
      assert.equal(
        new URL(page.url()).searchParams.get('thread'),
        first.items[0].id
      );
      const articlePath = new URL(page.url());
      await captureDetail(page, 'article-linked-thread');
      await page.$$eval('a', (links) =>
        links
          .find(
            (link) => link.textContent.trim() === 'View all comment threads'
          )
          .click()
      );
      await page.waitForFunction(
        () =>
          !new URL(location.href).searchParams.has('thread') &&
          document
            .querySelector('article-comments')
            ?.textContent.includes('Unrelated latest article thread')
      );
      assert.ok(
        !(
          await page.$eval('article-comments', (host) => host.textContent)
        ).includes(options.linkedThreadText)
      );
      for (const query of [
        'thread=',
        'thread=invalid',
        `thread=${first.items[0].id}&thread=${first.items[0].id}`,
      ]) {
        await page.goto(
          articlePath.origin + articlePath.pathname + '?' + query,
          { waitUntil: 'networkidle0' }
        );
        await page.waitForFunction(() =>
          document
            .querySelector('article-comments [role="alert"]')
            ?.textContent.includes('link is invalid')
        );
        assert.ok(
          !(
            await page.$eval('article-comments', (host) => host.textContent)
          ).includes(options.linkedThreadText)
        );
      }
      await captureDetail(page, 'article-invalid-thread');
      const application = first.items.find(
        (item) => item.parentKind === 'application'
      );
      await page.goto(
        `${articlePath.origin}${articlePath.pathname}?thread=${application.id}`,
        { waitUntil: 'networkidle0' }
      );
      await page.waitForFunction(() =>
        document
          .querySelector('article-comments [role="alert"]')
          ?.textContent.includes('no longer available')
      );
      await captureDetail(page, 'article-wrong-parent-thread');
      await page.goto(
        `${articlePath.origin}/apps/${application.parentSlug}/discussions/${application.id}`,
        { waitUntil: 'networkidle0' }
      );
      await page.waitForFunction(
        (title) =>
          [...document.querySelectorAll('h1')].some(
            (heading) => heading.textContent.trim() === title
          ),
        {},
        application.title
      );
    },
    assertOwnerDetail: async (page, origin) => {
      await page.goto(
        `${origin}/articles/${first.items[0].parentSlug}?thread=${first.items[0].id}`,
        { waitUntil: 'networkidle0' }
      );
      await page.waitForFunction(() =>
        document
          .querySelector('article-comments')
          ?.textContent.includes('Choose Reply')
      );
      assert.equal(await page.$('article-comments form'), null);
      await page.$$eval('article-comments button', (buttons) =>
        buttons.find((button) => button.textContent.trim() === 'Reply').click()
      );
      await page.waitForSelector('#article-comment-text');
      await page.type('#article-comment-name', 'Profile member');
      await page.type(
        '#article-comment-text',
        'Reply from the linked profile thread'
      );
      await page.$$eval('article-comments button', (buttons) =>
        buttons
          .find((button) => button.textContent.trim() === 'Post reply')
          .click()
      );
      await page.waitForFunction(() =>
        document
          .querySelector('article-comments [role="status"]')
          ?.textContent.includes('saved')
      );
      await options.waitLinkedReply();
      await page.$$eval('article-comments button', (buttons) =>
        buttons
          .find((button) => button.textContent.trim() === 'Reload thread')
          .click()
      );
      await page.waitForFunction(() =>
        [...document.querySelectorAll('article-comments .comment-text')].some(
          (comment) =>
            comment.textContent.includes('Reply from the linked profile thread')
        )
      );
      assert.equal(
        new URL(page.url()).searchParams.get('thread'),
        first.items[0].id
      );
      await captureDetail(page, 'article-linked-reply');
    },
    assertFirst: (links) =>
      assert.deepEqual(
        links.map((link) => link.href),
        first.items.map((item) =>
          item.parentKind === 'article'
            ? `/articles/${item.parentSlug}?thread=${item.id}`
            : `/apps/${item.parentSlug}/discussions/${item.id}`
        )
      ),
    empty: options.empty,
    restore: options.restore,
    assertEmpty: async (page) => {
      await page.$$eval('public-profile-page button', (buttons) => {
        const next = buttons.find(
          (button) => button.textContent.trim() === 'Next shared discussions'
        );
        if (!next) throw new Error('Empty scanned page lost its continuation');
        next.click();
      });
      await page.waitForFunction(
        () =>
          document.querySelector('.shared-discussions') &&
          ![...document.querySelectorAll('public-profile-page button')].some(
            (button) => button.textContent.trim() === 'Next shared discussions'
          )
      );
      assert.equal(
        await page.$$eval('.shared-discussions a', (links) => links.length),
        0
      );
    },
  });
  fs.writeFileSync(
    path.join(options.output, 'thread-links.json'),
    JSON.stringify({ detailLayouts }, null, 2)
  );
  options.pass(
    `public profile discussion links: ${detailLayouts.length} article layouts; direct thread beyond first page, return to all threads, invalid/duplicate/empty/wrong-parent links and application-topic navigation`
  );
}
module.exports = { publicProfileDiscussionsBrowser };
