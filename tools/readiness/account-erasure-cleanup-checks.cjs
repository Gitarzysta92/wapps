const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  MysqlCanonicalIdentities,
  MysqlAccountExports,
  MysqlProfileBadges,
  MysqlAccountErasureCleanup,
  MysqlAccountErasureParticipant,
  ProfileBadges1791676831000,
  ProfileBadgeErasure1791840003000,
} = require('../../libs/adapters/account-mysql/src');
const {
  CleanAccountErasureParticipant,
} = require('../../sdk/features/identity/libs/management/src');
const {
  ACCOUNT_EXPORT_LIMITS,
  CanonicalIdentityAccessDenied,
} = require('../../sdk/features/identity/core/src');

module.exports = async function qualifyAccountErasureCleanup(source) {
  assert.match(
    source.options.database,
    /^identity_qualification_[0-9a-f]{32}$/
  );
  const identities = new MysqlCanonicalIdentities(source),
    badges = new MysqlProfileBadges(source),
    exports = new MysqlAccountExports(source);
  const owner = 'EraseStaff',
    keeper = 'KeepMember',
    staff = 'KeepStaff',
    sibling = 'eraseStaff';
  for (const uid of [owner, keeper, staff, sibling]) {
    await identities.ensure({
      uid,
      provider: 'email',
      kind: 'user',
      activate: true,
    });
    await identities.enrollAccount(
      uid,
      `Private name for ${uid}`,
      randomUUID()
    );
  }
  const ownerId = (await identities.getProfile(owner)).publicId,
    keeperId = (await identities.getProfile(keeper)).publicId;
  const award = {
    expectedRevision: 0,
    kind: 'verified',
    action: 'award',
    reason: 'Private evidence from erased staff',
  };
  const key = randomUUID();
  await badges.change(owner, keeperId, award, key);
  await badges.change(
    staff,
    ownerId,
    { ...award, reason: 'Private owner evidence' },
    randomUUID()
  );
  // More than one batch of history for an erased recipient exercises migration checks mid-cleanup.
  for (let revision = 1; revision < 132; revision++)
    await badges.change(
      staff,
      ownerId,
      {
        ...award,
        expectedRevision: revision,
        action: revision % 2 ? 'revoke' : 'award',
      },
      randomUUID()
    );
  const beforeKeeper = await badges.administer(staff, keeperId, null);
  const ownerBefore = await identities.find(owner);
  for (let index = 0; index < 260; index++)
    await source.query(
      'INSERT INTO identity_account_commands (identityId, commandKey, fingerprint, revision, createdAt) VALUES (?, ?, ?, ?, ?)',
      [
        owner,
        `private-command-${index}`,
        'a'.repeat(64),
        ownerBefore.revision,
        Date.now(),
      ]
    );
  const job = await exports.request(owner, randomUUID());
  const work = await exports.claim(Date.now(), randomUUID());
  assert.equal(work.id, job.id);
  for (let position = 0; position < 20; position++)
    assert.equal(
      await exports.append(
        work,
        position,
        Buffer.alloc(ACCOUNT_EXPORT_LIMITS.chunkBytes, 99),
        Date.now()
      ),
      true
    );
  const keeperJob = await exports.request(keeper, randomUUID());
  const ownerCommands = async () =>
    Number(
      (
        await source.query(
          'SELECT COUNT(*) AS total FROM identity_account_commands WHERE identityId = ?',
          [owner]
        )
      )[0].total
    );
  const commandCount = await ownerCommands();
  const cleanup = new MysqlAccountErasureCleanup(source);
  await assert.rejects(
    cleanup.advance({ identityId: owner, revision: ownerBefore.revision }),
    CanonicalIdentityAccessDenied
  );
  const deletion = await identities.requestDeletion(owner),
    request = { identityId: owner, revision: deletion.revision };
  await assert.rejects(cleanup.advance(request), /barrier is missing/);
  const participant = new MysqlAccountErasureParticipant('account', source);
  await participant.request(request);
  const outbox = await source.query(
    'SELECT * FROM identity_events_outbox ORDER BY id'
  );
  await source.query(
    "CREATE TRIGGER erasure_cleanup_failure BEFORE DELETE ON identity_account_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected cleanup rollback'"
  );
  try {
    await assert.rejects(cleanup.advance(request), /injected cleanup rollback/);
  } finally {
    await source.query('DROP TRIGGER erasure_cleanup_failure');
  }
  assert.equal(await ownerCommands(), commandCount);
  assert.equal((await participant.request(request)).state, 'pending');
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT COUNT(*) AS total FROM identity_account_export_chunks WHERE exportId = ?',
          [job.id]
        )
      )[0].total
    ),
    20
  );

  assert.equal(await cleanup.advance(request), 'pending');
  assert.equal(await ownerCommands(), commandCount - 128);
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT COUNT(*) AS total FROM identity_account_export_chunks WHERE exportId = ?',
          [job.id]
        )
      )[0].total
    ),
    4
  );
  const audit = await badges.administer(staff, keeperId, null);
  assert.deepEqual(audit.badges, beforeKeeper.badges);
  assert.equal(audit.revision, beforeKeeper.revision);
  assert.deepEqual(
    audit.events,
    beforeKeeper.events.map((event) => ({
      ...event,
      actorId: null,
      reason: null,
    }))
  );
  const [privateReceipt] = await source.query(
    'SELECT * FROM identity_profile_badge_events WHERE ownerId = ?',
    [keeperId]
  );
  for (const field of ['actorId', 'reason', 'commandKey', 'fingerprint'])
    assert.equal(privateReceipt[field], null);
  await assert.rejects(
    badges.change(owner, keeperId, award, key),
    CanonicalIdentityAccessDenied
  );
  await assert.rejects(
    exports.append(work, 20, Buffer.from('late private bytes'), Date.now()),
    CanonicalIdentityAccessDenied
  );
  console.log(
    'PASS: cleanup rollback, bounded receipt/history/archive batches, erased staff attribution and blocked late export writes'
  );

  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    await new ProfileBadges1791676831000().up(runner);
    await new ProfileBadgeErasure1791840003000().up(runner);
    const reopened = await new DataSource({
      ...source.options,
      migrations: [],
    }).initialize();
    try {
      const resumed = new CleanAccountErasureParticipant(
        new MysqlAccountErasureParticipant('account', reopened),
        new MysqlAccountErasureCleanup(reopened)
      );
      const results = await Promise.all([
        resumed.request(request),
        resumed.request(request),
      ]);
      assert.ok(results.some((receipt) => receipt.state === 'completed'));
      assert.equal((await resumed.request(request)).state, 'completed');
    } finally {
      await reopened.destroy();
    }
    assert.equal(await ownerCommands(), 0);
    for (const table of [
      'identity_accounts',
      'identity_preferences',
      'identity_favorites',
      'identity_profile_avatars',
      'identity_account_exports',
    ])
      assert.deepEqual(
        await source.query(`SELECT * FROM ${table} WHERE identityId = ?`, [
          owner,
        ]),
        []
      );
    assert.deepEqual(
      await source.query(
        'SELECT * FROM identity_account_export_chunks WHERE exportId = ?',
        [job.id]
      ),
      []
    );
    assert.deepEqual(
      await source.query(
        'SELECT * FROM identity_profile_badges WHERE ownerId = ?',
        [ownerId]
      ),
      []
    );
    assert.deepEqual(
      await source.query(
        'SELECT * FROM identity_profile_badge_events WHERE ownerId = ? OR actorId = ?',
        [ownerId, ownerId]
      ),
      []
    );
    assert.equal(
      (await identities.getProfile(sibling)).profile.name,
      `Private name for ${sibling}`
    );
    assert.equal((await exports.inspect(keeper, keeperJob.id)).id, keeperJob.id);
    assert.deepEqual(
      await source.query('SELECT * FROM identity_events_outbox ORDER BY id'),
      outbox
    );
    assert.equal((await identities.find(owner)).revision, deletion.revision);
    assert.equal(
      (await identities.requestDeletion(owner)).cleanup,
      'pending',
      'Other services and credential cleanup still have not completed'
    );
    await new ProfileBadges1791676831000().up(runner);
    await new ProfileBadgeErasure1791840003000().up(runner);
    await badges.change(
      staff,
      keeperId,
      {
        ...award,
        expectedRevision: 1,
        action: 'revoke',
        reason: 'Current staff can revoke retained badges',
      },
      randomUUID()
    );
    await new ProfileBadgeErasure1791840003000().up(runner);
    await source.query(
      'UPDATE identity_profile_badge_events SET reason = ? WHERE ownerId = ? AND revision = 1',
      ['Must not survive erasure', keeperId]
    );
    try {
      await assert.rejects(new ProfileBadgeErasure1791840003000().up(runner));
    } finally {
      await source.query(
        'UPDATE identity_profile_badge_events SET reason = NULL WHERE ownerId = ? AND revision = 1',
        [keeperId]
      );
    }
    await assert.rejects(
      new ProfileBadgeErasure1791840003000().down(),
      /data-preserving rollback/
    );
    console.log(
      'PASS: cleanup reconnect/concurrency, exact completed receipt, foreign-account isolation, retained lifecycle authority and replayable anonymized badge history'
    );
  } finally {
    await runner.release();
  }
};
