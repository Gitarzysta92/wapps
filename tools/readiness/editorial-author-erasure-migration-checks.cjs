const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  EditorialAuthorErasure1791840010000,
} = require('../../apps/services/editorial/src/app/account-erasure/editorial-author-erasure.migration');

module.exports = async function editorialAuthorErasureMigrationChecks({
  source: host,
  pass,
}) {
  assert.equal(host.options.database, 'suites');
  const database = 'wapps_author_erasure_' + randomUUID().replaceAll('-', '');
  const migrations = host.options.migrations.slice(
    0,
    host.options.migrations.indexOf(EditorialAuthorErasure1791840010000)
  );
  const connect = (list) =>
    new DataSource({
      ...host.options,
      database,
      entities: [],
      migrations: list,
      migrationsRun: false,
    }).initialize();
  await host.query(`CREATE DATABASE \`${database}\``);
  let source, runner;
  const migration = new EditorialAuthorErasure1791840010000();
  try {
    source = await connect(migrations);
    await source.runMigrations();
    const ids = Array.from({ length: 130 }, () => randomUUID()).sort();
    for (const [i, id] of ids.entries()) {
      await source.query('INSERT INTO tags (id,name,slug) VALUES (?,?,?)', [
        id,
        'Retained taxonomy',
        'legacy-erasure-' + i,
      ]);
      await source.query(
        "INSERT INTO editorial_resource_states (resourceKind,resourceId,tenantId,ownerIdentityId,revision,deletedAt) VALUES ('tag',?,'default','LegacyAuthor',1,NULL)",
        [id]
      );
    }
    runner = source.createQueryRunner();
    await source.query(
      'UPDATE editorial_resource_states SET revision=0 WHERE resourceId=?',
      [ids[129]]
    );
    await assert.rejects(migration.up(runner), /integer|revision/i);
    assert.equal(
      (await runner.getTable('editorial_resource_states')).findColumnByName(
        'ownerIdentityId'
      ).isNullable,
      false
    );
    assert.equal(await runner.hasTable('editorial_erasure_resources'), false);
    await source.query(
      'UPDATE editorial_resource_states SET revision=1 WHERE resourceId=?',
      [ids[129]]
    );
    const query = runner.query.bind(runner);
    runner.query = async (sql, ...args) => {
      const result = await query(sql, ...args);
      if (sql.startsWith('ALTER TABLE editorial_resource_states MODIFY'))
        throw new Error('Interrupted after committed nullable DDL');
      return result;
    };
    await assert.rejects(
      migration.up(runner),
      /Interrupted after committed nullable DDL/
    );
    runner.query = query;
    assert.equal(
      (await runner.getTable('editorial_resource_states')).findColumnByName(
        'ownerIdentityId'
      ).isNullable,
      true
    );
    assert.equal(
      (await runner.getTable('editorial_outbox')).findColumnByName(
        'actorIdentityId'
      ).isNullable,
      false
    );
    await runner.release();
    runner = null;
    await source.destroy();
    source = await connect([
      ...migrations,
      EditorialAuthorErasure1791840010000,
    ]);
    await source.runMigrations();
    runner = source.createQueryRunner();
    await migration.up(runner);
    assert.equal(
      Number(
        (
          await source.query(
            'SELECT COUNT(*) n FROM editorial_resource_states WHERE ownerIdentityId=?',
            ['LegacyAuthor']
          )
        )[0].n
      ),
      130
    );
    assert.equal(
      Number(
        (await source.query('SELECT COUNT(*) n FROM editorial_outbox'))[0].n
      ),
      0
    );
    pass(
      'migration validates beyond one 128-row page before DDL and resumes after committed MySQL DDL interruption without changing content, owners, revisions or creating events'
    );

    await source.query(
      'ALTER TABLE editorial_outbox MODIFY actorIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL'
    );
    await assert.rejects(
      migration.up(runner),
      /Applied Editorial anonymous identity schema is missing/
    );
    await source.query(
      'ALTER TABLE editorial_outbox MODIFY actorIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
    );
    await source.query(
      'RENAME TABLE editorial_erasure_resources TO qualification_saved_targets'
    );
    await assert.rejects(
      migration.up(runner),
      /Applied Editorial erasure targets are missing/
    );
    await source.query(
      'RENAME TABLE qualification_saved_targets TO editorial_erasure_resources'
    );
    await source.query(
      'DROP INDEX idx_editorial_erasure_owner ON editorial_resource_states'
    );
    await assert.rejects(
      migration.up(runner),
      /Incompatible Editorial erasure index/
    );
    await source.query(
      'CREATE INDEX idx_editorial_erasure_owner ON editorial_resource_states (ownerIdentityId(10),resourceKind,resourceId)'
    );
    await assert.rejects(
      migration.up(runner),
      /Incompatible Editorial erasure index/
    );
    await source.query(
      'DROP INDEX idx_editorial_erasure_owner ON editorial_resource_states'
    );
    await source.query(
      'CREATE INDEX idx_editorial_erasure_owner ON editorial_resource_states (ownerIdentityId,resourceKind,resourceId)'
    );
    await source.query(
      'ALTER TABLE editorial_resource_states ALTER INDEX idx_editorial_erasure_owner INVISIBLE'
    );
    await assert.rejects(
      migration.up(runner),
      /Incompatible Editorial erasure index/
    );
    await source.query(
      'ALTER TABLE editorial_resource_states ALTER INDEX idx_editorial_erasure_owner VISIBLE'
    );
    await source.query(
      'ALTER TABLE editorial_erasure_resources MODIFY identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL'
    );
    await assert.rejects(
      migration.up(runner),
      /Incompatible Editorial erasure target/
    );
    await source.query(
      'ALTER TABLE editorial_erasure_resources MODIFY identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL'
    );
    await migration.up(runner);
    pass(
      'applied migration refuses missing nullable schema/targets, missing/prefix/invisible indexes and case-insensitive target identity storage; repaired schema revalidates'
    );
  } finally {
    await runner?.release();
    if (source?.isInitialized) await source.destroy();
    await host.query(`DROP DATABASE \`${database}\``);
  }
};
