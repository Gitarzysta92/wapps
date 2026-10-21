const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');
const { DataSource } = require('typeorm');
const { readonlyMysqlSnapshot } = require('../../sdk/extras/mysql/src');
const {
  changeProfileFollow,
} = require('../../libs/domains/customer/profiles/src');
const {
  MysqlAccountExportSource,
  MysqlAccountFavorites,
  MysqlProfileAvatars,
  MysqlProfileBadges,
  MysqlPublicProfiles,
} = require('../../libs/adapters/account-mysql/src');

async function collect(iterable) {
  const values = [];
  for await (const value of iterable) values.push(value);
  return values;
}
async function qualifyAccountExportSource({
  source,
  configuration,
  identities,
}) {
  const uid = 'ExportSourceOwner',
    follower = 'ExportSourceFollower',
    foreign = 'ExportSourceForeign';
  for (const identityId of [uid, follower, foreign, 'ExportSourceStub']) {
    await identities.ensure({
      uid: identityId,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
    if (identityId !== 'ExportSourceStub')
      await identities.enrollAccount(identityId, identityId, randomUUID());
  }
  const ownerId = (await identities.find(uid)).subjectId,
    followerId = (await identities.find(follower)).subjectId;
  const initial = await identities.getProfile(uid);
  const edit = {
    expectedRevision: initial.revision,
    name: 'Export Member',
    bio: 'My private biography',
    location: 'Warsaw',
    contactEmail: 'private@example.test',
    socialLinks: { github: 'https://github.com/example' },
  };
  await identities.updateProfile(uid, edit, randomUUID());
  const prefs = await identities.getPreferences(uid);
  prefs.preferences.privacy.profileVisibility = 'followers';
  prefs.preferences.privacy.showEmail = false;
  await identities.updatePreferences(
    uid,
    { expectedRevision: prefs.revision, preferences: prefs.preferences },
    randomUUID()
  );
  const profiles = new MysqlPublicProfiles(source);
  const follow = {
    ownerId,
    requesterId: followerId,
    expectedRevision: 0,
    action: 'request',
  };
  const prepared = await profiles.prepareFollow(
    follower,
    follow,
    'export-follow'
  );
  await profiles.changeFollow(
    follower,
    follow,
    'export-follow',
    prepared.snapshot,
    changeProfileFollow(prepared.snapshot.follow, 'request')
  );
  const approve = { ...follow, expectedRevision: 1, action: 'approve' };
  const approval = await profiles.prepareFollow(uid, approve, 'export-approve');
  await profiles.changeFollow(
    uid,
    approve,
    'export-approve',
    approval.snapshot,
    changeProfileFollow(approval.snapshot.follow, 'approve')
  );
  const favorites = new MysqlAccountFavorites(source);
  for (let index = 0; index < 140; index++) {
    const current = await favorites.read(uid);
    await favorites.change(
      uid,
      {
        expectedRevision: current.revision,
        saved: true,
        target: {
          kind: index % 2 ? 'articles' : 'applications',
          id: randomUUID(),
        },
      },
      randomUUID(),
      { version: 0, at: 0 }
    );
  }
  await favorites.change(
    foreign,
    {
      expectedRevision: (await favorites.read(foreign)).revision,
      saved: true,
      target: { kind: 'articles', id: randomUUID() },
    },
    randomUUID(),
    { version: 0, at: 0 }
  );
  const badges = new MysqlProfileBadges(source);
  await badges.change(
    foreign,
    ownerId,
    {
      expectedRevision: 0,
      kind: 'verified',
      action: 'award',
      reason: 'Staff-only private badge evidence',
    },
    randomUUID()
  );
  const bytes = await sharp({
    create: { width: 12, height: 16, channels: 3, background: 'green' },
  })
    .webp()
    .toBuffer();
  const photos = new MysqlProfileAvatars(source);
  await photos.change(
    uid,
    {
      expectedRevision: (await identities.find(uid)).revision,
      source: {
        contentType: 'image/webp',
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
    },
    randomUUID(),
    { bytes, width: 12, height: 16 }
  );
  const reader = new MysqlAccountExportSource(source);
  await assert.rejects(
    collect(reader.capture('exportsourceowner', new AbortController().signal))
  );
  await assert.rejects(
    collect(reader.capture('ExportSourceStub', new AbortController().signal)),
    /registration/
  );
  const controller = new AbortController(),
    iterator = reader.capture(uid, controller.signal)[Symbol.asyncIterator]();
  const begin = await iterator.next();
  assert.equal(begin.value.type, 'begin');
  const before = await identities.getProfile(uid);
  await identities.updateProfile(
    uid,
    {
      ...edit,
      expectedRevision: before.revision,
      name: 'Edited during capture',
    },
    randomUUID()
  );
  const saved = await identities.getPreferences(uid);
  saved.preferences.display.theme = 'dark';
  await identities.updatePreferences(
    uid,
    { expectedRevision: saved.revision, preferences: saved.preferences },
    randomUUID()
  );
  const during = await favorites.read(uid);
  await favorites.change(
    uid,
    {
      expectedRevision: during.revision,
      target: { kind: during.favorites[0].kind, id: during.favorites[0].id },
      saved: false,
    },
    randomUUID(),
    { version: 0, at: 0 }
  );
  const records = [];
  for (;;) {
    const item = await iterator.next();
    if (item.done) break;
    records.push(item.value);
  }
  const data = (name) =>
    records
      .filter((row) => row.type === 'record' && row.collection === name)
      .map((row) => row.data);
  assert.equal(
    data('profile')[0].profile.name,
    'Export Member',
    'All account records use the original SQL snapshot'
  );
  assert.equal(
    data('profile')[0].profile.contactEmail,
    'private@example.test',
    'Self export is independent of public sharing'
  );
  assert.equal(
    data('favorites').length,
    140,
    'Keyset batches do not truncate the owner collection'
  );
  assert.equal(
    new Set(data('favorites').map((row) => `${row.kind}:${row.id}`)).size,
    140
  );
  assert.equal(
    data('preferences')[0].preferences.display.theme,
    prefs.preferences.display.theme
  );
  assert.equal(data('followers').length, 1);
  assert.equal(data('followers')[0].requesterId, followerId);
  assert.equal(data('badges')[0].badges[0].active, true);
  assert.deepEqual(Buffer.from(data('avatar')[0].payload, 'base64'), bytes);
  assert.equal(
    data('avatar')[0].sha256,
    createHash('sha256').update(bytes).digest('hex')
  );
  assert.equal(
    records.at(-1).records,
    records.filter((row) => row.type === 'record').length
  );
  for (const forbidden of [
    'Staff-only private badge evidence',
    foreign,
    'provider_secret',
    'commandKey',
    'fingerprint',
    'leaseToken',
  ])
    assert.equal(JSON.stringify(records).includes(forbidden), false, forbidden);
  const reopened = await new DataSource(configuration).initialize();
  try {
    const again = await collect(
      new MysqlAccountExportSource(reopened).capture(
        uid,
        new AbortController().signal
      )
    );
    assert.equal(
      again.find((row) => row.collection === 'profile').data.profile.name,
      'Edited during capture'
    );
    assert.equal(
      again.filter((row) => row.collection === 'favorites').length,
      139
    );
    const other = await collect(
      new MysqlAccountExportSource(reopened).capture(
        follower,
        new AbortController().signal
      )
    );
    assert.equal(
      other.find((row) => row.collection === 'following').data.ownerId,
      ownerId
    );
    assert.equal(
      other.some((row) => row.collection === 'avatar'),
      false
    );
  } finally {
    await reopened.destroy();
  }
  const stopped = reader
    .capture(uid, controller.signal)
    [Symbol.asyncIterator]();
  await stopped.next();
  controller.abort(new Error('cancel export'));
  await assert.rejects(stopped.next(), /cancel export/);
  assert.equal(
    Number((await source.query('SELECT 1 AS alive'))[0].alive),
    1,
    'Cancellation leaves the source pool usable'
  );
  await assert.rejects(
    collect(
      readonlyMysqlSnapshot(
        source,
        new AbortController().signal,
        async function* (snapshot) {
          yield* await snapshot.query('SELECT SLEEP(10) AS blocked');
        },
        50
      )
    ),
    /timed out/
  );
  assert.equal(Number((await source.query('SELECT 1 AS alive'))[0].alive), 1);
  await source.query(
    'UPDATE identity_profile_avatars SET sha256 = ? WHERE identityId = ?',
    ['0'.repeat(64), uid]
  );
  await assert.rejects(
    collect(reader.capture(uid, new AbortController().signal)),
    /Invalid canonical/
  );
  await source.query(
    'UPDATE identity_profile_avatars SET sha256 = ? WHERE identityId = ?',
    [createHash('sha256').update(bytes).digest('hex'), uid]
  );
  await identities.setSuspended(uid, true);
  await assert.rejects(
    collect(reader.capture(uid, new AbortController().signal)),
    /Identity is unavailable/
  );
  await identities.setSuspended(uid, false);
  await identities.requestDeletion(uid);
  await assert.rejects(
    collect(reader.capture(uid, new AbortController().signal)),
    /Identity is unavailable/
  );
  console.log(
    'Real Account export source passed: canonical snapshot consistency during profile/preferences/favorite edits, 140-item keyset capture, owner/case isolation, private contact, follower relationships, current badges without staff audit, verified avatar bytes, reconnect, cancellation, SQL timeout, corruption and inactive/deleted accounts.'
  );
}
module.exports = { qualifyAccountExportSource };
