const assert = require('node:assert/strict');
const path = require('node:path');
const sharp = require('sharp');

async function publicProfilesBrowser({ origin, newSession, setSession, capture, identities, output, discardNextReceipt, commands, discardProfileReceipt, profileCommands }) {
  for (const uid of ['BrowserAudienceOwner', 'BrowserAudienceRequester']) {
    await identities.ensure({ uid, kind: 'user', provider: 'email', activate: true });
    await identities.enrollAccount(uid, uid === 'BrowserAudienceOwner' ? 'Audience Alice' : 'Audience Bob', 'audience-enroll');
  }
  const ownerId = (await identities.find('BrowserAudienceOwner')).subjectId;
  const requesterId = (await identities.find('BrowserAudienceRequester')).subjectId;
  const owner = await newSession('audience-owner-session');
  const requester = await newSession('audience-requester-session');
  const second = await newSession('audience-requester-session');
  const anonymous = await newSession(null);
  const ownerSecond = await newSession('audience-owner-session');
  const contact = 'Audience.Contact+questions@example.test';
  const settings = async page => {
    await page.goto(`${origin}/me/settings/profile`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[name="contactEmail"]');
  };
  const enterContact = (page, value) => page.$eval('input[name="contactEmail"]', (input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  const saved = page => page.waitForFunction(() => document.querySelector('.settings-feedback')?.textContent.includes('Profile saved to your account.'));
  const sharesContact = async enabled => {
    await owner.goto(`${origin}/me/settings/privacy`, { waitUntil: 'networkidle0' });
    await owner.waitForSelector('input[aria-label="Show Email Address"]');
    await owner.$eval('input[aria-label="Show Email Address"]', (input, enabled) => { if (input.checked !== enabled) input.click(); }, enabled);
    await click(owner, 'Save Changes', '.settings-actions button');
    await owner.waitForFunction(() => document.querySelector('.settings-feedback')?.textContent.includes('saved'));
  };
  const contactVisible = (page, address = contact) => page.waitForFunction(address => document.querySelector('.profile-contact a')?.textContent.trim() === address, {}, address);
  const visit = async (page, id = ownerId) => {
    await page.goto(`${origin}/profiles/${id}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('public-profile-page');
  };
  const text = (page, value) => page.waitForFunction(value => document.querySelector('public-profile-page')?.textContent.includes(value), { timeout: 15000 }, value);
  const click = (page, label, selector = 'public-profile-page button') => page.$$eval(selector, (buttons, label) => {
    const button = buttons.find(button => button.textContent.trim() === label);
    if (!button || button.disabled) throw new Error(`Unavailable profile control: ${label}`);
    button.click();
  }, label);
  const photo = page => page.waitForFunction(() => [...document.querySelectorAll('public-profile-page profile-details img')].some(image => image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0));
  const layouts = async (page, state) => {
    for (const theme of ['light', 'dark']) {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
      for (const width of [390, 768, 1440]) {
        await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        await capture(state, theme, width, page);
      }
    }
  };
  const privacy = async label => {
    await owner.goto(`${origin}/me/settings/privacy`, { waitUntil: 'networkidle0' });
    await owner.waitForSelector('.visibility-option');
    await owner.$$eval('.visibility-option', (buttons, label) => {
      const button = buttons.find(button => button.querySelector('.visibility-option__label')?.textContent.trim() === label);
      if (!button) throw new Error(`Missing visibility ${label}`);
      button.click();
    }, label);
    await click(owner, 'Save Changes', '.settings-actions button');
    await owner.waitForFunction(() => document.querySelector('.settings-feedback')?.textContent.includes('saved'));
  };
  await visit(anonymous); await text(anonymous, 'This profile is unavailable');
  await layouts(anonymous, 'audience-private');
  await visit(owner); await text(owner, 'Follower requests and access');
  await layouts(owner, 'audience-owner');
  const image = path.join(output, 'public-photo-source.png');
  await sharp({ create: { width: 120, height: 90, channels: 3, background: '#197b77' } }).png().toFile(image);
  await owner.goto(`${origin}/me/settings/profile`, { waitUntil: 'networkidle0' });
  await owner.waitForSelector('profile-avatar-editor input');
  await (await owner.$('profile-avatar-editor input')).uploadFile(image);
  await click(owner, 'Save photo', 'profile-avatar-editor button');
  await owner.waitForFunction(() => [...document.querySelectorAll('.avatar-card img')].some(image => image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0));
  await settings(owner);
  await enterContact(owner, 'not-an-address');
  const beforeInvalid = profileCommands.length;
  await click(owner, 'Save Changes', '.settings-actions button');
  await owner.waitForFunction(() => document.querySelector('.settings-feedback')?.textContent.includes('plain contact email'));
  assert.equal(profileCommands.length, beforeInvalid);
  await layouts(owner, 'contact-invalid');
  await enterContact(owner, contact);
  assert.equal(await owner.$eval('profile-avatar-editor button', button => button.disabled), true, 'Unsaved contact edits protect photo commands');
  discardProfileReceipt(); await click(owner, 'Save Changes', '.settings-actions button');
  await owner.waitForFunction(() => document.querySelector('.settings-feedback')?.textContent.includes('Could not confirm the save'));
  await layouts(owner, 'contact-uncertain');
  await click(owner, 'Save Changes', '.settings-actions button'); await saved(owner);
  assert.deepEqual(profileCommands.at(-1), profileCommands.at(-2));
  await settings(ownerSecond);
  assert.equal(await ownerSecond.$eval('input[name="contactEmail"]', input => input.value), contact);
  await layouts(ownerSecond, 'contact-settings');
  await privacy('Public');
  await anonymous.reload({ waitUntil: 'networkidle0' }); await photo(anonymous);
  assert.equal(await anonymous.$('.profile-contact'), null, 'Saving an address alone does not publish it');
  await layouts(anonymous, 'contact-hidden');
  await sharesContact(true);
  await anonymous.reload({ waitUntil: 'networkidle0' }); await contactVisible(anonymous);
  assert.equal(await anonymous.$eval('.profile-contact a', link => link.getAttribute('href')), `mailto:${encodeURIComponent(contact)}`);
  await text(anonymous, 'Audience Alice'); await layouts(anonymous, 'audience-public');
  await privacy('Followers Only');
  await anonymous.reload({ waitUntil: 'networkidle0' }); await text(anonymous, 'Sign in to request access');
  assert.equal(await anonymous.$('public-profile-page profile-details'), null);
  await layouts(anonymous, 'audience-followers-gate');
  await visit(requester); await text(requester, 'Request access');
  discardNextReceipt(); await click(requester, 'Request access'); await text(requester, 'Retry the same action');
  await layouts(requester, 'audience-request-uncertain');
  await click(requester, 'Retry the same action'); await text(requester, "awaiting the member's approval");
  assert.deepEqual(commands.at(-1), commands.at(-2));
  await layouts(requester, 'audience-pending');
  await visit(second); await text(second, "awaiting the member's approval");
  await visit(owner); await text(owner, 'Awaiting approval');
  await click(owner, 'Approve'); await text(owner, 'Approved follower');
  await requester.reload({ waitUntil: 'networkidle0' }); await photo(requester);
  await contactVisible(requester);
  await layouts(requester, 'audience-approved');
  await sharesContact(false);
  await requester.reload({ waitUntil: 'networkidle0' }); await photo(requester);
  assert.equal(await requester.$('.profile-contact'), null);
  await sharesContact(true);
  await requester.reload({ waitUntil: 'networkidle0' }); await contactVisible(requester);
  await visit(owner);
  const oldBlob = await requester.$eval('public-profile-page profile-details img', image => image.src);
  discardNextReceipt(); await click(owner, 'Remove access'); await text(owner, 'Retry the same action');
  await click(owner, 'Retry the same action'); await text(owner, 'No pending requests or approved followers');
  assert.deepEqual(commands.at(-1), commands.at(-2));
  await click(requester, 'Reload'); await text(requester, 'Request access');
  assert.equal(await requester.$('public-profile-page profile-details'), null);
  assert.equal(await requester.evaluate(async uri => { try { await fetch(uri); return false; } catch { return true; } }, oldBlob), true, 'Revoked profile object URL must be released on reload');
  await click(requester, 'Request access'); await text(requester, "awaiting the member's approval");
  await click(owner, 'Reload'); await text(owner, 'Awaiting approval');
  await click(requester, 'Cancel request'); await text(requester, 'Request access');
  await click(owner, 'Approve'); await text(owner, 'Reload follower state');
  await layouts(owner, 'audience-conflict');
  await click(owner, 'Reload follower state'); await text(owner, 'No pending requests or approved followers');
  await click(requester, 'Request access'); await text(requester, "awaiting the member's approval");
  await privacy('Private');
  await visit(requester, requesterId); await text(requester, 'Pending request');
  await layouts(requester, 'audience-outgoing-private');
  await click(requester, 'Cancel request'); await text(requester, 'No active requests or followed profiles');
  await visit(second); await text(second, 'This profile is unavailable');
  await privacy('Public'); await visit(requester); await photo(requester);
  await settings(ownerSecond);
  await settings(owner); await enterContact(owner, 'Updated.Contact@example.test');
  await click(owner, 'Save Changes', '.settings-actions button'); await saved(owner);
  await enterContact(ownerSecond, 'Stale.Contact@example.test');
  await click(ownerSecond, 'Save Changes', '.settings-actions button');
  await ownerSecond.waitForFunction(() => document.querySelector('.settings-feedback')?.textContent.includes('changed in another session'));
  await layouts(ownerSecond, 'contact-conflict');
  await settings(ownerSecond);
  assert.equal(await ownerSecond.$eval('input[name="contactEmail"]', input => input.value), 'Updated.Contact@example.test');
  await enterContact(ownerSecond, '');
  await click(ownerSecond, 'Save Changes', '.settings-actions button'); await saved(ownerSecond);
  await visit(anonymous); await photo(anonymous); assert.equal(await anonymous.$('.profile-contact'), null);
  await layouts(anonymous, 'contact-removed');
  await settings(owner); await enterContact(owner, contact); await click(owner, 'Save Changes', '.settings-actions button'); await saved(owner);
  await requester.reload({ waitUntil: 'networkidle0' }); await contactVisible(requester);
  const beforeLogout = await requester.$eval('public-profile-page profile-details img', image => image.src);
  await setSession(null, requester); await photo(requester);
  assert.equal(await requester.evaluate(async uri => { try { await fetch(uri); return false; } catch { return true; } }, beforeLogout), true, 'Session changes revoke the previous photo URL');
  await owner.goto(`${origin}/me/profile`, { waitUntil: 'networkidle0' });
  assert.equal(await owner.$eval('.profile-actions a', link => new URL(link.href).pathname), `/profiles/${ownerId}`, 'Own public links use canonical public UUIDs');
  return {
    unavailable: async () => { await requester.reload({ waitUntil: 'networkidle0' }); await text(requester, 'Could not load this profile'); },
    recovered: async () => { await click(requester, 'Retry profile'); await photo(requester); await contactVisible(requester); },
  };
}
module.exports = { publicProfilesBrowser };
