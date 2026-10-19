const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

module.exports = async function applicationOverviewChecks({
  session, go, text, capture, setOffline, click, holdNextRead,
  applications, bffOrigin, headers, community, restartBff, classified, output, anonymousHeaders,
}) {
  async function api(route, body) {
    const response = await fetch(bffOrigin() + route, {
      method: body ? 'POST' : 'GET',
      headers: body ? { ...headers('OverviewAuthor'), 'idempotency-key': randomUUID() } : anonymousHeaders,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    const value = await response.json();
    assert.equal(response.status, body ? 201 : 200, JSON.stringify(value));
    return value;
  }
  const app = await api('/api/catalog/apps/team-application-0');
  assert.equal(app.id, applications[0].id);
  const base = `/api/application-discussions/${app.id}`;
  for (let index = 1; index <= 3; index++) {
    const receipt = await api(base, {
      title: `Overview conversation ${index}`, displayName: 'Overview author',
      text: `Published opening post ${index} about the application.`, tags: ['workflows'],
    });
    await api(`${base}/${receipt.id}/replies`, { displayName: 'Overview reader', text: 'A persisted reply.' });
    await community.project(receipt.discussionId);
  }
  const expected = await api(base);
  assert.equal(expected.items.length, 3);
  assert(expected.items.every(thread => thread.replyCount === 1));
  await restartBff();
  assert.deepEqual(await api(base), expected, 'Discussion previews survive Community/BFF restart');

  const page = await session('');
  const independent = await session('');
  const route = `/apps/${app.slug}/overview`;
  const host = 'app-application-overview-page';
  const body = () => page.$eval(host, element => element.textContent);
  const cards = target => target.$$eval(`${host} discussion-small-card`, nodes => nodes.map(node => node.textContent));
  await go(route, page);
  await text('Overview author', page);
  await text('4.0/5', page);
  assert.equal((await cards(page)).length, 2);
  const links = await page.$$eval(`${host} .preview-link`, nodes => nodes.map(node => node.getAttribute('href')));
  assert.deepEqual(links, expected.items.slice(0, 2).map(thread => `/apps/${app.slug}/discussions/${thread.id}`));
  assert.equal(await page.$eval(`${host} application-review-summary a`, node => node.getAttribute('href')), `/apps/${app.slug}/reviews`);
  assert.equal(await page.$$eval(`${host} .shortcut-card`, nodes => nodes.length), 4);
  assert((await body()).includes('Included suites unavailable'));
  assert((await body()).includes('Views unavailable'));
  assert(!(await body()).includes('0 views'));
  assert.equal(await page.$(`${host} .cover-image img`), null, 'A missing banner must not become a logo cover');
  await go(route, independent);
  await text('Overview author', independent);
  assert.deepEqual(await cards(independent), await cards(page));

  await capture('application-overview', page, async target => {
    const { width } = target.viewport();
    const theme = await target.evaluate(() => document.body.getAttribute('tuiTheme'));
    const settled = [];
    for (const [name, selector] of [['hero', '.hero-section'], ['discussions', '[aria-labelledby="overview-discussions-title"]'], ['suites', '[aria-labelledby="overview-suites-title"]']]) {
      await target.$eval(`${host} ${selector}`, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await new Promise(resolve => setTimeout(resolve, 300));
      const file = `overview-${name}-${theme}-${width}.png`;
      await target.screenshot({ path: path.join(output, file) });
      settled.push(file);
    }
    await target.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    return { settled };
  });

  setOffline(route => route === base || route === `/api/application-reviews/${app.id}/summary`);
  await go(route, page);
  await text('Discussion previews unavailable', page);
  await text('Member ratings unavailable', page);
  assert.equal((await cards(page)).length, 0);
  assert(!(await body()).includes('No discussions yet'));
  setOffline(false);
  await click('Retry discussions', page);
  await click('Reload ratings', page);
  await text('Overview author', page);
  await text('4.0/5', page);

  await community.pause();
  await go(route, independent);
  await text('Discussion previews unavailable', independent);
  await text('Member ratings unavailable', independent);
  await restartBff();
  await click('Retry discussions', independent);
  await click('Reload ratings', independent);
  await text('Overview author', independent);
  await text('4.0/5', independent);

  const next = await api('/api/catalog/apps/team-application-1');
  assert.equal(next.id, applications[1].id);
  await go(`/apps/${next.slug}/overview`, page);
  await text('No discussions yet', page);
  await text('No reviews yet', page);
  assert(!(await body()).includes('Overview author'));
  assert(!(await body()).includes('0.0/5'));
  await page.goBack({ waitUntil: 'networkidle0' });
  await text('Overview author', page);

  setOffline(route => route === `/api/catalog/apps/${app.slug}`);
  await go(route, page);
  await text('Unable to load application', page);
  assert.equal(await page.$(`${host} .hero-section`), null);
  setOffline(false);
  await click('Retry', page);
  await text('Overview author', page);
  await go('/apps/missing-overview-application/overview', page);
  await text('Application not found', page);

  const mature = classified.find(spec => spec.kind === 'app').variants[1];
  const member = await session('draft-bob');
  await go(`/apps/${mature.slug}/overview`, member);
  await text(mature.name, member);
  const barrier = holdNextRead('/api/me/preferences');
  await member.evaluate(() => {
    localStorage.setItem('_i', 'draft-alice');
    window.dispatchEvent(new StorageEvent('storage', { key: '_i', newValue: 'draft-alice', storageArea: localStorage }));
  });
  try {
    await barrier.started;
    await text('Loading content preferences', member);
    assert.equal(await member.$(`${host} .hero-section`), null);
  } finally { barrier.release(); }
  await text('Application hidden by your content preferences', member);
  assert.equal(await member.$(`${host} discussion-small-card`), null);

  return [
    'Original overview sections, rating chip and two discussion cards through compiled portal -> BFF -> Editorial/Community',
    'Canonical IDs and links, real root attribution/reply totals, distinct empty and unavailable metrics',
    'Persisted reviews and discussions survive Community/BFF restart and match independent browsers',
    'Dependency outage, explicit retry, empty and missing records, navigation/Back and account-preference invalidation',
    'Six light/dark mobile/tablet/desktop layouts and 18 settled section captures',
  ];
};
