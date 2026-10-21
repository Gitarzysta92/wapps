const assert = require('node:assert/strict');

module.exports = async function applicationSubpagesBrowserChecks({
  classified,
  session,
  go,
  text,
  capture,
  click,
  setOffline,
}) {
  const variants = classified.find((spec) => spec.kind === 'app').variants;
  const [general, mature, legacy] = variants;
  const restricted = await session('draft-alice');
  const unrestricted = await session('draft-bob');
  const guest = await session('');
  const routes = [
    ['discussions', 'app-application-discussions-api-page'],
    ['reviews', 'app-application-reviews-api-page'],
    ['devlog', 'app-release-devlog'],
    ['health', 'application-health-api-page'],
    ['timeline', 'application-timeline-api-page'],
  ];
  const childRequests = new Map();
  for (const page of [restricted, unrestricted, guest]) {
    const requests = [];
    childRequests.set(page, requests);
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (
        /\/api\/(application-(discussions|reviews)\/|catalog\/(application-health|releases)\/|applications\/[^/]+\/timeline)/.test(
          path
        )
      )
        requests.push(path);
    });
  }
  const changeAccount = (page, token) =>
    page.evaluate((token) => {
      localStorage.setItem('_i', token);
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: '_i',
          newValue: token,
          storageArea: localStorage,
        })
      );
    }, token);
  async function hidden(page, host, item) {
    await text('Application hidden', page);
    assert.equal(
      await page.$(
        `${host} application-discussions, ${host} member-reviews, ${host} .application-draft-card, ${host} .changelog-card, ${host} .release-details, ${host} .health-monitor, ${host} activity-feed-card`
      ),
      null
    );
    assert(
      !(await page.$eval(host, (element) => element.textContent)).includes(
        item.name
      )
    );
    assert(
      !(
        await page.$eval(
          'application-common-sidebar',
          (element) => element.textContent
        )
      ).includes(item.name)
    );
  }
  for (const [section, host] of routes) {
    for (const page of [restricted, guest]) {
      for (const item of [mature, legacy]) {
        const before = childRequests.get(page).length;
        await go(`/apps/${item.slug}/${section}`, page);
        await hidden(page, host, item);
        assert.equal(
          childRequests.get(page).length,
          before,
          'Hidden applications must not load child content'
        );
      }
    }
    await capture(`subpage-${section}-hidden`, restricted);
    await go(`/apps/${general.slug}/${section}`, restricted);
    await text(general.name, restricted);
    await go(`/apps/${mature.slug}/${section}`, unrestricted);
    await text(mature.name, unrestricted);
    await changeAccount(unrestricted, 'draft-alice');
    await hidden(unrestricted, host, mature);
    await changeAccount(unrestricted, 'draft-bob');
    await text(mature.name, unrestricted);
    setOffline((path) => path === '/api/me/preferences');
    await changeAccount(unrestricted, 'draft-alice');
    await text('Content preferences unavailable', unrestricted);
    assert(
      !(
        await unrestricted.$eval(host, (element) => element.textContent)
      ).includes(mature.name)
    );
    if (section === 'health')
      await capture('subpage-preferences-unavailable', unrestricted);
    setOffline(false);
    await click('Retry content preferences', unrestricted);
    await hidden(unrestricted, host, mature);
    await changeAccount(unrestricted, 'draft-bob');
  }
  return [
    'Five application subpages hide Mature and unclassified parents for restricted members and guests before requesting child content',
    'Application subpage headers, sidebars and child views clear on account/preference failure; retry restores the current choice',
    'Approved General and explicitly enabled Mature parent reads work through real Editorial/BFF; child services outside this harness remain explicitly unavailable',
  ];
};
