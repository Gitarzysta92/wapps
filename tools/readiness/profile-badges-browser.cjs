const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function profileBadgesBrowser({
  origin,
  newSession,
  setSession,
  capture,
  identities,
  source,
  discardReceipt,
  commands,
}) {
  for (const uid of ['BrowserBadgeStaff', 'BrowserBadgeMember']) {
    await identities.ensure({
      uid,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
    await identities.enrollAccount(
      uid,
      uid === 'BrowserBadgeStaff' ? 'Badge Staff' : 'Badge Member',
      randomUUID()
    );
  }
  const id = (await identities.getProfile('BrowserBadgeMember')).publicId;
  const staff = await newSession('badge-staff-session'),
    second = await newSession('badge-staff-session'),
    member = await newSession('badge-member-session'),
    anonymous = await newSession(null);
  const text = (page, value, selector = 'profile-badge-admin') =>
    page.waitForFunction(
      (selector, value) =>
        document.querySelector(selector)?.textContent.includes(value),
      { timeout: 15000 },
      selector,
      value
    );
  const click = (page, label, selector = 'profile-badge-admin button') =>
    page.$$eval(
      selector,
      (buttons, label) => {
        const button = buttons.find(
          (button) => button.textContent.trim() === label
        );
        if (!button || button.disabled)
          throw new Error(`Unavailable badge control: ${label}`);
        button.click();
      },
      label
    );
  const fill = (page, selector, value) =>
    page.$eval(
      selector,
      (input, value) => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      value
    );
  const admin = async (page) => {
    await page.goto(`${origin}/me/profile-badges`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('#badge-profile-id');
    await fill(page, '#badge-profile-id', id);
    await click(page, 'Load profile');
    await text(page, 'Badge Member');
  };
  const publicProfile = async () => {
    await anonymous.goto(`${origin}/profiles/${id}`, {
      waitUntil: 'networkidle0',
    });
    await anonymous.waitForSelector('account-badges');
  };
  const layouts = async (page, state) => {
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
  await staff.goto(`${origin}/me/profile`, { waitUntil: 'networkidle0' });
  await staff.waitForSelector('profile-badge-access a');
  assert.equal(
    await staff.$eval('profile-badge-access a', (anchor) =>
      anchor.getAttribute('href')
    ),
    '/me/profile-badges'
  );
  await member.goto(`${origin}/me/profile`, { waitUntil: 'networkidle0' });
  await text(member, 'No active badges.', 'account-badges');
  assert.equal(await member.$('profile-badge-access a'), null);
  await admin(staff);
  await layouts(staff, 'badge-staff-empty');
  await click(staff, 'Award verified');
  await text(staff, 'Provide a reason');
  assert.equal(commands.length, 0);
  await fill(staff, '#badge-reason', 'Verified evidence reviewed by staff');
  discardReceipt();
  await click(staff, 'Award verified');
  await text(staff, 'The decision may have been saved');
  await layouts(staff, 'badge-staff-uncertain');
  await click(staff, 'Retry same decision');
  await text(staff, 'Verified awarded');
  assert.deepEqual(commands[0], commands[1]);
  await layouts(staff, 'badge-staff-awarded');
  await member.reload({ waitUntil: 'networkidle0' });
  await text(member, 'Verified', 'account-badges');
  await layouts(member, 'badge-owner-visible');
  assert.equal(
    await member.$eval('account-badges', (element) =>
      element.textContent.includes('evidence')
    ),
    false
  );
  await member.goto(`${origin}/me/settings/privacy`, {
    waitUntil: 'networkidle0',
  });
  await member.waitForSelector('.visibility-option');
  await member.$$eval('.visibility-option', (buttons) =>
    buttons
      .find(
        (button) =>
          button
            .querySelector('.visibility-option__label')
            ?.textContent.trim() === 'Public'
      )
      .click()
  );
  await member.$eval('input[aria-label="Show Badges"]', (input) => {
    if (!input.checked) input.click();
  });
  await click(member, 'Save Changes', '.settings-actions button');
  await text(member, 'saved', '.settings-feedback');
  await publicProfile();
  await text(anonymous, 'Verified', 'account-badges');
  await layouts(anonymous, 'badge-public-visible');
  await member.$eval('input[aria-label="Show Badges"]', (input) =>
    input.click()
  );
  await click(member, 'Save Changes', '.settings-actions button');
  await text(member, 'saved', '.settings-feedback');
  await click(anonymous, 'Refresh badges', 'account-badges button');
  await text(anonymous, 'Badges are not shared', 'account-badges');
  await layouts(anonymous, 'badge-public-hidden');
  await member.goto(`${origin}/profiles/${id}`, { waitUntil: 'networkidle0' });
  await text(member, 'Badges are not shared', 'account-badges');
  await admin(second);
  await fill(staff, '#badge-reason', 'Premium granted after staff review');
  await click(staff, 'Award premium');
  await text(staff, 'Premium awarded');
  await fill(second, '#badge-reason', 'Stale competing decision');
  await click(second, 'Revoke verified');
  await text(second, 'Badges changed.');
  await layouts(second, 'badge-staff-conflict');
  await click(second, 'Reload current badges');
  await text(second, 'Premium awarded');
  await fill(second, '#badge-reason', 'Verification evidence expired');
  await click(second, 'Revoke verified');
  await text(second, 'Verified revoked');
  await layouts(second, 'badge-staff-revoked');
  await member.goto(`${origin}/me/profile`, { waitUntil: 'networkidle0' });
  await text(member, 'Premium', 'account-badges');
  assert.equal(
    await member.$eval('account-badges', (element) =>
      element.textContent.includes('Verified')
    ),
    false
  );
  await member.goto(`${origin}/me/profile-badges`, {
    waitUntil: 'networkidle0',
  });
  await text(member, 'requires an active staff account');
  assert.equal(await member.$('#badge-reason'), null);
  await layouts(member, 'badge-staff-denied');
  await fill(second, '#badge-reason', 'Unsaved private staff note');
  await setSession('badge-member-session', second);
  await text(second, 'requires an active staff account');
  assert.equal(await second.$('.badge-history'), null);
  await setSession('badge-staff-session', second);
  await second.waitForSelector('#badge-profile-id');
  assert.equal(
    await second.$eval('#badge-profile-id', (input) => input.value),
    ''
  );
  await fill(second, '#badge-profile-id', id);
  await click(second, 'Load profile');
  await text(second, 'Verified revoked');
  assert.equal(await second.$eval('#badge-reason', (input) => input.value), '');
  await fill(second, '#badge-reason', 'Premium withdrawn by staff');
  await click(second, 'Revoke premium');
  await text(second, 'Premium revoked');
  await member.goto(`${origin}/me/profile`, { waitUntil: 'networkidle0' });
  await text(member, 'No active badges.', 'account-badges');
  await layouts(member, 'badge-owner-empty');
  await fill(second, '#badge-profile-id', randomUUID());
  await click(second, 'Load profile');
  await text(second, 'This profile is unavailable.');
  await layouts(second, 'badge-staff-missing');
  await admin(staff);
  for (let index = 0; index < 18; index++) {
    await fill(
      staff,
      '#badge-reason',
      `Reviewed history paging decision ${index}`
    );
    await click(staff, index % 2 ? 'Revoke verified' : 'Award verified');
    await text(staff, `Badge decision saved at revision ${index + 5}.`);
    await staff.waitForSelector('#badge-reason');
  }
  await click(staff, 'Older decisions');
  await text(staff, 'Verified evidence reviewed by staff');
  assert.equal(
    await staff.$eval('.badge-history', (list) => list.children.length),
    2
  );
  await layouts(staff, 'badge-staff-history');
  await click(staff, 'Latest decisions');
  await text(staff, 'Reviewed history paging decision 17');
  const {
    MysqlProfileBadges,
    MysqlAccountErasureParticipant,
    MysqlAccountErasureCleanup,
  } = require('../../libs/adapters/account-mysql/src');
  const {
    CleanAccountErasureParticipant,
  } = require('../../sdk/features/identity/libs/management/src');
  const erased = 'BrowserErasedBadgeStaff';
  await identities.ensure({
    uid: erased,
    kind: 'user',
    provider: 'email',
    activate: true,
  });
  await identities.enrollAccount(erased, 'Staff name to remove', randomUUID());
  const store = new MysqlProfileBadges(source);
  const current = await store.administer('BrowserBadgeStaff', id, null);
  await store.change(
    erased,
    id,
    {
      expectedRevision: current.revision,
      kind: 'verified',
      action: 'award',
      reason: 'Erased staff private evidence',
    },
    randomUUID()
  );
  await store.change(
    erased,
    id,
    {
      expectedRevision: current.revision + 1,
      kind: 'verified',
      action: 'revoke',
      reason: 'Erased staff private evidence',
    },
    randomUUID()
  );
  const deletion = await identities.requestDeletion(erased);
  const receipt = await new CleanAccountErasureParticipant(
    new MysqlAccountErasureParticipant('account', source),
    new MysqlAccountErasureCleanup(source)
  ).request({ identityId: erased, revision: deletion.revision });
  assert.equal(receipt.state, 'completed');
  await click(staff, 'Latest decisions');
  await text(staff, 'Deleted staff account');
  await text(staff, 'Reason removed with staff account.');
  assert.equal(
    await staff.$eval('.badge-history', (list) =>
      list.textContent.includes('Erased staff private evidence')
    ),
    false
  );
  await layouts(staff, 'badge-staff-erased-author');
  return {
    unavailable: async () => {
      await click(staff, 'Latest decisions');
      await text(staff, 'Profile badges could not be loaded.');
      await layouts(staff, 'badge-staff-unavailable');
    },
    recovered: async () => {
      await click(staff, 'Retry profile badges');
      await text(staff, 'Reviewed history paging decision 17');
      await member.reload({ waitUntil: 'networkidle0' });
      await text(member, 'No active badges.', 'account-badges');
    },
  };
}
module.exports = { profileBadgesBrowser };
