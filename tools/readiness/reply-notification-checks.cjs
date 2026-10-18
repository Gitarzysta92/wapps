const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const root = '../../apps/services/community/src/app/discussions/';
const {
  MysqlDiscussionWrites,
} = require(`${root}infrastructure/mysql-discussion-writes`);
const {
  DurableDiscussionCommands,
} = require(`${root}application/durable-discussion-commands`);
const {
  RegisteredDiscussionPayloads,
} = require(`${root}application/registered-discussion-payloads`);
const {
  MysqlDiscussionPayloads,
} = require(`${root}infrastructure/mysql-discussion-payloads`);
const {
  MinioDiscussionPayloadObjects,
} = require(`${root}infrastructure/immutable-discussion-payloads`);
const {
  MysqlReplyNotifications,
} = require(`${root}infrastructure/mysql-reply-notifications`);
const {
  ReplyNotifications1791840015000,
} = require(`${root}infrastructure/reply-notifications.migration`);
const {
  DiscussionReplyNotifications,
} = require(`${root}application/reply-notifications`);
const {
  MysqlDiscussionAccountExportSource,
} = require(`${root}infrastructure/mysql-discussion-account-export-source`);
const {
  MinioDiscussionExportPayloads,
} = require(`${root}infrastructure/discussion-export-payloads`);
const {
  AnonymizeDiscussionContributions,
} = require(`${root}application/anonymize-discussion-contributions`);
const {
  MysqlDiscussionContributionErasure,
} = require(`${root}infrastructure/mysql-discussion-contribution-erasure`);
const {
  MinioDiscussionErasurePayloads,
} = require(`${root}infrastructure/minio-discussion-erasure-payloads`);
const {
  MysqlDiscussionPrivateErasure,
} = require(`${root}infrastructure/mysql-discussion-private-erasure`);
const {
  identityDataSource,
  MysqlCanonicalIdentities,
  MysqlReplyInbox,
  MysqlAccountExportSource,
  MysqlAccountErasureCleanup,
  MysqlAccountErasureParticipant,
  AccountNotifications1791840016000,
} = require('../../libs/adapters/account-mysql/src');
const {
  DeliverReplyNotifications,
  ReplyInboxService,
} = require('../../libs/usecases/account/src');
const {
  AuthorityValidationService,
} = require('../../sdk/kernel/ontology/authority/src');
const {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
} = require('../../sdk/features/identity/core/src');

const collect = async (iterable) => {
  const rows = [];
  for await (const row of iterable) rows.push(row);
  return rows;
};
const records = (rows) =>
  rows
    .filter(
      (row) => row.type === 'record' && row.collection === 'reply-notifications'
    )
    .map((row) => row.data);

