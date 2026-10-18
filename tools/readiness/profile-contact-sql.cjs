const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { DataSource } = require('typeorm');
const { MysqlCanonicalIdentities, MysqlPublicProfiles, ProfileContactEmail1791676830000 } = require('../../libs/adapters/account-mysql/src');

async function qualifyProfileContact({ source, configuration, identities }) {
  const uid = 'ContactAlice';
  await identities.ensure({ uid, kind: 'user', provider: 'email', activate: true });
  await identities.enrollAccount(uid, 'Contact Alice', randomUUID());
  const initial = await identities.getProfile(uid);
  assert.equal(initial.profile.contactEmail, null);
  const id = initial.publicId;
  const store = new MysqlPublicProfiles(source);
  const legacy = { expectedRevision: initial.revision, name: 'Contact Alice', bio: null, location: null, socialLinks: {} };
  const legacyKey = randomUUID();
  const legacyReceipt = await identities.updateProfile(uid, legacy, legacyKey);
  const [stored] = await source.query('SELECT fingerprint FROM identity_account_commands WHERE identityId = ? AND commandKey = ?', [uid, legacyKey]);
  assert.equal(stored.fingerprint, createHash('sha256').update(JSON.stringify({ operation: 'profile-update-v1', ...legacy })).digest('hex'));
  const command = { ...legacy, expectedRevision: legacyReceipt.revision, contactEmail: 'Alice+contact@EXAMPLE.Test' };
  const key = randomUUID(); const receipt = await identities.updateProfile(uid, command, key);
  assert.equal((await identities.getProfile(uid)).profile.contactEmail, 'Alice+contact@example.test');
  assert.equal((await store.inspect(id, null)).profile.contactEmail, null);
  const sharing = async (showEmail) => {
    const saved = await identities.getPreferences(uid);
    await identities.updatePreferences(uid, { expectedRevision: saved.revision, preferences: { ...saved.preferences, privacy: { ...saved.preferences.privacy, profileVisibility: 'public', showEmail } } }, randomUUID());
  };
  await sharing(true);
  const visible = await store.inspect(id, null);
  assert.equal(visible.profile.contactEmail, 'Alice+contact@example.test');
  await sharing(false);
  assert.equal(await store.confirm(visible, null), null, 'A privacy edit during policy I/O invalidates the snapshot');
  assert.equal((await store.inspect(id, null)).profile.contactEmail, null);
  const before = await identities.getProfile(uid);
  const rollbackKey = randomUUID();
  const changed = { ...legacy, expectedRevision: before.revision, contactEmail: 'changed@example.test' };
  await source.query("CREATE TRIGGER fail_contact_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected contact rollback'");
  try {
    await assert.rejects(identities.updateProfile(uid, changed, rollbackKey));
    assert.deepEqual(await identities.getProfile(uid), before);
    assert.equal((await source.query('SELECT commandKey FROM identity_account_commands WHERE identityId = ? AND commandKey = ?', [uid, rollbackKey])).length, 0);
  } finally { await source.query('DROP TRIGGER fail_contact_outbox'); }
  const writers = await Promise.allSettled([
    identities.updateProfile(uid, changed, randomUUID()),
    identities.updateProfile(uid, { ...changed, contactEmail: 'other@example.test' }, randomUUID()),
  ]);
  assert.equal(writers.filter(result => result.status === 'fulfilled').length, 1);
  const current = await identities.getProfile(uid);
  await identities.updateProfile(uid, { ...legacy, expectedRevision: current.revision, name: 'Legacy edit' }, randomUUID());
  assert.equal((await identities.getProfile(uid)).profile.contactEmail, current.profile.contactEmail, 'Old clients preserve an explicitly set contact');
  assert.deepEqual(await identities.updateProfile(uid, legacy, legacyKey), legacyReceipt);
  assert.deepEqual(await identities.updateProfile(uid, command, key), receipt);
  assert.equal((await identities.getProfile(uid)).profile.contactEmail, current.profile.contactEmail, 'Historical replay does not restore an old address');
  const connection = await new DataSource(configuration).initialize();
  try {
    const reopened = new MysqlCanonicalIdentities(connection);
    assert.equal((await reopened.getProfile(uid)).profile.contactEmail, current.profile.contactEmail);
  } finally { await connection.destroy(); }
  const runner = source.createQueryRunner();
  try {
    const migration = new ProfileContactEmail1791676830000();
    await migration.up(runner);
    await source.query('ALTER TABLE identity_accounts MODIFY contactEmail varchar(254) CHARACTER SET ascii COLLATE ascii_general_ci NULL');
    await assert.rejects(migration.up(runner), /Incompatible/);
    await source.query('ALTER TABLE identity_accounts MODIFY contactEmail varchar(254) CHARACTER SET ascii COLLATE ascii_bin NULL');
    await source.query('UPDATE identity_accounts SET contactEmail = ? WHERE identityId = ?', ['', uid]);
    await assert.rejects(migration.up(runner), /Non-canonical/);
    await source.query('UPDATE identity_accounts SET contactEmail = ? WHERE identityId = ?', [current.profile.contactEmail, uid]);
    await source.query('ALTER TABLE identity_accounts RENAME COLUMN contactEmail TO retainedContactEmail');
    try { await assert.rejects(migration.up(runner), /Applied contact email column is missing/); }
    finally { await source.query('ALTER TABLE identity_accounts RENAME COLUMN retainedContactEmail TO contactEmail'); }
    await migration.up(runner);
    await assert.rejects(migration.down(), /data-preserving/);
  } finally { await runner.release(); }
  const latest = await identities.getProfile(uid);
  await identities.updateProfile(uid, { ...legacy, expectedRevision: latest.revision, contactEmail: null }, randomUUID());
  await sharing(true);
  assert.equal((await store.inspect(id, null)).profile.contactEmail, null);
  await identities.requestDeletion(uid);
  assert.equal((await source.query('SELECT contactEmail FROM identity_accounts WHERE identityId = ?', [uid])).length, 0);
  const retained = await source.query('SELECT * FROM identity_account_commands WHERE identityId = ?', [uid]);
  assert.ok(retained.length > 0, 'Existing receipt hashes remain as tombstone history');
  assert.equal(JSON.stringify(retained).includes('@'), false, 'Receipts contain no plaintext contact address');
  await assert.rejects(identities.updateProfile(uid, command, key));
  console.log('Contact email SQL: default privacy, canonical sharing, snapshot recheck, legacy commands/receipts, rollback, competing edits, reconnect, migration validation, removal and erasure passed.');
}
module.exports = { qualifyProfileContact };
