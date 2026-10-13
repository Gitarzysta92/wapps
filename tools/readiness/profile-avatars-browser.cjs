const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { randomUUID } = require('node:crypto');

async function profileAvatarsBrowser({
  origin,
  newSession,
  setSession,
  capture,
  identities,
  output,
  discardNextReceipt,
  commands,
}) {
  const page = await newSession('alice-session');
  const second = await newSession('alice-session');
  const good = path.join(output, 'photo-source.png');
  const bad = path.join(output, 'photo-invalid.png');
  await sharp({
    create: { width: 900, height: 600, channels: 3, background: '#237e78' },
  })
    .png()
    .toFile(good);
  fs.writeFileSync(bad, 'Not a PNG');
  const visit = async (target) => {
    await target.goto(`${origin}/me/settings/profile`, {
      waitUntil: 'networkidle0',
    });
    await target.waitForSelector('profile-avatar-editor');
  };
  const click = (label) =>
    page.$$eval(
      'profile-avatar-editor button',
      (buttons, label) => {
        const button = buttons.find(
          (button) => button.textContent.trim() === label
        );
        if (!button || button.disabled)
          throw new Error(`Photo control unavailable: ${label}`);
        button.click();
      },
      label
    );
  const text = (value) =>
    page.waitForFunction(
      (value) =>
        document
          .querySelector('profile-avatar-editor')
          ?.textContent.includes(value),
      {},
      value
    );
  const photo = (target) =>
    target.waitForFunction(() => {
      const img = document.querySelector('.avatar-card img');
      return (
        img?.src.startsWith('blob:') && img.complete && img.naturalWidth > 0
      );
    });
  const layouts = async (state) => {
    for (const theme of ['light', 'dark']) {
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
      ]);
      for (const width of [390, 768, 1440]) {
        await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        await capture(state, theme, width, page);
      }
    }
  };
  await visit(page);
  await visit(second);
  const initial = await identities.getProfile('BrowserAlice');
  await (await page.$('profile-avatar-editor input')).uploadFile(good);
  await text('Photo selected');
  await layouts('photo-selected');
  discardNextReceipt();
  await click('Save photo');
  await text('Could not confirm');
  await layouts('photo-uncertain');
  assert.equal(
    (await identities.getProfile('BrowserAlice')).revision,
    initial.revision + 1
  );
  await click('Retry photo change');
  await photo(page);
  assert.equal(
    (await identities.getProfile('BrowserAlice')).revision,
    initial.revision + 1
  );
  assert.equal(commands.at(-1).key, commands.at(-2).key);
  await layouts('photo-saved');
  await second.reload({ waitUntil: 'networkidle0' });
  await photo(second);
  const oldBlob = await page.$eval('.avatar-card img', (img) => img.src);
  await setSession('bob-session', page);
  await page.waitForFunction(
    () => document.querySelector('input[name="name"]')?.value === 'Bob Browser'
  );
  assert.equal(await page.$('.avatar-card img'), null);
  assert.equal(
    await page.evaluate(async (uri) => {
      try {
        await fetch(uri);
        return false;
      } catch {
        return true;
      }
    }, oldBlob),
    true,
    'Old private object URL must be revoked'
  );
  await setSession('alice-session', page);
  await photo(page);
  await (await page.$('profile-avatar-editor input')).uploadFile(bad);
  await click('Save photo');
  await text('Use a still PNG');
  await layouts('photo-invalid');
  const preserved = (await identities.getProfile('BrowserAlice')).profile
    .avatarId;
  assert.ok(preserved);
  await (await page.$('profile-avatar-editor input')).uploadFile(good);
  const current = await identities.getProfile('BrowserAlice');
  await identities.updateProfile(
    'BrowserAlice',
    {
      expectedRevision: current.revision,
      name: current.profile.name,
      bio: current.profile.bio,
      location: current.profile.location,
      socialLinks: current.profile.socialLinks,
    },
    randomUUID()
  );
  await click('Save photo');
  await text('Your profile changed');
  await layouts('photo-conflict');
  assert.equal(
    (await identities.getProfile('BrowserAlice')).profile.avatarId,
    preserved
  );
  await click('Discard selection and reload');
  await photo(page);
  await page.$eval('input[name="name"]', (input) => {
    input.value = 'Unsaved text';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('profile-avatar-editor button')].every(
      (button) => button.disabled
    )
  );
  assert.equal(
    (await identities.getProfile('BrowserAlice')).profile.name,
    initial.profile.name
  );
  await page.$$eval('.settings-actions button', (buttons) =>
    buttons.find((button) => button.textContent.trim() === 'Cancel').click()
  );
  await page.waitForFunction(
    () => !document.querySelector('profile-avatar-editor button')?.disabled
  );
  discardNextReceipt();
  const beforeRemove = (await identities.getProfile('BrowserAlice')).revision;
  await click('Remove photo');
  await text('Could not confirm');
  assert.equal(
    (await identities.getProfile('BrowserAlice')).profile.avatarId,
    null
  );
  await click('Retry photo change');
  await page.waitForFunction(
    () =>
      document.querySelector('profile-avatar-editor') &&
      !document.querySelector('.avatar-card img')
  );
  assert.equal(
    (await identities.getProfile('BrowserAlice')).revision,
    beforeRemove + 1
  );
  await layouts('photo-removed');
  await second.reload({ waitUntil: 'networkidle0' });
  assert.equal(await second.$('.avatar-card img'), null);
  // Leave a current photo in place to verify actual API process restart and recovery.
  await (await page.$('profile-avatar-editor input')).uploadFile(good);
  await click('Save photo');
  await photo(page);
  await page.goto(`${origin}/me/profile`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('img')].some(
      (img) => img.src.startsWith('blob:') && img.complete && img.naturalWidth
    )
  );
  return {
    unavailable: async () => {
      await page.goto(`${origin}/me/settings/profile`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => document.body.innerText.includes('Could not load settings'));
    },
    recovered: async () => {
      await visit(page);
      await photo(page);
    },
  };
}
module.exports = { profileAvatarsBrowser };
