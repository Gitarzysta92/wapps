const assert = require('node:assert/strict');
const {
  publicProfileCollectionBrowser,
} = require('./public-profile-favorites-browser.cjs');

async function publicProfileSuitesBrowser(options) {
  const first = await options.read();
  return publicProfileCollectionBrowser(options, {
    kind: 'suites',
    title: 'Published suites',
    controls: 'published suites',
    setting: 'Show Suites',
    hidden: 'Suites are not shared',
    changeSharing: 'Change suite sharing',
    emptyText: 'No shared published suites',
    nextCount: 1,
    restoredCount: 1,
    assertDetail: (page) =>
      page.waitForFunction(
        (title) =>
          [...document.querySelectorAll('h1')].some(
            (heading) => heading.textContent.trim() === title
          ),
        {},
        first.items[0].title
      ),
    assertFirst: (links) =>
      assert.deepEqual(
        links.map((link) => link.href),
        first.items.map((item) => `/suites/${item.id}`)
      ),
    empty: options.empty,
    restore: options.restore,
  });
}
module.exports = { publicProfileSuitesBrowser };
