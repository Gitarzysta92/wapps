const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = '../../apps/services/community/src/app/discussions/';
const {
  CommunityDiscussionBindingKeys1792080000000,
} = require(`${root}infrastructure/discussion-binding-keys.migration`);
const {
  DurableDiscussionCommands,
} = require(`${root}application/durable-discussion-commands`);
const {
  materializeDiscussion,
} = require('../../sdk/features/discussion/applications/materializer/service/src/materialization');

module.exports = async function qualifyDiscussionBindings({
  source,
  writes,
  payloads,
  policy,
  ids,
  actor,
  reader,
  loader,
  store,
  nodes,
  heads,
}) {
  assert.match(source.options.database, /^wapps_readiness_[0-9a-f]{32}$/);
  const commands = new DurableDiscussionCommands(
    writes,
    payloads,
    policy,
    ids,
    { visible: async () => true }
  );
  const target = { kind: 'application', id: randomUUID() };
  const input = {
    target,
    subjectId: target.id,
    content: {
      title: 'Historical topic',
      text: 'Retained body',
      displayName: 'Owner',
      tags: [],
    },
  };
  const receipt = await commands.create(input, actor, 'opaque-key-historical');
  const expectedKey = `${target.kind}:${target.id}`;
  await materializeDiscussion(receipt.id, reader, loader, store);
  const oldSnapshot = await reader.read(receipt.id);
  delete oldSnapshot.bindingKey;
  const legacyGeneration = `${receipt.id}:1:${'a'.repeat(64)}`;
  await nodes.updateMany(
    { discussionId: receipt.id },
    { $set: { schemaVersion: 3, generation: legacyGeneration } }
  );
  await heads.updateOne(
    { _id: receipt.id },
    {
      $set: {
        schemaVersion: 3,
        generation: legacyGeneration,
        fingerprint: 'a'.repeat(64),
        subjectKind: 'application',
      },
      $unset: { bindingKey: '' },
    }
  );
  await source.query('DELETE FROM migrations WHERE name=?', [
    'CommunityDiscussionBindingKeys1792080000000',
  ]);
  await source.query(
    'UPDATE discussion_write_aggregates SET bindingKey=NULL WHERE id=?',
    [receipt.id]
  );
  const before = await source.query(
    'SELECT * FROM discussion_commands WHERE commandKey=?',
    ['opaque-key-historical']
  );
  const [originalOutbox] = await source.query(
    'SELECT COUNT(*) AS total FROM discussion_outbox WHERE discussionId=?',
    [receipt.id]
  );
  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    await source.query(
      `CREATE TRIGGER reject_binding_rebuild BEFORE INSERT ON discussion_outbox FOR EACH ROW BEGIN IF NEW.discussionId = '${receipt.id}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Injected binding rebuild failure'; END IF; END`
    );
    await assert.rejects(
      new CommunityDiscussionBindingKeys1792080000000().up(runner),
      /Injected binding rebuild failure/
    );
    await source.query('DROP TRIGGER reject_binding_rebuild');
    const [failed] = await source.query(
      'SELECT bindingKey FROM discussion_write_aggregates WHERE id=?',
      [receipt.id]
    );
    assert.equal(
      failed.bindingKey,
      null,
      'Binding and rebuild intent must roll back together'
    );
    const [failedOutbox] = await source.query(
      'SELECT COUNT(*) AS total FROM discussion_outbox WHERE discussionId=?',
      [receipt.id]
    );
    assert.equal(Number(failedOutbox.total), Number(originalOutbox.total));
    await new CommunityDiscussionBindingKeys1792080000000().up(runner);
    await source.runMigrations({ transaction: 'each' });
    const [migrated] = await source.query(
      'SELECT bindingKey, revision FROM discussion_write_aggregates WHERE id=?',
      [receipt.id]
    );
    assert.equal(migrated.bindingKey, expectedKey);
    assert.equal(Number(migrated.revision), receipt.revision);
    assert.deepEqual(
      await source.query(
        'SELECT * FROM discussion_commands WHERE commandKey=?',
        ['opaque-key-historical']
      ),
      before
    );
    assert.deepEqual(
      await commands.create(input, actor, 'opaque-key-historical'),
      receipt
    );
    await materializeDiscussion(receipt.id, reader, loader, store);
    const current = await heads.findOne({ _id: receipt.id });
    assert.equal(current.schemaVersion, 4);
    assert.equal(current.bindingKey, expectedKey);
    assert.equal(
      Object.hasOwn(current, 'subjectKind'),
      false,
      'Rebuild removes obsolete consumer fields'
    );
    assert.equal((await nodes.findOne({ _id: receipt.id })).schemaVersion, 4);
    await assert.rejects(
      materializeDiscussion(
        receipt.id,
        { read: async () => oldSnapshot },
        loader,
        store
      ),
      /Conflicting/
    );
    assert.equal(
      (await heads.findOne({ _id: receipt.id })).bindingKey,
      expectedKey
    );
    await source.query(
      'UPDATE discussion_write_aggregates SET bindingKey=? WHERE id=?',
      ['wrong', receipt.id]
    );
    await assert.rejects(
      new CommunityDiscussionBindingKeys1792080000000().up(runner),
      /Conflicting.*binding/
    );
    await source.query(
      'UPDATE discussion_write_aggregates SET bindingKey=? WHERE id=?',
      [expectedKey, receipt.id]
    );
    await new CommunityDiscussionBindingKeys1792080000000().up(runner);
    await assert.rejects(
      new CommunityDiscussionBindingKeys1792080000000().down(),
      /forward migration/
    );
  } finally {
    await runner.release();
  }
  console.log(
    'PASS opaque binding forward migration, transaction failure/resume and original receipt replay'
  );
  console.log(
    'PASS same-revision schema upgrade, obsolete field removal and stale snapshot refusal'
  );

  const generic = new DurableDiscussionCommands(writes, payloads, policy, ids);
  const opaque = await generic.create(
    { content: { unregistered: ['format', 7] } },
    actor,
    'opaque-key-independent'
  );
  const customKey =
    'Some-External-Consumer|revision-format-9999:record/anything';
  // This isolated fixture models a different consumer's authoritative binding; the materializer has no registry.
  await source.query(
    'UPDATE discussion_write_aggregates SET bindingKey=? WHERE id=?',
    [customKey, opaque.id]
  );
  assert.equal((await reader.read(opaque.id)).bindingKey, customKey);
  await materializeDiscussion(opaque.id, reader, loader, store);
  assert.equal((await heads.findOne({ _id: opaque.id })).bindingKey, customKey);
  assert.equal((await heads.findOne({ _id: opaque.id })).subjectId, null);
  await source.query(
    'UPDATE discussion_write_aggregates SET bindingKey=? WHERE id=?',
    [customKey.toLowerCase(), opaque.id]
  );
  await assert.rejects(
    materializeDiscussion(opaque.id, reader, loader, store),
    /Conflicting/
  );
  await source.query(
    'UPDATE discussion_write_aggregates SET bindingKey=? WHERE id=?',
    [customKey, opaque.id]
  );
  assert.equal(
    await materializeDiscussion(opaque.id, reader, loader, store),
    'unchanged'
  );
  console.log(
    'PASS unknown consumer key through real SQL, immutable payload storage and Mongo materialization'
  );
};
