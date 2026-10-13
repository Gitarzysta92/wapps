const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { changeProfileFollow } = require('../../libs/domains/customer/profiles/src');
const { MysqlPublicProfiles, ProfileFollows1791676829000 } = require('../../sdk/features/identity/packages/infrastructure/mysql/src');

async function qualifyPublicProfilesSql({ source, configuration, identities }) {
  const store = new MysqlPublicProfiles(source);
  const ownerUid = 'AudienceOwner';
  const requesterUid = 'AudienceRequester';
  const foreignUid = 'audiencerequester';
  for (const uid of [ownerUid, requesterUid, foreignUid]) {
    await identities.ensure({ uid, provider: 'email', kind: 'user', activate: true });
    await identities.enrollAccount(uid, uid, 'audience-enroll');
  }
  const owner = await identities.find(ownerUid);
  const requester = await identities.find(requesterUid);
  const ownerId = owner.subjectId;
  const requesterId = requester.subjectId;
  const visibility = async (uid, value) => {
    const preferences = await identities.getPreferences(uid);
    preferences.preferences.privacy.profileVisibility = value;
    await identities.updatePreferences(uid, { expectedRevision: preferences.revision, preferences: preferences.preferences }, randomUUID());
  };
  const command = async (uid, action, revision, key = randomUUID(), reverse = false, persistence = store) => {
    const input = { ownerId: reverse ? requesterId : ownerId, requesterId: reverse ? ownerId : requesterId, expectedRevision: revision, action };
    const prepared = await persistence.prepareFollow(uid, input, key);
    if (prepared.receipt) return prepared.receipt;
    return persistence.changeFollow(uid, input, key, prepared.snapshot, changeProfileFollow(prepared.snapshot.follow, action));
  };
  assert.equal((await identities.getProfile(ownerUid)).publicId, ownerId);
  assert.equal((await store.inspect(ownerId, null)).facts.visibility, 'private');
  assert.equal((await store.directory(null, null)).snapshots.some(row => row.profile.id === ownerId), false);
  await visibility(ownerUid, 'public');
  const visible = await store.inspect(ownerId, null);
  assert.equal(visible.profile.name, ownerUid);
  assert.equal(JSON.stringify(visible.profile).includes('identityId'), false);
  assert.equal((await store.directory(null, null)).snapshots.some(row => row.profile.id === ownerId), true);
  await visibility(ownerUid, 'followers');
  assert.equal(await store.confirm(visible, null), null);
  await assert.rejects(command(foreignUid, 'request', 0), /denied/);
  await assert.rejects(command(ownerUid, 'request', 0), /denied/);
  const requestKey = randomUUID();
  const pending = await command(requesterUid, 'request', 0, requestKey);
  assert.equal(pending.status, 'pending');
  assert.deepEqual((await store.followers(ownerUid, null)).followers, [{ ...pending, requesterName: requesterUid }]);
  assert.deepEqual((await store.following(requesterUid, null)).following, [pending]);
  assert.equal((await store.followers(foreignUid, null)).followers.length, 0);
  await assert.rejects(command(requesterUid, 'approve', 1), /denied/);
  const approveKey = randomUUID();
  const approved = await command(ownerUid, 'approve', 1, approveKey);
  assert.equal(approved.status, 'approved');
  const allowed = await store.inspect(ownerId, requesterUid);
  assert.equal(allowed.facts.approved, true);
  const removed = await command(ownerUid, 'remove', 2);
  assert.equal(removed.status, 'none');
  assert.equal(await store.confirm(allowed, requesterUid), null);
  assert.deepEqual(await command(requesterUid, 'request', 0, requestKey), pending);
  assert.deepEqual(await command(ownerUid, 'approve', 1, approveKey), approved);
  assert.equal((await store.inspect(ownerId, requesterUid)).facts.approved, false);
  await assert.rejects(command(requesterUid, 'request', 3, requestKey), /another follow command/);

  const ownerBefore = await identities.find(ownerUid);
  const requesterBefore = await identities.find(requesterUid);
  await source.query("CREATE TRIGGER fail_follow_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected follower rollback'");
  try {
    await assert.rejects(command(requesterUid, 'request', 3));
    assert.equal((await identities.find(ownerUid)).revision, ownerBefore.revision);
    assert.equal((await identities.find(requesterUid)).revision, requesterBefore.revision);
    assert.equal((await store.inspect(ownerId, requesterUid)).follow.revision, 3);
  } finally { await source.query('DROP TRIGGER fail_follow_outbox'); }
  const competing = await Promise.allSettled([command(requesterUid, 'request', 3), command(requesterUid, 'request', 3)]);
  assert.equal(competing.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal((await store.inspect(ownerId, requesterUid)).follow.revision, 4);
  await visibility(ownerUid, 'private');
  assert.deepEqual((await store.following(requesterUid, null)).following, [{ ...pending, revision: 4 }]);
  await command(requesterUid, 'cancel', 4);
  await visibility(ownerUid, 'followers');
  await visibility(requesterUid, 'followers');
  const opposite = await Promise.allSettled([command(requesterUid, 'request', 5), command(ownerUid, 'request', 0, randomUUID(), true)]);
  for (let index = 0; index < opposite.length; index++) {
    const result = opposite[index];
    if (result.status === 'rejected') {
      assert.match(result.reason.message, /audience changed/);
      await (index === 0 ? command(requesterUid, 'request', 5) : command(ownerUid, 'request', 0, randomUUID(), true));
    }
  }
  const another = await new DataSource(configuration).initialize();
  try {
    assert.equal((await new MysqlPublicProfiles(another).inspect(ownerId, requesterUid)).follow.status, 'pending');
    await command(ownerUid, 'approve', 6, randomUUID(), false, new MysqlPublicProfiles(another));
  } finally { await another.destroy(); }
  const runner = source.createQueryRunner();
  try {
    await new ProfileFollows1791676829000().up(runner);
    await source.query('ALTER TABLE identity_profile_follows DROP INDEX follows_requester, ADD INDEX follows_requester (requesterId, ownerId, status)');
    await assert.rejects(new ProfileFollows1791676829000().up(runner), /index/);
    await source.query('ALTER TABLE identity_profile_follows DROP INDEX follows_requester, ADD INDEX follows_requester (requesterId, status, ownerId)');
    await new ProfileFollows1791676829000().up(runner);
  } finally { await runner.release(); }
  const foreignId = (await identities.find(foreignUid)).subjectId;
  const quotaChange = async (action, expectedRevision) => {
    const input = { ownerId, requesterId: foreignId, action, expectedRevision };
    const key = randomUUID(); const prepared = await store.prepareFollow(foreignUid, input, key);
    return store.changeFollow(foreignUid, input, key, prepared.snapshot, changeProfileFollow(prepared.snapshot.follow, action));
  };
  for (let index = 0; index < 20; index++) { await quotaChange('request', index * 2); await quotaChange('cancel', index * 2 + 1); }
  await assert.rejects(quotaChange('request', 40), /Daily follow request limit/);
  assert.equal((await store.inspect(ownerId, foreignUid)).follow.status, 'none');
  const beforeDelete = await store.inspect(ownerId, requesterUid);
  await identities.requestDeletion(requesterUid);
  await assert.rejects(store.confirm(beforeDelete, requesterUid));
  assert.equal((await store.followers(ownerUid, null)).followers.length, 0);
  const [remaining] = await source.query('SELECT COUNT(*) AS count FROM identity_profile_follows WHERE ownerId = ? OR requesterId = ?', [requesterId, requesterId]);
  assert.equal(Number(remaining.count), 0);
  const [receipts] = await source.query('SELECT COUNT(*) AS count FROM identity_profile_follow_commands WHERE ownerId = ? OR requesterId = ?', [requesterId, requesterId]);
  assert.equal(Number(receipts.count), 0);
  await assert.rejects(command(requesterUid, 'request', 0, requestKey));
  console.log('Public profiles: canonical privacy snapshots, case isolation, approval, revocation, historical receipts, atomic rollback, concurrent writers, reconnect, migration reentry and local erasure passed.');
}
module.exports = { qualifyPublicProfilesSql };
