const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');

module.exports = async function richActivityCard(page, kind, directory) {
  const selectors = {
    application:
      '.application-avatar app-avatar, .application-title, app-reviews-chip',
    article: 'article-details-badge, .article-summary ui-excerpt',
    suite: '.suite-description, .suite-meta, .apps-grid',
    release:
      '.changelog-version, .changelog-info, .changelog-details app-changelog-details',
    review:
      'review-author-badge, review-quote-short, review-quote-short app-rating',
    discussion:
      'ui-discussion-thread, ui-discussion-post-header, ui-discussion-expandable-post-content',
  };
  const selector = `explore-feed article[data-kind="${kind}"]`;
  await page.waitForSelector(selector);
  if (kind === 'article') {
    try {
      await page.waitForFunction(() => {
        const img = document.querySelector('explore-feed article[data-kind="article"] article-cover-image img');
        return img && img.complete && img.naturalWidth > 0;
      });
    } catch (error) {
      fs.writeFileSync(path.join(directory, 'article-cover-failure.html'), await page.$eval(selector, card => card.outerHTML));
      throw error;
    }
  }
  const layouts = [];
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
      });
      // Allow the existing shell/canvas resize transitions to settle before measuring.
      await delay(500);
      const result = await page.$eval(
        selector,
        (card, expected) => {
          const bounds = card.getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            width: bounds.width,
            richSections: expected
              .split(', ')
              .map((selector) => !!card.querySelector(selector)),
            previewUnavailable: card.textContent.includes(
              'Preview details are unavailable'
            ),
            demoAvatar: [...card.querySelectorAll('img')].some((image) =>
              image.src.includes('picsum.photos')
            ),
            actions: !!card.querySelector('.card-actions a'),
          };
        },
        selectors[kind]
      );
      if (result.overflow) {
        const overflow = await page.evaluate(() =>
          [...document.querySelectorAll('body *')].flatMap(element => {
            const rect = element.getBoundingClientRect();
            return rect.width && rect.right > innerWidth + 1
              ? [{ tag: element.tagName, class: element.className, left: rect.left, right: rect.right, width: rect.width }]
              : [];
          })
        );
        fs.writeFileSync(path.join(directory, `rich-${kind}-${theme}-${width}-overflow.json`), JSON.stringify(overflow, null, 2));
      }
      assert.equal(
        result.overflow,
        false,
        `${kind}/${theme}/${width}: overflow`
      );
      assert.ok(result.width > 200);
      assert.ok(
        result.richSections.every(Boolean),
        `${kind}: missing original card sections`
      );
      assert.equal(result.previewUnavailable, false);
      assert.equal(result.demoAvatar, false);
      assert.ok(result.actions);
      const card = await page.$(selector);
      const file = `rich-${kind}-${theme}-${width}.png`;
      await card.evaluate(element => element.scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: path.join(directory, file), fullPage: true });
      layouts.push({ kind, theme, viewport: width, ...result, file });
    }
  fs.writeFileSync(
    path.join(directory, `rich-${kind}-layouts.json`),
    JSON.stringify(layouts, null, 2)
  );
  return layouts;
};
