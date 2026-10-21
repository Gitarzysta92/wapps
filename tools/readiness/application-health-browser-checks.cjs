const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function healthBrowserChecks({
  session, go, text, capture, setOffline, click, holdNextRead,
  output, stop, restart, restartBff,
}) {
  const one = await session(''), two = await session('');
  const route = '/apps/observed-application/health';
  const host = 'application-health-api-page';
  const body = target => target.$eval(host, element => element.textContent);
  const cards = target => target.$$eval(`${host} .health-monitor`, nodes => nodes.map(node => node.getAttribute('data-monitor')));
  const expand = async target => {
    for (const summary of await target.$$(`${host} summary.service-info`)) {
      assert.equal(await summary.evaluate(node => node.parentElement.open), false);
      await summary.focus();
      await target.keyboard.press('Enter');
      assert.equal(await summary.evaluate(node => node.parentElement.open), true);
    }
  };
  await go(route, one);
  await text('Notices unavailable', one);
  assert.equal(await one.$$eval(`${host} health-check-badge`, nodes => nodes.length), 1);
  assert.equal(await one.$$eval(`${host} health-status-banner`, nodes => nodes.length), 1);
  assert.equal(await one.$$eval('[aria-labelledby="health-history-title"] .status-dot', nodes => nodes.length), 30);
  assert.equal((await cards(one)).length, 4);
  assert.equal(await one.$eval(`${host} ui-breadcrumbs`, node => node.textContent.includes('Observed application')), true);
  assert(!(await body(one)).match(/99\.9|All Systems Operational|Database|Storage service|No recent notices/));
  assert((await body(one)).includes('0% sampled availability'));
  assert((await body(one)).includes('Unknown sampled availability'));

  await capture('health-original-view', one, async target => {
    const { width } = target.viewport();
    const theme = await target.evaluate(() => document.body.getAttribute('tuiTheme'));
    const settled = [];
    for (const [name, selector] of [['history', '.health-summary'], ['services', '[aria-labelledby="health-services-title"]'], ['notices', '[aria-labelledby="health-notices-title"]']]) {
      await target.$eval(`${host} ${selector}`, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await new Promise(resolve => setTimeout(resolve, 300));
      const file = `health-${name}-${theme}-${width}.png`;
      await target.screenshot({ path: path.join(output, file) });
      settled.push(file);
    }
    const unknown = await target.$eval(`${host} .status-dot.unknown`, node => ({
      color: getComputedStyle(node).backgroundColor,
      label: node.getAttribute('aria-label'), tabIndex: node.tabIndex,
    }));
    assert.equal(unknown.tabIndex, 0);
    assert(unknown.label.includes('UTC: Unknown'));
    assert.notEqual(unknown.color, 'rgba(0, 0, 0, 0)');
    const appearance = await target.$eval(host, node => {
      const badge = getComputedStyle(node.querySelector('health-check-badge'));
      const metrics = node.querySelector('summary.service-info');
      const probe = document.createElement('span');
      probe.style.color = 'var(--tui-text-action)';
      probe.style.display = 'none';
      metrics.append(probe);
      const actionColor = getComputedStyle(probe).color;
      probe.remove();
      return { badgeBackground: badge.backgroundColor, badgeColor: badge.color, metricColor: getComputedStyle(metrics).color, actionColor };
    });
    assert.notEqual(appearance.badgeBackground, 'rgba(0, 0, 0, 0)', 'The status badge needs its theme background');
    assert.equal(appearance.metricColor, appearance.actionColor, 'Metric links use the current theme action color');
    await target.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    return { settled, unknown, appearance };
  });
  await expand(one);
  await text('No recent result is available', one);
  await text('The endpoint redirected the request', one);
  await text('HTTP 503', one);
  await text('No observation has been recorded', one);
  await capture('health-expanded-evidence', one);
  await go(route, two);
  await text('Notices unavailable', two);
  assert.deepEqual(await cards(two), await cards(one));
  await expand(two);
  await text('HTTP 503', two);

  const pending = holdNextRead('/api/catalog/application-health/observed-application');
  await click('Refresh checks', one);
  try {
    await pending.started;
    await text('Loading HTTP observations', one);
    assert.deepEqual(await cards(one), []);
    assert.equal(await one.$(`${host} health-check-badge`), null);
  } finally { pending.release(); }
  await text('Notices unavailable', one);
  setOffline(value => value.startsWith('/api/catalog/application-health/'));
  await click('Refresh checks', one);
  await text('Observations unavailable', one);
  assert.deepEqual(await cards(one), []);
  setOffline(false);
  await click('Retry checks', one);
  await text('Notices unavailable', one);

  await stop();
  await click('Refresh checks', two);
  await text('Observations unavailable', two);
  assert.deepEqual(await cards(two), []);
  await restart();
  await restartBff();
  await click('Retry checks', two);
  await text('Notices unavailable', two);
  assert.deepEqual(await cards(two), await cards(one));

  await go('/apps/unmonitored-application/health', one);
  await text('Health unknown', one);
  assert.deepEqual(await cards(one), []);
  assert.equal(await one.$(`${host} status-history`), null);
  await one.goBack({ waitUntil: 'networkidle0' });
  await text('Notices unavailable', one);
  assert.equal((await cards(one)).length, 4);
  await go('/apps/missing-app/health', one);
  await text('Application not found', one);
  assert.deepEqual(await cards(one), []);

  const member = await session('draft-bob');
  await go('/apps/restricted-health-application/health', member);
  await text('Health unknown', member);
  const preferences = holdNextRead('/api/me/preferences');
  await member.evaluate(() => {
    localStorage.setItem('_i', 'draft-alice');
    window.dispatchEvent(new StorageEvent('storage', { key: '_i', newValue: 'draft-alice', storageArea: localStorage }));
  });
  try {
    await preferences.started;
    await text('Loading content preferences', member);
    assert.equal(await member.$(`${host} health-check-badge`), null);
  } finally { preferences.release(); }
  await text('This application is hidden by your content preferences', member);
  assert.equal(await member.$(`${host} health-check-badge`), null);

  return [
    'Original header badge, status banner, thirty-day history, service cards and explicit unavailable notices through compiled portal -> BFF -> Editorial',
    'Independent sessions retain persisted HTTP observations, real zero and unknown availability, UTC coverage and stale/failure/redirect reasons',
    'Keyboard metric disclosure, loading invalidation, service outage/restart, retry, navigation/Back, empty and missing applications',
    'Account preference loading removes evidence and the hidden parent cannot reload health',
    'Collapsed and expanded views at 390/768/1440 in both themes, with settled section captures',
  ];
};
