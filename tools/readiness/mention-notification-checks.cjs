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
  MysqlMentionNotifications,
  mentionNotificationJournalRow,
} = require(`${root}infrastructure/mysql-mention-notifications`);
const {
  MentionNotifications1791864016000,
} = require(`${root}infrastructure/mention-notifications.migration`);
const {
  DiscussionMentionNotifications,
} = require(`${root}application/mention-notifications`);
const {
  MysqlDiscussionAccountExportSource,
} = require(`${root}infrastructure/mysql-discussion-account-export-source`);
const {
  MinioDiscussionExportPayloads,
} = require(`${root}infrastructure/discussion-export-payloads`);
const {
  MysqlDiscussionPrivateErasure,
} = require(`${root}infrastructure/mysql-discussion-private-erasure`);
const {
  identityDataSource,
  MysqlCanonicalIdentities,
  MysqlMentionInbox,
  MysqlAccountExportSource,
  MysqlAccountErasureCleanup,
  MysqlAccountErasureParticipant,
  AccountMentions1791864017000,
} = require('../../libs/adapters/account-mysql/src');
const {
  DeliverMentionNotifications,
  MentionInboxService,
} = require('../../libs/usecases/account/src');
const {
  AuthorityValidationService,
} = require('../../sdk/kernel/ontology/authority/src');
const {
  CanonicalIdentityConflict,
  CanonicalIdentityAccessDenied,
} = require('../../sdk/features/identity/core/src');

const collect = async (stream) => {
  const rows = [];
  for await (const row of stream) rows.push(row);
  return rows
    .filter(
      (row) =>
        row.type === 'record' && row.collection === 'mention-notifications'
    )
    .map((row) => row.data);
};

