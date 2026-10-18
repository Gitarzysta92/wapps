const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { MysqlProfileBadges, MysqlPublicProfiles, ProfileBadges1791676831000 } = require('../../libs/adapters/account-mysql/src');

async function qualifyProfileBadges({ source, configuration, identities }) {
  const actor = 'BadgeStaff', recipient = 'BadgeMember';
  for (const uid of [actor, recipient]) {
    await identities.ensure({ uid, kind: 'user', provider: 'email', activate: true });
    await identities.enrollAccount(uid, uid, randomUUID());
  }
  const id = (await identities.getProfile(recipient)).publicId;
  const store = new MysqlProfileBadges(source), profiles = new MysqlPublicProfiles(source);
  assert.equal((await store.administer(actor, id, null)).revision, 0);
  const command = { expectedRevision: 0, kind: 'verified', action: 'award', reason: 'Reviewed evidence\nApproved by staff' };
  const key = randomUUID();
  const before = await identities.find(recipient);
  await source.query("CREATE TRIGGER fail_badge_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected badge rollback'");
  try {
    await assert.rejects(store.change(actor, id, command, key));
    assert.deepEqual(await identities.find(recipient), before);
    assert.equal((await store.administer(actor, id, null)).revision, 0);
    assert.equal((await source.query('SELECT * FROM identity_profile_badges WHERE ownerId = ?', [id])).length, 0);
    assert.equal((await source.query('SELECT * FROM identity_profile_badge_events WHERE ownerId = ?', [id])).length, 0);
  } finally { await source.query('DROP TRIGGER fail_badge_outbox'); }
  const duplicates = await Promise.all([store.change(actor, id, command, key), store.change(actor, id, command, key)]);
  assert.deepEqual(duplicates[0], duplicates[1]);
  assert.equal((await identities.find(recipient)).revision, before.revision + 1);
  await assert.rejects(store.change(actor, id, { ...command, reason: 'Different intent' }, key), /another badge command/);
  const revoke = { ...command, expectedRevision: 1, action: 'revoke', reason: 'Evidence expired' };
  const races = await Promise.allSettled([store.change(actor, id, revoke, randomUUID()), store.change(actor, id, { ...revoke, kind: 'premium', action: 'award' }, randomUUID())]);
  assert.equal(races.filter((result) => result.status === 'fulfilled').length, 1);
  let current = await store.administer(actor, id, null);
  if (current.badges.find((badge) => badge.kind === 'verified').active) await store.change(actor, id, { ...revoke, expectedRevision: current.revision }, randomUUID());
  const revoked = await store.administer(actor, id, null);
  assert.deepEqual(await store.change(actor, id, command, key), duplicates[0], 'Historical retry returns its original receipt');
  assert.deepEqual(await store.administer(actor, id, null), revoked, 'Historical award never resurrects a revoked badge');
  const sharing = async (showBadges, visibility = 'public') => {
    const saved = await identities.getPreferences(recipient);
    await identities.updatePreferences(recipient, { expectedRevision: saved.revision, preferences: { ...saved.preferences, privacy: { ...saved.preferences.privacy, profileVisibility: visibility, showBadges } } }, randomUUID());
  };
  await store.change(actor, id, { ...command, expectedRevision: revoked.revision }, randomUUID());
  await sharing(true);
  const snapshot = await profiles.inspect(id, null);
  const publicBadges = await store.shared(snapshot, null);
  assert.equal(publicBadges.items.some((badge) => badge.kind === 'verified'), true);
  assert.equal(JSON.stringify(publicBadges).includes(command.reason), false);
  await sharing(false);
  await assert.rejects(store.shared(snapshot, null), /Profile unavailable/);
  assert.equal(await profiles.confirm(snapshot, null), null);
  assert.equal((await store.own(recipient)).items.some((badge) => badge.kind === 'verified'), true, 'Own read does not depend on public sharing');
  const actorState = await identities.find(actor);
  await identities.setSuspended(actor, true);
  await assert.rejects(store.change(actor, id, { ...revoke, expectedRevision: (await store.administer(recipient, id, null)).revision }, randomUUID()));
  await assert.rejects(store.assertStaffIdentity(actor));
  await identities.setSuspended(actor, false);
  assert.ok((await identities.find(actor)).revision > actorState.revision);
  await identities.setSuspended(recipient, true);
  current = await store.administer(actor, id, null);
  await store.change(actor, id, { ...revoke, expectedRevision: current.revision }, randomUUID());
  await assert.rejects(store.change(actor, id, { ...command, expectedRevision: current.revision + 1 }, randomUUID()), /inactive profile/);
  await identities.setSuspended(recipient, false);
  for (let index = 0; index < 23; index++) {
    current = await store.administer(actor, id, null);
    const active = current.badges.find((badge) => badge.kind === 'verified').active;
    await store.change(actor, id, { ...command, expectedRevision: current.revision, action: active ? 'revoke' : 'award' }, randomUUID());
  }
  const first = await store.administer(actor, id, null), second = await store.administer(actor, id, first.after);
  assert.equal(first.events.length, 20);
  assert.ok(first.after);
  assert.ok(second.events.length > 0 && second.events.every((event) => event.revision < first.after));
  assert.equal(second.after, null);
  const reopened = await new DataSource(configuration).initialize();
  try { assert.deepEqual(await new MysqlProfileBadges(reopened).administer(actor, id, null), first); }
  finally { await reopened.destroy(); }
  const runner = source.createQueryRunner();
  const migration = new ProfileBadges1791676831000();
  try {
    await migration.up(runner);
    const [row] = await source.query('SELECT * FROM identity_profile_badge_events WHERE ownerId = ? AND revision = 1', [id]);
    await source.query('UPDATE identity_profile_badge_events SET reason = ? WHERE ownerId = ? AND revision = 1', ['Tampered reason', id]);
    await assert.rejects(migration.up(runner), /audit history/);
    await source.query('UPDATE identity_profile_badge_events SET reason = ? WHERE ownerId = ? AND revision = 1', [row.reason, id]);
    await source.query('UPDATE identity_profile_badges SET active = 1 - active WHERE ownerId = ? AND kind = ?', [id, 'verified']);
    await assert.rejects(migration.up(runner), /disagrees/);
    await source.query('UPDATE identity_profile_badges SET active = 1 - active WHERE ownerId = ? AND kind = ?', [id, 'verified']);
    await source.query('ALTER TABLE identity_profile_badge_events DROP INDEX badge_command');
    await assert.rejects(migration.up(runner), /index/);
    await source.query('ALTER TABLE identity_profile_badge_events ADD UNIQUE KEY badge_command (actorId, commandKey)');
    await source.query('RENAME TABLE identity_profile_badges TO retained_profile_badges');
    try { await assert.rejects(migration.up(runner), /Applied badge table is missing/); }
    finally { await source.query('RENAME TABLE retained_profile_badges TO identity_profile_badges'); }
    await migration.up(runner);
    await assert.rejects(migration.down(), /data-preserving/);
  } finally { await runner.release(); }
  await identities.requestDeletion(recipient);
  await assert.rejects(store.administer(actor, id, null), /Profile unavailable/);
  await assert.rejects(store.change(actor, id, command, key), /Profile unavailable/);
  assert.equal(await profiles.inspect(id, null), null);
  console.log('Badge SQL: atomic outbox rollback, concurrent revisions/exact retries, immutable replay after revocation, privacy, lifecycle, audit paging, reconnect, migration reentry/corruption and deletion access passed.');
}
module.exports = { qualifyProfileBadges };
