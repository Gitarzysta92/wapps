const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const sharp = require('sharp');
const { DataSource } = require('typeorm');
const {
  MysqlProfileAvatars,
  MysqlCanonicalIdentities,
  ProfileAvatars1791676828000,
} = require('../../libs/adapters/account-mysql/src');

async function qualifyProfileAvatars({ source, configuration, identities }) {
  const uid = 'PhotoOwner';
  const bytes = await sharp({
    create: { width: 16, height: 12, channels: 3, background: 'green' },
  })
    .webp()
    .toBuffer();
  const image = { bytes, width: 16, height: 12 };
  const input = {
    expectedRevision: 2,
    source: {
      contentType: 'image/webp',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  };
  const photos = new MysqlProfileAvatars(source);
  for (const id of [uid, 'photoowner', 'PhotoForeign', 'PhotoStub'])
    await identities.ensure({
      uid: id,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
  await assert.rejects(
    photos.inspect('PhotoStub', { ...input, expectedRevision: 1 }, 'stub'),
    /profile details/
  );
  await identities.enrollAccount(uid, 'Photo Owner', 'enroll');
  const receipt = await photos.change(uid, input, 'photo-1', image);
  assert.equal(receipt.revision, 3);
  const profile = await identities.getProfile(uid);
  const id = profile.profile.avatarId;
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(profile.profile.avatarUri, null);
  assert.deepEqual(Buffer.from((await photos.read(uid, id)).bytes), bytes);
  await assert.rejects(photos.read('PhotoForeign', id));
  await assert.rejects(photos.read('photoowner', id));
  assert.deepEqual(await photos.change(uid, input, 'photo-1', null), receipt);
  await assert.rejects(
    photos.change(uid, { ...input, source: null }, 'photo-1', null),
    /another command/
  );
  await source.query(
    "CREATE TRIGGER fail_avatar_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected photo rollback'"
  );
  try {
    await assert.rejects(
      photos.change(
        uid,
        { expectedRevision: 3, source: null },
        'rollback',
        null
      )
    );
    assert.equal((await identities.getProfile(uid)).profile.avatarId, id);
    assert.equal((await identities.getProfile(uid)).revision, 3);
  } finally {
    await source.query('DROP TRIGGER fail_avatar_outbox');
  }
  const concurrent = await Promise.allSettled([
    photos.change(uid, { ...input, expectedRevision: 3 }, 'replace', image),
    photos.change(uid, { expectedRevision: 3, source: null }, 'remove', null),
  ]);
  assert.equal(
    concurrent.filter((value) => value.status === 'fulfilled').length,
    1
  );
  assert.equal((await identities.getProfile(uid)).revision, 4);
  await assert.rejects(photos.read(uid, id));
  await photos.change(uid, { ...input, expectedRevision: 4 }, 'current', image);
  const currentId = (await identities.getProfile(uid)).profile.avatarId;
  const other = await new DataSource(configuration).initialize();
  try {
    assert.equal(
      (await new MysqlCanonicalIdentities(other).getProfile(uid)).profile
        .avatarId,
      currentId
    );
    assert.deepEqual(
      Buffer.from(
        (await new MysqlProfileAvatars(other).read(uid, currentId)).bytes
      ),
      bytes
    );
  } finally {
    await other.destroy();
  }
  const runner = source.createQueryRunner();
  try {
    await new ProfileAvatars1791676828000().up(runner);
    await source.query('ALTER TABLE identity_profile_avatars DROP CHECK avatar_payload_bounds, ADD CONSTRAINT avatar_payload_bounds CHECK (width > 0)');
    await assert.rejects(new ProfileAvatars1791676828000().up(runner), /bounds/);
    await source.query('ALTER TABLE identity_profile_avatars DROP CHECK avatar_payload_bounds, ADD CONSTRAINT avatar_payload_bounds CHECK (OCTET_LENGTH(payload) BETWEEN 12 AND 262144 AND width BETWEEN 1 AND 512 AND height BETWEEN 1 AND 512 AND createdAt > 0)');
    await new ProfileAvatars1791676828000().up(runner);
    await source.query(
      "UPDATE identity_profile_avatars SET sha256 = REPEAT('0',64) WHERE identityId = ?",
      [uid]
    );
    await assert.rejects(
      new ProfileAvatars1791676828000().up(runner),
      /digest/
    );
    await assert.rejects(photos.read(uid, currentId), /Corrupt/);
    await source.query(
      'UPDATE identity_profile_avatars SET sha256 = ? WHERE identityId = ?',
      [createHash('sha256').update(bytes).digest('hex'), uid]
    );
  } finally {
    await runner.release();
  }
  await photos.change(
    uid,
    { expectedRevision: 5, source: null },
    'final-remove',
    null
  );
  assert.deepEqual(await photos.change(uid, input, 'photo-1', image), receipt);
  assert.equal((await identities.getProfile(uid)).profile.avatarId, null);
  await assert.rejects(photos.read(uid, currentId));
  await photos.change(
    uid,
    { ...input, expectedRevision: 6 },
    'before-delete',
    image
  );
  await identities.requestDeletion(uid);
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT COUNT(*) AS count FROM identity_profile_avatars WHERE identityId = ?',
          [uid]
        )
      )[0].count
    ),
    0
  );
  await assert.rejects(photos.change(uid, input, 'photo-1', image));
  console.log(
    'Private profile avatars: SQL isolation, rollback, concurrent commands, replay, reconnect, integrity and erasure passed.'
  );
}
module.exports = { qualifyProfileAvatars };