module.exports = async function qualifyMentions({ source, minio, uploaded }) {
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
    const inbox = new MysqlMentionInbox(account, now);
    const journal = new MysqlMentionNotifications(source, now);
    const policy = { evaluate: async () => ({ ok: true, value: true }) };
    const authority = new (class extends AuthorityValidationService {})(policy);
    const author = {
      identityId: 'MentionAuthor',
      tenantId: 'default',
      roles: ['discussion:writer'],
    };
    const recipient = 'MentionRecipient',
      second = 'SecondMentionRecipient',
      third = 'ThirdMentionRecipient';
    const profileIds = [1, 2, 3].map(
      (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
    );
    const mapping = profileIds.map((profileId, n) => ({
      profileId,
      identityId: [recipient, second, third][n],
    }));
    for (const uid of [author.identityId, recipient, second, third]) {
      await identities.ensure({
        uid,
        kind: 'user',
        provider: 'email',
        activate: true,
      });
      await identities.enrollAccount(uid, 'Mention member', randomUUID());
    }
    let directoryAvailable = true,
      audienceVisible = true,
      parentVisible = true;
    const directory = {
      resolve: async (authorId, ids) => {
        assert.equal(authorId, author.identityId);
        if (!directoryAvailable)
          throw new Error('Account directory unavailable');
        return audienceVisible
          ? mapping.filter((row) => ids.includes(row.profileId))
          : [];
      },
    };
    const registry = new RegisteredDiscussionPayloads(
      new MysqlDiscussionPayloads(source),
      new MinioDiscussionPayloadObjects(minio)
    );
    const writes = new MysqlDiscussionWrites(source);
    const commands = new DurableDiscussionCommands(
      writes,
      {
        put: async (...args) => {
          const ref = await registry.put(...args);
          uploaded.push(ref.key);
          return ref;
        },
      },
      policy,
      { generate: randomUUID },
      { visible: async () => true },
      directory
    );
    const target = { kind: 'application', id: randomUUID() };
    const content = {
      title: 'Mention qualification',
      tags: [],
      displayName: 'Author',
      text: 'A public contribution',
      mentions: profileIds.slice(0, 2),
    };
    const create = (key = randomUUID()) =>
      commands.create({ content, subjectId: target.id, target }, author, key);
    const row = async (id) =>
      (
        await source.query(
          'SELECT * FROM discussion_mention_notifications WHERE id=?',
          [id]
        )
      )[0];
    const events = async (nodeId) =>
      source.query(
        'SELECT * FROM discussion_mention_notifications WHERE nodeId=? ORDER BY recipientId',
        [nodeId]
      );
    const worker = {
      identityId: 'wapps-notification-worker',
      tenantId: 'notifications',
      roles: ['notification:worker'],
    };
    const endpoint = new DiscussionMentionNotifications(
      journal,
      {
        select: async (targets) =>
          parentVisible
            ? targets.map((target) => ({
                target,
                title: 'Current application',
                slug: 'current-application',
              }))
            : [],
      },
      policy,
      'default',
      directory
    );
    const transport = {
      claim: async () =>
        (await endpoint.execute({ operation: 'claim' }, worker)).lease,
      settle: async (id, token, failed) => {
        await endpoint.execute(
          { operation: failed ? 'defer' : 'ack', id, token },
          worker
        );
      },
      resolve: async (recipientId, ids) =>
        (
          await endpoint.execute(
            { operation: 'resolve', recipientId, ids },
            worker
          )
        ).items,
    };
    const delivery = new DeliverMentionNotifications(transport, inbox);
    const service = new MentionInboxService(authority, inbox, transport);
    const list = async (uid = recipient) => {
      const result = await service.list(
        {},
        { identityId: uid, timestamp: at, subject: { roles: [] } }
      );
      if (!result.ok) throw result.error;
      return result.value;
    };
    const preference = async (uid, enabled) => {
      const current = await identities.getPreferences(uid);
      current.preferences.notifications.inApp.discussionMentions = enabled;
      await identities.updatePreferences(
        uid,
        {
          expectedRevision: current.revision,
          preferences: current.preferences,
        },
        randomUUID()
      );
    };

    // Failure after the first recipient insert must roll back the entire public write.
    await source.query(
      `CREATE TRIGGER reject_mention BEFORE INSERT ON discussion_mention_notifications FOR EACH ROW BEGIN IF NEW.recipientId='SecondMentionRecipient' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected mention failure'; END IF; END`
    );
    const key = randomUUID();
    try {
      await assert.rejects(create(key), /injected mention failure/);
    } finally {
      await source.query('DROP TRIGGER reject_mention');
    }
    for (const table of [
      'discussion_write_nodes',
      'discussion_write_aggregates',
      'discussion_outbox',
      'discussion_commands',
      'discussion_mention_notifications',
    ])
      assert.equal(
        (await source.query(`SELECT * FROM ${table}`)).length,
        0,
        `${table} rolls back atomically`
      );
    const topic = await create(key);
    directoryAvailable = false;
    assert.deepEqual(
      await create(key),
      topic,
      'Exact replay does not call Account again'
    );
    directoryAvailable = true;
    const original = await events(topic.id);
    assert.equal(original.length, 2);
    for (const event of original) {
      assert.notEqual(event.id, topic.id);
      assert.equal(event.nodeId, topic.id);
      assert.equal(Number(event.revision), 1);
    }
    assert.notEqual(original[0].id, original[1].id);
    console.log(
      'PASS: root mentions commit atomically with payload, revision, receipt and outbox; one independent event per recipient'
    );

    const leases = await Promise.all([
      journal.claim(),
      journal.claim(),
      journal.claim(),
    ]);
    assert.equal(leases.filter(Boolean).length, 2);
    assert.equal(
      new Set(leases.filter(Boolean).map((lease) => lease.event.id)).size,
      2
    );
    const first = leases.find(Boolean),
      other = leases.filter(Boolean)[1];
    await inbox.receive(first.event, true);
    await inbox.receive(other.event, true);
    await journal.settle(other.event.id, other.token, false);
    assert.equal(
      await journal.settle(first.event.id, randomUUID(), false),
      'superseded'
    );
    at = first.until;
    assert.equal(
      await journal.settle(first.event.id, first.token, false),
      'superseded'
    );
    await delivery.advance();
    assert.equal(Number((await row(first.event.id)).attempts), 2);
    assert.equal((await list()).items.length, 1);
    assert.equal((await list(second)).items.length, 1);
    assert.equal((await list(author.identityId)).items.length, 0);
    const notification = (await list()).items[0];
    assert.equal(notification.nodeId, topic.id);
    assert.equal(notification.discussionId, topic.id);
    const read = await inbox.markRead(recipient, notification.id);
    await assert.rejects(inbox.markRead(second, notification.id));
    await assert.rejects(
      inbox.receive({ ...first.event, revision: 9 }, true),
      CanonicalIdentityConflict
    );
    const reopened = await new DataSource({
      ...account.options,
      migrations: [],
    }).initialize();
    try {
      assert.equal(
        (await new MysqlMentionInbox(reopened, now).list(recipient, null))
          .entries[0].readAt,
        read.readAt
      );
    } finally {
      await reopened.destroy();
    }
    console.log(
      'PASS: concurrent claims, expired leases, lost ack, exact duplicate receipts, self-only inbox and restart persistence'
    );

    let revision = topic.revision;
    const edit = async (mentions) => {
      const result = await commands.update(
        topic.id,
        { content: { ...content, mentions }, expectedRevision: revision },
        author,
        randomUUID(),
        target
      );
      revision = result.revision;
    };
    await edit([]);
    assert.equal((await list()).items.length, 0);
    assert.ok((await events(topic.id)).every((row) => row.active === 0));
    await edit(profileIds.slice(0, 2));
    assert.equal((await events(topic.id)).length, 2);
    assert.equal((await list()).items[0].id, notification.id);
    assert.equal((await list()).items[0].readAt, read.readAt);
    assert.equal(
      await journal.claim(),
      null,
      'Re-add does not recreate a delivered event'
    );
    audienceVisible = false;
    assert.equal((await list()).items.length, 0);
    audienceVisible = true;
    parentVisible = false;
    assert.equal((await list()).items.length, 0);
    parentVisible = true;
    directoryAvailable = false;
    await assert.rejects(list(), /unavailable/);
    directoryAvailable = true;
    await preference(third, false);
    await edit(profileIds);
    assert.equal(await delivery.advance(), true);
    const thirdEvent = (await events(topic.id)).find(
      (row) => row.recipientId === third
    );
    await preference(third, true);
    assert.equal(
      await inbox.receive(
        mentionNotificationJournalRow(thirdEvent).event,
        true
      ),
      'suppressed'
    );
    assert.equal((await list(third)).items.length, 0);
    console.log(
      'PASS: edits notify only newly mentioned members; remove/re-add preserves receipts, profile/parent privacy is current, opt-out suppression is durable'
    );

    const reply = async () =>
      commands.reply(
        topic.id,
        {
          displayName: 'Author',
          text: 'New reply mentioning a member',
          mentions: [profileIds[0]],
        },
        author,
        randomUUID(),
        target
      );
    const retryPost = await reply();
    const retryId = (await events(retryPost.id))[0].id;
    directoryAvailable = false;
    await assert.rejects(delivery.advance(), /unavailable/);
    assert.equal((await row(retryId)).deliveredAt, null);
    directoryAvailable = true;
    at = Number((await row(retryId)).availableAt);
    for (let attempt = 2; attempt <= 12; attempt++) {
      const lease = await journal.claim();
      assert.equal(lease.event.id, retryId);
      assert.equal(Number((await row(retryId)).attempts), attempt);
      at = lease.until;
    }
    assert.equal(await journal.claim(), null);
    assert.equal(Number((await row(retryId)).failedAt), at);
    assert.equal(await journal.requeue(retryId, at - 1), false);
    assert.equal(await journal.requeue(retryId, at), true);
    assert.equal(await journal.requeue(retryId, at), false);
    await delivery.advance();
    const removed = await reply();
    const removedEvent = (await events(removed.id))[0];
    await commands.remove(
      removed.id,
      removed.revision,
      author,
      randomUUID(),
      target
    );
    await delivery.advance();
    assert.equal((await row(removedEvent.id)).active, 0);
    assert.equal(
      (await list()).items.some((item) => item.nodeId === removed.id),
      false
    );
    console.log(
      'PASS: source outages defer delivery; crashed attempts quarantine at twelve; exact requeue converges; deleted posts suppress pending alerts'
    );

    const accountRows = await collect(
      new MysqlAccountExportSource(account).capture(
        recipient,
        new AbortController().signal
      )
    );
    const sourceRows = await collect(
      new MysqlDiscussionAccountExportSource(
        source,
        new MinioDiscussionExportPayloads(minio)
      ).capture(recipient, new AbortController().signal)
    );
    assert.equal(accountRows.length, 3);
    assert.equal(sourceRows.length, 3);
    assert.ok(
      sourceRows.every(
        (row) => row.event.recipientId === recipient && !('token' in row)
      )
    );
    assert.equal(accountRows.filter((row) => !row.delivered).length, 1);

    for (let n = 0; n < 130; n++)
      await inbox.receive(
        {
          ...first.event,
          recipientId: recipient,
          id: randomUUID(),
          at: at + n,
        },
        true
      );
    const page = await inbox.list(recipient, null),
      cursor = page.entries[9].event;
    assert.equal(page.entries.length, 11);
    const next = await inbox.list(recipient, { at: cursor.at, id: cursor.id });
    assert.ok(
      next.entries.every(
        (row) =>
          !page.entries
            .slice(0, 10)
            .some((other) => other.event.id === row.event.id)
      )
    );
    const tombstone = await identities.requestDeletion(recipient);
    const erasure = { identityId: recipient, revision: tombstone.revision };
    await new MysqlAccountErasureParticipant('account', account).request(
      erasure
    );
    const cleanup = new MysqlAccountErasureCleanup(account);
    assert.equal(await cleanup.advance(erasure), 'pending');
    assert.equal(await cleanup.advance(erasure), 'completed');
    assert.equal(
      (
        await account.query(
          'SELECT id FROM identity_mention_notifications WHERE identityId=?',
          [recipient]
        )
      ).length,
      0
    );
    assert.equal(
      await inbox.receive({ ...first.event, recipientId: recipient }, true),
      'suppressed'
    );
    await assert.rejects(
      inbox.list(recipient, null),
      CanonicalIdentityAccessDenied
    );
    await new MysqlAccountErasureParticipant('discussion', source).request(
      erasure
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
      assert.ok(page < 9, 'Payload inventory must complete');
    }
    await new MysqlDiscussionPrivateErasure(source).advance(erasure);
    assert.equal(
      (
        await source.query(
          'SELECT id FROM discussion_mention_notifications WHERE recipientId=?',
          [recipient]
        )
      ).length,
      0
    );
    assert.equal(
      (await events((await reply()).id)).length,
      0,
      'Stale directory mappings cannot recreate erased recipients'
    );
    console.log(
      'PASS: source and Account exports, bounded paging/erasure, late worker suppression and permanent source barriers'
    );

    for (const [db, migration, table, index] of [
      [
        source,
        new MentionNotifications1791864016000(),
        'discussion_mention_notifications',
        'idx_mention_delivery',
      ],
      [
        account,
        new AccountMentions1791864017000(),
        'identity_mention_notifications',
        'idx_mention_inbox_page',
      ],
    ]) {
      const runner = db.createQueryRunner();
      await runner.connect();
      try {
        await migration.up(runner);
        await migration.up(runner);
        const column = table.startsWith('discussion')
          ? 'availableAt'
          : 'receivedAt';
        const [saved] = await runner.query(
          `SELECT id,${column} value FROM ${table} LIMIT 1`
        );
        assert.ok(saved);
        await runner.query(
          `UPDATE ${table} SET ${column}=8640000000000001 WHERE id=?`,
          [saved.id]
        );
        await assert.rejects(migration.up(runner), /timestamp/);
        await runner.query(`UPDATE ${table} SET ${column}=? WHERE id=?`, [
          saved.value,
          saved.id,
        ]);
        await runner.query(`ALTER TABLE ${table} DROP INDEX ${index}`);
        await assert.rejects(migration.up(runner), /index/i);
      } finally {
        await runner.release();
      }
    }
    console.log(
      'PASS: restart-safe additive migrations reject invalid retained timestamps and missing delivery indexes'
    );
  } finally {
    if (account.isInitialized) await account.destroy();
    await source.query(`DROP DATABASE ${database}`);
  }
};