module.exports = async function qualifyReplyNotifications({
  source,
  minio,
  uploaded,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const database = `identity_qualification_${randomUUID().replaceAll('-', '')}`;
  await source.query(
    `CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
  );
  const account = identityDataSource({
    MYSQL_HOST: source.options.host,
    MYSQL_PORT: String(source.options.port),
    MYSQL_USERNAME: source.options.username,
    MYSQL_PASSWORD: source.options.password,
    MYSQL_DATABASE: database,
  });
  try {
    await account.initialize();
    await account.runMigrations({ transaction: 'none' });
    let at = Date.now() + 60_000;
    const now = () => at;
    const identities = new MysqlCanonicalIdentities(account);
    const inbox = new MysqlReplyInbox(account, now);
    const journal = new MysqlReplyNotifications(source, now);
    const policy = { evaluate: async () => ({ ok: true, value: true }) };
    const authority = new (class extends AuthorityValidationService {})(policy);
    const owner = {
      identityId: 'NotificationOwner',
      tenantId: 'default',
      roles: ['discussion:writer'],
    };
    const peer = { ...owner, identityId: 'NotificationPeer' };
    const sibling = { ...owner, identityId: 'notificationowner' };
    for (const actor of [owner, peer, sibling]) {
      await identities.ensure({
        uid: actor.identityId,
        kind: 'user',
        provider: 'email',
        activate: true,
      });
      await identities.enrollAccount(
        actor.identityId,
        'Notification member',
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
    const target = { kind: 'article', id: randomUUID() };
    const content = { displayName: 'Member', text: 'A public contribution' };
    const topic = await commands.create(
      { content, subjectId: target.id, target },
      owner,
      randomUUID()
    );
    const reply = (actor = peer, parent = topic.id, key = randomUUID()) =>
      commands.reply(parent, content, actor, key, target);
    const row = async (id) =>
      (
        await source.query(
          'SELECT * FROM discussion_reply_notifications WHERE id=?',
          [id]
        )
      )[0];
    const workerActor = {
      identityId: 'wapps-notification-worker',
      tenantId: 'notifications',
      roles: ['notification:worker'],
    };
    let parentVisible = true;
    const endpoint = new DiscussionReplyNotifications(
      journal,
      {
        select: async (targets) =>
          parentVisible
            ? targets.map((target) => ({
                target,
                title: 'Current article',
                slug: 'current-article',
              }))
            : [],
      },
      policy,
      'default'
    );
    const transport = {
      claim: async () =>
        (await endpoint.execute({ operation: 'claim' }, workerActor)).lease,
      settle: async (id, token, failed) => {
        await endpoint.execute(
          { operation: failed ? 'defer' : 'ack', id, token },
          workerActor
        );
      },
      resolve: async (recipientId, ids) =>
        (
          await endpoint.execute(
            { operation: 'resolve', recipientId, ids },
            workerActor
          )
        ).items,
    };
    const delivery = new DeliverReplyNotifications(transport, inbox);
    const service = new ReplyInboxService(authority, inbox, transport);
    const context = (actor = owner) => ({
      identityId: actor.identityId,
      timestamp: at,
      subject: { roles: [] },
    });
    const preferences = async (enabled) => {
      const current = await identities.getPreferences(owner.identityId);
      current.preferences.notifications.inApp.discussionReplies = enabled;
      await identities.updatePreferences(
        owner.identityId,
        {
          expectedRevision: current.revision,
          preferences: current.preferences,
        },
        randomUUID()
      );
    };

    // Reply, aggregate revision, payload binding, outbox and delivery intent share one transaction.
    const before = await writes.resource(topic.id);
    await source.query(
      "CREATE TRIGGER reject_notification BEFORE INSERT ON discussion_reply_notifications FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected notification failure'"
    );
    const commandKey = randomUUID();
    try {
      await assert.rejects(reply(peer, topic.id, commandKey));
    } finally {
      await source.query('DROP TRIGGER reject_notification');
    }
    assert.deepEqual(await writes.resource(topic.id), before);
    assert.equal(
      (
        await source.query(
          'SELECT nodeId FROM discussion_write_nodes WHERE discussionId=?',
          [topic.id]
        )
      ).length,
      1
    );
    assert.equal(
      (
        await source.query(
          'SELECT id FROM discussion_outbox WHERE discussionId=?',
          [topic.id]
        )
      ).length,
      1
    );
    const committed = await reply(peer, topic.id, commandKey);
    assert.deepEqual(await reply(peer, topic.id, commandKey), committed);
    assert.equal(
      (await source.query('SELECT id FROM discussion_reply_notifications'))
        .length,
      1
    );
    assert.equal((await row(committed.id)).recipientId, owner.identityId);
    assert.equal(
      await row((await reply(owner)).id),
      undefined,
      'Self replies do not create notifications'
    );
    const unbound = await commands.create(
      { content: 'Unbound public conversation', visibility: 'public' },
      owner,
      randomUUID()
    );
    await commands.reply(unbound.id, 'Peer unbound reply', peer, randomUUID());
    assert.equal(
      (await source.query('SELECT id FROM discussion_reply_notifications'))
        .length,
      1
    );
    console.log(
      'PASS: reply intent is atomic, replay-safe, public-target-only and excludes self replies'
    );

    const claims = await Promise.all([journal.claim(), journal.claim()]);
    const first = claims.find(Boolean);
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(first.event.id, committed.id);
    assert.equal(
      await journal.settle(first.event.id, randomUUID(), false),
      'superseded'
    );
    await inbox.receive(first.event, true); // Simulate a worker crash after committing the inbox, before ack.
    at = first.until;
    assert.equal(
      await journal.settle(first.event.id, first.token, false),
      'superseded'
    );
    assert.equal(await delivery.advance(), true);
    assert.equal(Number((await row(committed.id)).attempts), 2);
    assert.equal((await inbox.list(owner.identityId, null)).entries.length, 1);
    assert.deepEqual(
      (await service.list({}, context())).value.items.map((item) => item.id),
      [committed.id]
    );
    assert.deepEqual(
      (await service.list({}, context(sibling))).value.items,
      []
    );
    const read = await inbox.markRead(owner.identityId, committed.id);
    at += 100;
    assert.deepEqual(
      await inbox.markRead(owner.identityId, committed.id),
      read
    );
    await assert.rejects(inbox.markRead(sibling.identityId, committed.id));
    await assert.rejects(
      inbox.receive(
        { ...first.event, revision: first.event.revision + 1 },
        true
      ),
      CanonicalIdentityConflict
    );
    const reconnected = await new DataSource({
      ...account.options,
      migrations: [],
    }).initialize();
    try {
      assert.equal(
        (
          await new MysqlReplyInbox(reconnected, now).list(
            owner.identityId,
            null
          )
        ).entries[0].readAt,
        read.readAt
      );
    } finally {
      await reconnected.destroy();
    }
    console.log(
      'PASS: exclusive expiring leases, exact duplicate receipts, lost ack, cross-account denial and restart'
    );

    await preferences(false);
    const suppressed = await reply();
    assert.equal(await delivery.advance(), true);
    await preferences(true);
    const suppressedRow = await row(suppressed.id);
    const suppressedEvent = {
      id: suppressed.id,
      recipientId: owner.identityId,
      discussionId: topic.id,
      parentId: topic.id,
      revision: Number(suppressedRow.revision),
      at: Number(suppressedRow.createdAt),
    };
    assert.equal(await inbox.receive(suppressedEvent, true), 'suppressed');
    assert.equal((await inbox.list(owner.identityId, null)).entries.length, 1);
    parentVisible = false;
    const hidden = await reply();
    await delivery.advance();
    assert.equal((await service.list({}, context())).value.items.length, 0);
    parentVisible = true;
    assert.equal((await service.list({}, context())).value.items.length, 1);
    await source.query("UPDATE content_nodes SET state='archived' WHERE id=?", [
      committed.id,
    ]);
    assert.equal((await service.list({}, context())).value.items.length, 0);
    assert.ok(
      (await row(hidden.id)).deliveredAt !== null,
      'Hidden events are acknowledged only after durable suppression'
    );
    console.log(
      'PASS: opt-out and hidden sources produce non-revivable receipts; inbox checks current public visibility'
    );

    const crash = await reply();
    for (let attempt = 1; attempt <= 12; attempt++) {
      const lease = await journal.claim();
      assert.equal(lease.event.id, crash.id);
      assert.equal(Number((await row(crash.id)).attempts), attempt);
      at = lease.until;
    }
    assert.equal(await journal.claim(), null);
    const failed = await row(crash.id);
    assert.equal(Number(failed.failedAt), at);
    assert.equal((await journal.status()).failed[0].id, crash.id);
    assert.equal(await journal.requeue(crash.id, at - 1), false);
    assert.equal(await journal.requeue(crash.id, at), true);
    assert.equal(await journal.requeue(crash.id, at), false);
    const reset = await journal.claim();
    assert.equal(reset.event.id, crash.id);
    assert.equal(Number((await row(crash.id)).attempts), 1);
    await journal.settle(reset.event.id, reset.token, true);
    assert.equal(await journal.claim(), null);
    at = Number((await row(crash.id)).availableAt);
    await delivery.advance();
    console.log(
      'PASS: crash attempts quarantine at 12; reviewed requeue and delayed explicit retries converge'
    );

    const accountExport = records(
      await collect(
        new MysqlAccountExportSource(account).capture(
          owner.identityId,
          new AbortController().signal
        )
      )
    );
    const discussionExport = records(
      await collect(
        new MysqlDiscussionAccountExportSource(
          source,
          new MinioDiscussionExportPayloads(minio)
        ).capture(owner.identityId, new AbortController().signal)
      )
    );
    assert.equal(accountExport.length, 4);
    assert.equal(discussionExport.length, 4);
    assert.equal(accountExport.filter((entry) => !entry.delivered).length, 2);
    assert.ok(
      discussionExport.every(
        (entry) =>
          entry.event.recipientId === owner.identityId &&
          !('leaseToken' in entry)
      )
    );

    for (let count = 0; count < 130; count++)
      await inbox.receive(
        { ...first.event, id: randomUUID(), at: at + count },
        true
      );
    const page = await inbox.list(owner.identityId, null);
    assert.equal(page.entries.length, 11);
    const cursor = page.entries[9].event;
    const next = await inbox.list(owner.identityId, {
      at: cursor.at,
      id: cursor.id,
    });
    assert.ok(
      next.entries.every(
        (entry) =>
          !page.entries
            .slice(0, 10)
            .some((previous) => previous.event.id === entry.event.id)
      )
    );
    const tombstone = await identities.requestDeletion(owner.identityId);
    const erasure = {
      identityId: owner.identityId,
      revision: tombstone.revision,
    };
    await new MysqlAccountErasureParticipant('account', account).request(
      erasure
    );
    const cleanup = new MysqlAccountErasureCleanup(account);
    assert.equal(await cleanup.advance(erasure), 'pending');
    assert.equal(await cleanup.advance(erasure), 'completed');
    assert.equal(await inbox.receive(first.event, true), 'suppressed');
    assert.equal(
      (
        await account.query(
          'SELECT id FROM identity_reply_notifications WHERE identityId=?',
          [owner.identityId]
        )
      ).length,
      0
    );
    await assert.rejects(
      inbox.list(owner.identityId, null),
      CanonicalIdentityAccessDenied
    );
    await new MysqlAccountErasureParticipant('discussion', source).request(
      erasure
    );
    assert.equal(
      await row((await reply()).id),
      undefined,
      'Erased optional recipient does not deny a valid peer reply'
    );
    const {
      InventoryDiscussionPayloads,
    } = require(`${root}application/discussion-payload-inventory`);
    const {
      MysqlDiscussionPayloadInventory,
    } = require(`${root}infrastructure/mysql-discussion-payload-inventory`);
    const {
      MinioDiscussionPayloadInventory,
    } = require(`${root}infrastructure/minio-discussion-payload-inventory`);
    const inventory = new InventoryDiscussionPayloads(
      new MysqlDiscussionPayloadInventory(source),
      new MinioDiscussionPayloadInventory(minio)
    );
    for (let page = 0; page < 10; page++) {
      const plan = await inventory.plan();
      const progress = await inventory.apply(plan.fingerprint, true);
      if (progress.completedAt !== null) break;
      assert.ok(page < 9, 'Payload inventory did not finish');
    }
    const erasureObjects = new MinioDiscussionErasurePayloads(minio);
    const authorCleanup = new AnonymizeDiscussionContributions(
      new MysqlDiscussionContributionErasure(source),
      {
        read: (...args) => erasureObjects.read(...args),
        put: async (ref, body) => {
          uploaded.push(ref.key);
          await erasureObjects.put(ref, body);
        },
      }
    );
    for (let count = 0; await authorCleanup.advance(erasure); count++)
      assert.ok(count < 20);
    await new MysqlDiscussionPrivateErasure(source).advance(erasure);
    assert.equal(
      (
        await source.query(
          'SELECT id FROM discussion_reply_notifications WHERE recipientId=?',
          [owner.identityId]
        )
      ).length,
      0
    );
    assert.equal(
      await row((await reply()).id),
      undefined,
      'Anonymized parent cannot receive later notifications'
    );
    console.log(
      'PASS: bounded inbox paging, both private exports, batched account cleanup and permanent source recipient erasure'
    );

    const keptTopic = await commands.create(
      { content, subjectId: target.id, target },
      peer,
      randomUUID()
    );
    const keptReply = await reply(sibling, keptTopic.id);
    await delivery.advance();
    for (const [db, migration, table, index] of [
      [
        source,
        new ReplyNotifications1791840015000(),
        'discussion_reply_notifications',
        'idx_reply_delivery',
      ],
      [
        account,
        new AccountNotifications1791840016000(),
        'identity_reply_notifications',
        'idx_inbox_page',
      ],
    ]) {
      const runner = db.createQueryRunner();
      await runner.connect();
      try {
        await migration.up(runner);
        await migration.up(runner);
        const timeColumn =
          table === 'discussion_reply_notifications'
            ? 'availableAt'
            : 'receivedAt';
        const [stored] = await runner.query(
          `SELECT ${timeColumn} value FROM ${table} WHERE id=?`,
          [keptReply.id]
        );
        await runner.query(
          `UPDATE ${table} SET ${timeColumn}=8640000000000001 WHERE id=?`,
          [keptReply.id]
        );
        await assert.rejects(migration.up(runner), /timestamp/);
        await runner.query(`UPDATE ${table} SET ${timeColumn}=? WHERE id=?`, [
          stored.value,
          keptReply.id,
        ]);

        await runner.query(
          `ALTER TABLE ${table} ALTER INDEX ${index} INVISIBLE`
        );
        await assert.rejects(migration.up(runner), /index/);
        await runner.query(`ALTER TABLE ${table} ALTER INDEX ${index} VISIBLE`);
        await runner.query(
          `RENAME TABLE ${table} TO notification_schema_probe`
        );
        await assert.rejects(migration.up(runner), /is missing/);
        await runner.query(
          `RENAME TABLE notification_schema_probe TO ${table}`
        );
        await migration.up(runner);
        await assert.rejects(migration.down());
      } finally {
        await runner.release();
      }
    }
    console.log(
      'PASS: real MySQL migration replay, physical index validation and applied-journal loss refusal'
    );
  } finally {
    if (account.isInitialized) await account.destroy();
    await source.query(`DROP DATABASE ${database}`);
  }
};
