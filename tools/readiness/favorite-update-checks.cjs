const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const identity = require('../../libs/adapters/account-mysql/src');
const management = require('../../libs/usecases/account/src');
const {
  AuthorityValidationService,
} = require('../../sdk/kernel/ontology/authority/src');
const root = '../../apps/services/community/src/app/discussions/';
const { MysqlDiscussionWrites } = require(root +
  'infrastructure/mysql-discussion-writes');
const { DurableDiscussionCommands } = require(root +
  'application/durable-discussion-commands');
const { RegisteredDiscussionPayloads } = require(root +
  'application/registered-discussion-payloads');
const { MysqlDiscussionPayloads } = require(root +
  'infrastructure/mysql-discussion-payloads');
const { MinioDiscussionPayloadObjects } = require(root +
  'infrastructure/immutable-discussion-payloads');
const { MysqlDiscussionFavoriteUpdates } = require(root +
  'infrastructure/mysql-favorite-updates');

module.exports = async function qualifyFavoriteUpdates({
  source,
  minio,
  uploaded,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const database = `identity_qualification_${randomUUID().replaceAll('-', '')}`;
  await source.query(
    `CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
  );
  const account = identity.identityDataSource({
    MYSQL_HOST: source.options.host,
    MYSQL_PORT: String(source.options.port),
    MYSQL_USERNAME: source.options.username,
    MYSQL_PASSWORD: source.options.password,
    MYSQL_DATABASE: database,
  });
  try {
    await account.initialize();
    await account.runMigrations({ transaction: 'none' });
    let at = Date.now() + 60_000,
      visible = true;
    const now = () => at;
    const identities = new identity.MysqlCanonicalIdentities(account);
    const favorites = new identity.MysqlAccountFavorites(account, now);
    const store = new identity.MysqlFavoriteUpdates(account, now);
    const policy = { evaluate: async () => ({ ok: true, value: true }) };
    const authority = new (class extends AuthorityValidationService {})(policy);
    const owner = {
      identityId: 'FavoriteOwner',
      tenantId: 'default',
      roles: ['discussion:writer'],
    };
    const peer = { ...owner, identityId: 'FavoritePeer' };
    for (const actor of [owner, peer]) {
      await identities.ensure({
        uid: actor.identityId,
        kind: 'user',
        provider: 'email',
        activate: true,
      });
      await identities.enrollAccount(
        actor.identityId,
        'Favorite member',
        randomUUID()
      );
    }
    const registry = new RegisteredDiscussionPayloads(
      new MysqlDiscussionPayloads(source),
      new MinioDiscussionPayloadObjects(minio)
    );
    const payloads = {
      put: async (...args) => {
        const ref = await registry.put(...args);
        uploaded.push(ref.key);
        return ref;
      },
    };
    const writes = new MysqlDiscussionWrites(source);
    const commands = new DurableDiscussionCommands(
      writes,
      payloads,
      policy,
      { generate: randomUUID },
      { visible: async () => true }
    );
    const parent = { kind: 'application', id: randomUUID() },
      content = { displayName: 'Member', text: 'Public favorite content' };
    const topic = await commands.create(
      {
        content: {
          ...content,
          title: 'Favorite qualification',
          tags: ['community'],
        },
        subjectId: parent.id,
        target: parent,
      },
      owner,
      randomUUID()
    );
    const target = { kind: 'discussions', id: topic.id };
    const reader = new MysqlDiscussionFavoriteUpdates(
      source,
      {
        select: async (targets) =>
          visible
            ? targets.map((target) => ({
                target,
                title: 'Current application',
                slug: 'current-application',
              }))
            : [],
      },
      'default'
    );
    const delivery = new management.DeliverFavoriteUpdates(store, reader);
    const inbox = new management.FavoriteUpdatesService(
      authority,
      store,
      reader,
      () => true
    );
    const context = {
      identityId: owner.identityId,
      timestamp: at,
      subject: { roles: [] },
    };
    const page = async (cursor) => {
      const result = await inbox.list(cursor ? { cursor } : {}, context);
      if (!result.ok) throw result.error;
      return result.value;
    };
    const reply = (key = randomUUID()) =>
      commands.reply(topic.id, content, peer, key, parent);
    const change = async (saved) => {
      const current = await favorites.read(owner.identityId),
        stamp = saved ? await reader.read(target) : null;
      return favorites.change(
        owner.identityId,
        { expectedRevision: current.revision, target, saved },
        randomUUID(),
        stamp ? { version: stamp.version, at: stamp.at } : null
      );
    };
    const tick = async () => {
      at += 31_000;
      return delivery.advance();
    };
    const rows = () =>
      account.query(
        'SELECT * FROM identity_favorite_notifications WHERE identityId=? ORDER BY createdAt,id',
        [owner.identityId]
      );

    const first = await reader.read(target);
    assert.equal(first.version, 1);
    await change(true);
    await tick();
    assert.equal(
      (await rows()).length,
      0,
      'Saving a favorite must not deliver old content'
    );
    await source.query(
      "CREATE TRIGGER fail_favorite_cursor BEFORE INSERT ON content_update_cursors FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected cursor failure'"
    );
    const before = await writes.resource(topic.id),
      key = randomUUID();
    try {
      await assert.rejects(reply(key));
    } finally {
      await source.query('DROP TRIGGER fail_favorite_cursor');
    }
    assert.equal((await writes.resource(topic.id)).revision, before.revision);
    assert.equal((await reader.read(target)).version, 1);
    const committed = await reply(key);
    assert.deepEqual(await reply(key), committed);
    assert.equal((await reader.read(target)).version, 2);
    await reply();
    await tick();
    assert.equal(
      (await rows()).length,
      1,
      'Several committed changes are one coalesced observation'
    );
    assert.equal(Number((await rows())[0].version), 3);
    await tick();
    assert.equal((await rows()).length, 1);
    const notification = (await page()).items[0];
    const read = await store.markRead(owner.identityId, notification.id);
    assert.deepEqual(
      await new identity.MysqlFavoriteUpdates(account, now).markRead(
        owner.identityId,
        notification.id
      ),
      read
    );
    await assert.rejects(store.markRead(peer.identityId, notification.id));
    visible = false;
    assert.equal(
      (await page()).items.length,
      0,
      'Current parent visibility overrides delivered receipts'
    );
    visible = true;

    await reply();
    at += 31_000;
    const oldLease = await store.claim();
    assert.ok(oldLease);
    const oldState = await reader.read(target);
    await change(false);
    await change(true);
    await store.settle(oldLease, oldState);
    assert.equal(
      (await page()).items.length,
      0,
      'An old subscription cannot revive after remove/re-add'
    );
    await tick();
    assert.equal((await rows()).length, 1);

    const preferences = async (enabled) => {
      const current = await identities.getPreferences(owner.identityId);
      current.preferences.notifications.inApp.favoriteUpdates = enabled;
      await identities.updatePreferences(
        owner.identityId,
        {
          expectedRevision: current.revision,
          preferences: current.preferences,
        },
        randomUUID()
      );
    };
    await preferences(false);
    await reply();
    await tick();
    assert.equal((await rows()).at(-1).delivered, 0);
    await preferences(true);
    await tick();
    assert.equal(
      (await page()).items.length,
      0,
      'Opt-in must not revive a suppressed observation'
    );
    await reply();
    at += 31_000;
    const lease = await store.claim();
    assert.ok(lease);
    const current = await reader.read(target);
    await account.query(
      "CREATE TRIGGER fail_favorite_receipt BEFORE INSERT ON identity_favorite_notifications FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected receipt failure'"
    );
    const count = (await rows()).length;
    try {
      await assert.rejects(store.settle(lease, current));
    } finally {
      await account.query('DROP TRIGGER fail_favorite_receipt');
    }
    assert.equal((await rows()).length, count);
    await store.settle(lease, current);
    await store.settle(lease, current);
    assert.equal(
      (await rows()).length,
      count + 1,
      'Lost commit responses replay without duplicating receipts'
    );

    // Competing pollers and expired workers cannot share or regain a lease.
    at += 31_000;
    const claims = await Promise.all([
      store.claim(),
      new identity.MysqlFavoriteUpdates(account, now).claim(),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    let crashed = claims.find(Boolean);
    for (let n = 1; n < 12; n++) {
      at += 31_000;
      crashed = await store.claim();
      assert.ok(crashed);
    }
    at += 31_000;
    assert.equal(await store.claim(), null);
    const failure = (await store.status()).failed[0];
    assert.equal(failure.attempts, 12);
    assert.equal(
      await store.requeue(failure.generation, failure.failedAt - 1),
      false
    );
    assert.equal(
      await store.requeue(failure.generation, failure.failedAt),
      true
    );
    const recovered = await store.claim();
    assert.ok(recovered);
    await store.settle(crashed, await reader.read(target));
    await store.settle(recovered, await reader.read(target));

    for (let n = 0; n < 11; n++) {
      await reply();
      await tick();
    }
    const latest = await page();
    assert.equal(latest.items.length, 10);
    assert.ok(latest.next);
    const older = await page(latest.next);
    assert.ok(older.items.length > 0);
    assert.equal(
      new Set([...latest.items, ...older.items].map((row) => row.id)).size,
      latest.items.length + older.items.length
    );
    const exported = [];
    for await (const row of new identity.MysqlAccountExportSource(
      account
    ).capture(owner.identityId, new AbortController().signal))
      exported.push(row);
    assert.ok(
      exported.some((row) => row.collection === 'favorite-subscriptions')
    );
    assert.ok(exported.some((row) => row.collection === 'favorite-updates'));
    assert.ok(
      !JSON.stringify(
        exported.filter((row) => row.collection?.startsWith('favorite-'))
      ).includes('leaseToken')
    );

    const migration = new identity.AccountFavoriteUpdates1791840019000(),
      runner = account.createQueryRunner();
    await runner.connect();
    try {
      await migration.up(runner);
      await account.query(
        'UPDATE identity_favorite_watches SET attempts=13 WHERE identityId=?',
        [owner.identityId]
      );
      await assert.rejects(migration.up(runner));
      await account.query(
        'UPDATE identity_favorite_watches SET attempts=0 WHERE identityId=?',
        [owner.identityId]
      );
      await migration.up(runner);
      await assert.rejects(migration.down());
    } finally {
      await runner.release();
    }
    at += 31_000;
    const erasureLease = await store.claim();
    assert.ok(erasureLease);
    await identities.requestDeletion(owner.identityId);
    await store.settle(erasureLease, await reader.read(target));
    assert.equal(
      (
        await account.query(
          'SELECT * FROM identity_favorite_watches WHERE identityId=?',
          [owner.identityId]
        )
      ).length,
      0
    );
    const [erasure] = await account.query(
      'SELECT identityId,revision FROM identity_erasure_jobs WHERE identityId=?',
      [owner.identityId]
    );
    await new identity.MysqlAccountErasureParticipant(
      'account',
      account
    ).request({
      identityId: erasure.identityId,
      revision: Number(erasure.revision),
    });
    const cleanup = new identity.MysqlAccountErasureCleanup(account, now);
    assert.equal(
      await cleanup.advance({
        identityId: erasure.identityId,
        revision: Number(erasure.revision),
      }),
      'completed'
    );
    assert.equal((await rows()).length, 0);
    console.log(
      'Favorite updates: canonical source rollback/replay, subscription generations, coalescing, suppression, receipt retry, leases/quarantine, current visibility, reads, paging, export, migration validation and erasure passed.'
    );
  } finally {
    if (account.isInitialized) await account.destroy();
    await source.query(`DROP DATABASE ${database}`);
  }
};
