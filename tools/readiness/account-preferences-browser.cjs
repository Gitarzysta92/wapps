/* Runs against the compiled API portal and canonical SQL; only ingress/failure injection is substituted. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function accountPreferencesBrowser({
  origin,
  newSession,
  setSession,
  capture,
  identities,
  setOffline,
  discardNextReceipt,
}) {
  const page = await newSession('alice-session');
  const second = await newSession('alice-session');
  const text = (value) =>
    page.waitForFunction(
      (value) => document.body.innerText.includes(value),
      { timeout: 10000 },
      value
    );
  const clickText = (label, target = page) =>
    target.$$eval(
      'button',
      (buttons, label) => {
        const button = buttons.find((button) =>
          button.textContent.trim().includes(label)
        );
        if (!button) throw new Error(`Missing ${label} control`);
        button.click();
      },
      label
    );
  const open = async (section, target = page) => {
    await target.goto(`${origin}/me/settings/${section}`, {
      waitUntil: 'networkidle0',
    });
    await target.waitForSelector('.settings-actions');
  };
  const pressed = (label, target = page) =>
    target.$$eval(
      'button[aria-pressed]',
      (buttons, label) =>
        buttons
          .find((button) => button.textContent.trim() === label)
          ?.getAttribute('aria-pressed'),
      label
    );
  const initial = await identities.getPreferences('BrowserAlice');
  assert.equal(initial.preferences.display.theme, 'auto');
  for (const theme of ['light', 'dark']) {
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: theme },
    ]);
    for (const width of [1440, 768, 390]) {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      for (const section of ['preferences', 'notifications', 'privacy']) {
        await open(section);
        await capture(`${section}-account`, theme, width, page);
        if (section === 'preferences') await clickText('YYYY-MM-DD');
        else
          await page.click(
            section === 'notifications'
              ? 'input[aria-label="Enable Email Notifications"]'
              : 'input[aria-label="Show Email Address"]'
          );
        // A profile edit advances the same canonical account revision.
        const profile = await identities.getProfile('BrowserAlice');
        await identities.updateProfile(
          'BrowserAlice',
          {
            expectedRevision: profile.revision,
            name: profile.profile.name,
            bio: profile.profile.bio,
            location: profile.profile.location,
            socialLinks: profile.profile.socialLinks,
          },
          randomUUID()
        );
        await clickText('Save Changes');
        await text('changed in another session');
        if (section === 'preferences')
          assert.equal(await pressed('YYYY-MM-DD'), 'true');
        else
          assert.equal(
            await page.$eval(
              section === 'notifications'
                ? 'input[aria-label="Enable Email Notifications"]'
                : 'input[aria-label="Show Email Address"]',
              (input) => input.checked
            ),
            true
          );
        await capture(`${section}-conflict`, theme, width, page);
        await clickText('Discard edits');
        await page.waitForFunction(
          () =>
            !document.querySelector('.settings-feedback') &&
            !!document.querySelector('.settings-actions')
        );
        setOffline(true);
        await page.reload({ waitUntil: 'networkidle0' });
        await text('Could not load settings');
        assert.equal(await page.$('.settings-actions'), null);
        await capture(`${section}-unavailable`, theme, width, page);
        setOffline(false);
        await clickText('Retry');
        await page.waitForSelector('.settings-actions');
        await setSession(null, page);
        await text('Sign in to manage account settings');
        await capture(`${section}-guest`, theme, width, page);
      }
    }
  }
  await open('preferences');
  await open('preferences', second);
  await clickText('YYYY-MM-DD');
  await clickText('50');
  // A confirmed commit whose response is lost must retry the same command key.
  discardNextReceipt();
  await clickText('Save Changes');
  await text('Could not confirm the save');
  const committed = await identities.getPreferences('BrowserAlice');
  assert.equal(committed.preferences.display.itemsPerPage, 50);
  assert.equal(await pressed('50'), 'true');
  await page.focus('.settings-actions button:first-child');
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.matches('.settings-actions button:last-child')
    ),
    true,
    'Preferences save must be reachable by keyboard'
  );
  await page.keyboard.press('Enter');
  await text('Preferences saved to your account.');
  assert.equal(
    (await identities.getPreferences('BrowserAlice')).revision,
    committed.revision,
    'Receipt retry must not create a second mutation'
  );
  await second.reload({ waitUntil: 'networkidle0' });
  await second.waitForSelector('.settings-actions');
  assert.equal(await pressed('50', second), 'true');
  assert.equal(await pressed('YYYY-MM-DD', second), 'true');
  await setSession('bob-session', page);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button[aria-pressed]')].some(
      (button) =>
        button.textContent.trim() === '20' &&
        button.getAttribute('aria-pressed') === 'true'
    )
  );
  assert.equal(await pressed('50'), 'false');
  await setSession(null, page);
  await text('Sign in to manage account settings');
  await page.evaluate(() =>
    localStorage.setItem(
      'wapps.guest-display.v1',
      JSON.stringify({
        theme: 'dark',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'DD/MM/YYYY',
        defaultView: 'grid',
        itemsPerPage: 10,
      })
    )
  );
  await page.evaluate(() =>
    localStorage.setItem(
      'wapps.preferences.v1',
      JSON.stringify({ display: { theme: 'dark', itemsPerPage: 100 } })
    )
  );
  await setSession('alice-session', page);
  await page.waitForSelector('.settings-actions');
  assert.equal(await pressed('50'), 'true');
  assert.equal(await pressed('System'), 'true');
  await open('notifications');
  await page.click('input[aria-label="Enable Email Notifications"]');
  await clickText('Weekly Digest');
  assert.equal(
    await page.$eval(
      'input[aria-label="Enable Push Notifications"]',
      (input) => input.disabled
    ),
    true,
    'Unavailable push delivery must remain disabled'
  );
  await clickText('Save Changes');
  await text('Preferences saved to your account.');
  const notifications = (await identities.getPreferences('BrowserAlice'))
    .preferences.notifications;
  assert.equal(notifications.email.frequency, 'weekly');
  assert.equal(notifications.email.enabled, true);
  assert.equal(notifications.push.enabled, false);
  await open('notifications', second);
  assert.equal(await pressed('Weekly Digest', second), 'true');
  await open('privacy');
  await page.click('input[aria-label="Show Email Address"]');
  await clickText('Save Changes');
  await text('Preferences saved to your account.');
  await open('privacy', second);
  assert.equal(
    await second.$eval(
      'input[aria-label="Show Email Address"]',
      (input) => input.checked
    ),
    true
  );
  // The unsaved change must be absent from a fresh canonical export.
  await page.click('input[aria-label="Show Email Address"]');
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.preferencesExportText = blob.text();
      return create(blob);
    };
  });
  await clickText('Export Saved Preferences');
  await text('Saved account preferences export downloaded.');
  const exported = await page.evaluate(async () =>
    JSON.parse(await window.preferencesExportText)
  );
  assert.equal(exported.preferences.privacy.showEmail, true);
  assert.equal(exported.profile, undefined);
  assert.equal(exported.source, 'account');
  assert.ok(!JSON.stringify(exported).includes('alice-session'));
  await open('preferences');
  await clickText('Light');
  await clickText('Save Changes');
  await text('Preferences saved to your account.');
  await page.waitForFunction(
    () => document.body.getAttribute('tuiTheme') === 'light'
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem('wapps.preferences.v1')),
    '{"display":{"theme":"dark","itemsPerPage":100}}'
  );
  const expected = await identities.getPreferences('BrowserAlice');
  console.log(
    'Preferences browser: 72 layout states, shared profile revision conflicts, independent sessions, keyboard retry after lost receipt, exports and guest/account isolation pass.'
  );
  return {
    async unavailable() {
      await page.reload({ waitUntil: 'networkidle0' });
      await text('Could not load settings');
    },
    async recovered() {
      await clickText('Retry');
      await page.waitForSelector('.settings-actions');
      assert.equal(await pressed('50'), 'true');
      assert.equal(await pressed('YYYY-MM-DD'), 'true');
      assert.equal(await pressed('Light'), 'true');
      assert.deepEqual(
        await identities.getPreferences('BrowserAlice'),
        expected
      );
    },
  };
}

module.exports = { accountPreferencesBrowser };
