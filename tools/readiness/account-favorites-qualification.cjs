const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const {
  MysqlCanonicalIdentities,
  MysqlAccountFavorites,
  AccountFavorites1791676807000,
} = require('../../sdk/features/identity/packages/infrastructure/mysql/src');

async function qualifyAccountFavorites({ source, configuration, identities }) {
  const alice = 'FavoritesAlice';
  const bob = 'favoritesAlice';
  const target = (i) => ({
    kind: 'applications',
    id: `019a0010-0000-7000-8000-${i.toString(16).padStart(12, '0')}`,
  });
  for (const uid of [alice, bob])
    await identities.ensure({
      uid,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
  const favorites = new MysqlAccountFavorites(source);
  const initial = await favorites.read(alice);
  assert.deepEqual(initial, { identityId: alice, revision: 1, favorites: [] });
  const change = { expectedRevision: 1, saved: true, target: target(1) };
  await source.query(
    "CREATE TRIGGER fail_favorites_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected favorites outbox failure'"
  );
  try {
    await assert.rejects(
      favorites.change(alice, change, 'first-save', { version: 0, at: 0 })
    );
    assert.deepEqual(await favorites.read(alice), initial);
    assert.equal(
      (
        await source.query(
          'SELECT * FROM identity_account_commands WHERE identityId = ?',
          [alice]
        )
      ).length,
      0
    );
  } finally {
    await source.query('DROP TRIGGER fail_favorites_outbox');
  }
  let second = await new DataSource(configuration).initialize();
  try {
    let other = new MysqlAccountFavorites(second);
    const receipts = await Promise.all([
      favorites.change(alice, change, 'first-save', { version: 0, at: 0 }),
      other.change(alice, change, 'first-save', { version: 0, at: 0 }),
    ]);
    assert.deepEqual(receipts, [
      { identityId: alice, revision: 2 },
      { identityId: alice, revision: 2 },
    ]);
    assert.equal((await other.read(alice)).favorites.length, 1);
    assert.equal(
      (await other.read(bob)).favorites.length,
      0,
      'Case-sensitive identities never share favorites'
    );
    const competing = await Promise.allSettled([
      favorites.change(
        alice,
        { ...change, target: target(2), expectedRevision: 2 },
        'compete-a',
        { version: 0, at: 0 }
      ),
      other.change(
        alice,
        { ...change, target: target(3), expectedRevision: 2 },
        'compete-b',
        { version: 0, at: 0 }
      ),
    ]);
    assert.equal(
      competing.filter((result) => result.status === 'fulfilled').length,
      1
    );
    assert.equal(
      competing.filter((result) => result.status === 'rejected').length,
      1
    );
    const beforeReplay = await other.read(alice);
    assert.equal(beforeReplay.revision, 3);
    assert.deepEqual(
      await favorites.inspectChange(alice, change, 'first-save'),
      receipts[0]
    );
    assert.deepEqual(
      await favorites.change(alice, change, 'first-save', {
        version: 0,
        at: 0,
      }),
      receipts[0]
    );
    assert.deepEqual(await favorites.read(alice), beforeReplay);
    await assert.rejects(
      favorites.change(alice, { ...change, saved: false }, 'first-save', {
        version: 0,
        at: 0,
      }),
      /another command/
    );
    await identities.updateProfile(
      alice,
      {
        expectedRevision: 3,
        name: 'Favorites owner',
        bio: null,
        location: null,
        socialLinks: {},
      },
      'profile-change'
    );
    await assert.rejects(
      favorites.change(
        alice,
        { ...change, expectedRevision: 3 },
        'stale-after-profile',
        { version: 0, at: 0 }
      ),
      /revision changed/
    );
    await assert.rejects(
      identities.updateProfile(
        alice,
        {
          expectedRevision: 1,
          name: 'Other command',
          bio: null,
          location: null,
          socialLinks: {},
        },
        'first-save'
      ),
      /another command/
    );
    await favorites.change(
      alice,
      { ...change, saved: false, expectedRevision: 4 },
      'remove',
      { version: 0, at: 0 }
    );
    const removed = await favorites.read(alice);
    assert.ok(
      removed.favorites.every((favorite) => favorite.id !== target(1).id)
    );
    await favorites.change(alice, change, 'first-save', { version: 0, at: 0 });
    assert.deepEqual(
      await favorites.read(alice),
      removed,
      'Replaying an old add cannot resurrect a removed relation'
    );
    await second.destroy();
    second = await new DataSource(configuration).initialize();
    other = new MysqlAccountFavorites(second);
    assert.deepEqual(await other.read(alice), removed);
    const runner = source.createQueryRunner();
    try {
      await new AccountFavorites1791676807000().up(runner);
      await source.query(
        'UPDATE identity_favorites SET targetId = ? WHERE identityId = ?',
        ['invalid-slug', alice]
      );
      await assert.rejects(other.read(alice), /Invalid stored favorites/);
      await assert.rejects(new AccountFavorites1791676807000().up(runner));
      await source.query(
        'UPDATE identity_favorites SET targetId = ? WHERE identityId = ?',
        [removed.favorites[0].id, alice]
      );
      await new AccountFavorites1791676807000().up(runner);
    } finally {
      await runner.release();
    }
    await identities.setSuspended(alice, true);
    await assert.rejects(other.read(alice));
    await assert.rejects(other.inspectChange(alice, change, 'first-save'));
    await identities.setSuspended(alice, false);
    const beforeDelete = await other.read(alice);
    await source.query(
      "CREATE TRIGGER fail_favorites_delete BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected favorites deletion failure'"
    );
    try {
      await assert.rejects(identities.requestDeletion(alice));
      assert.deepEqual(await other.read(alice), beforeDelete);
    } finally {
      await source.query('DROP TRIGGER fail_favorites_delete');
    }
    await identities.requestDeletion(alice);
    assert.equal(
      (
        await source.query(
          'SELECT * FROM identity_favorites WHERE identityId = ?',
          [alice]
        )
      ).length,
      0
    );
    await assert.rejects(other.inspectChange(alice, change, 'first-save'));
    await assert.rejects(
      other.change(alice, change, 'first-save', { version: 0, at: 0 })
    );
    assert.deepEqual((await other.read(bob)).favorites, []);
    const events = await source.query(
      'SELECT body FROM identity_events_outbox WHERE identityId = ?',
      [alice]
    );
    assert.ok(
      events.every(
        (event) =>
          !event.body.includes(target(1).id) &&
          !event.body.includes('Favorites owner')
      )
    );
    const limitUid = 'FavoritesLimit';
    await new MysqlCanonicalIdentities(second).ensure({
      uid: limitUid,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
    for (let i = 1; i < 200; i++)
      await other.change(
        limitUid,
        { expectedRevision: i, saved: true, target: target(i) },
        `limit-${i}`,
        { version: 0, at: 0 }
      );
    const capacityRace = await Promise.allSettled([
      favorites.change(
        limitUid,
        { expectedRevision: 200, saved: true, target: target(200) },
        'last-a',
        { version: 0, at: 0 }
      ),
      other.change(
        limitUid,
        { expectedRevision: 200, saved: true, target: target(201) },
        'last-b',
        { version: 0, at: 0 }
      ),
    ]);
    assert.equal(
      capacityRace.filter((result) => result.status === 'fulfilled').length,
      1
    );
    const atLimit = await other.read(limitUid);
    assert.equal(atLimit.favorites.length, 200);
    await assert.rejects(
      other.change(
        limitUid,
        {
          expectedRevision: atLimit.revision,
          saved: true,
          target: target(202),
        },
        'over-limit',
        { version: 0, at: 0 }
      ),
      /limit reached/
    );
    assert.deepEqual(await other.read(limitUid), atLimit);
    console.log(
      'Favorites SQL: rollback, concurrent/replayed commands, case isolation, shared revision, reconnect, strict migration, lifecycle cleanup and capacity race pass.'
    );
  } finally {
    if (second.isInitialized) await second.destroy();
  }
}

module.exports = { qualifyAccountFavorites };
