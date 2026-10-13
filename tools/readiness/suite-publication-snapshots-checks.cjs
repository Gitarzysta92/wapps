const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const base = '../../apps/services/editorial/src/app/';
const { SuitePublication1791676809000 } = require(base +
  'suites/suite-publication.migration');
const { SuitePublicationSnapshots1791840009000 } = require(base +
  'suites/suite-publication-snapshots.migration');
const { MysqlEditorialSnapshotReader } = require(base +
  'infrastructure/mysql-editorial-snapshot');
const { MysqlSuiteCatalog } = require(base + 'suites/mysql-suite-catalog');
const { MysqlPublicationActivity } = require(base +
  'infrastructure/mysql-profile-activity');
const { projectEditorialSnapshot } = require(base +
  'application/editorial-materialization');
const { captureEditorialPublications } = require(base +
  'account-export/editorial-export-publications');

module.exports = async function suitePublicationSnapshotsChecks({
  source: host,
  projections,
  pass,
}) {
  assert.equal(host.options.database, 'suites');
  const database = 'wapps_suite_snapshots_' + randomUUID().replaceAll('-', '');
  const legacyMigrations = host.options.migrations.slice(
    0,
    host.options.migrations.indexOf(SuitePublicationSnapshots1791840009000)
  );
  const connect = (migrations) =>
    new DataSource({
      ...host.options,
      database,
      entities: [],
      migrations,
      migrationsRun: false,
    }).initialize();
  await host.query(`CREATE DATABASE \`${database}\``);
  let source, runner;
  try {
    source = await connect(legacyMigrations);
    await source.runMigrations();
    const ids = Array.from({ length: 131 }, () => randomUUID()).sort();
    const applications = [randomUUID(), randomUUID()];
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index],
        owner = 'SnapshotOwner' + Math.floor(index / 80);
      await source.query(
        'INSERT IGNORE INTO suite_workspaces (tenantId,ownerIdentityId) VALUES (?,?)',
        ['default', owner]
      );
      await source.query(
        `INSERT INTO private_suites (id,tenantId,ownerIdentityId,title,description,applicationIds,revision,createdAt,updatedAt,deletedAt)
        VALUES (?,'default',?,?,'Private description',?,3,1,3,NULL)`,
        [
          id,
          owner,
          'Private replacement ' + index,
          JSON.stringify([...applications].reverse()),
        ]
      );
      await source.query(
        `INSERT INTO suite_submissions (suiteId,submittedRevision,tenantId,ownerIdentityId,title,description,applicationIds,status,reason,submittedAt,reviewedAt,reviewerIdentityId)
        VALUES (?,1,'default',?,?,'Approved description',?,'approved','',1,2,'IndependentStaff')`,
        [id, owner, 'Approved ' + index, JSON.stringify(applications)]
      );
      await source.query(
        'INSERT INTO suite_publications (suiteId,submittedRevision,publishedAt) VALUES (?,1,2)',
        [id]
      );
      await source.query(
        "INSERT INTO editorial_resource_states (resourceKind,resourceId,tenantId,ownerIdentityId,revision,deletedAt) VALUES ('suite',?,'default',?,1,NULL)",
        [id, owner]
      );
    }
    runner = source.createQueryRunner();
    const migration = new SuitePublicationSnapshots1791840009000();
    await source.query(
      'UPDATE suite_publications SET submittedRevision=99 WHERE suiteId=?',
      [ids[0]]
    );
    await assert.rejects(migration.up(runner), /exact approved source/);
    assert.equal(
      (await runner.getTable('suite_publications')).columns.length,
      3,
      'Invalid history must fail before DDL'
    );
    await source.query(
      'UPDATE suite_publications SET submittedRevision=1 WHERE suiteId=?',
      [ids[0]]
    );
    await source.query(
      'UPDATE suite_publications SET publishedAt=3 WHERE suiteId=?',
      [ids[0]]
    );
    await assert.rejects(migration.up(runner), /approved revision or time/);
    await source.query(
      'UPDATE suite_publications SET publishedAt=2 WHERE suiteId=?',
      [ids[0]]
    );
    await source.query(
      'UPDATE suite_submissions SET reviewedAt=0 WHERE suiteId=?',
      [ids[0]]
    );
    await assert.rejects(migration.up(runner), /submission is invalid/);
    await source.query(
      'UPDATE suite_submissions SET reviewedAt=2,reviewerIdentityId=ownerIdentityId WHERE suiteId=?',
      [ids[0]]
    );
    await assert.rejects(migration.up(runner), /exact approved source/);
    assert.equal(
      (await runner.getTable('suite_publications')).columns.length,
      3
    );
    await source.query(
      "UPDATE suite_submissions SET reviewerIdentityId='IndependentStaff' WHERE suiteId=?",
      [ids[0]]
    );
    await source.query(`CREATE TRIGGER qualification_snapshot_copy BEFORE UPDATE ON suite_publications FOR EACH ROW
      BEGIN IF NEW.suiteId='${ids[129]}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Interrupted snapshot batch'; END IF; END`);
    await assert.rejects(migration.up(runner), /Interrupted snapshot batch/);
    const [copied] = await source.query(
      'SELECT COUNT(*) n FROM suite_publications WHERE title IS NOT NULL'
    );
    assert.equal(Number(copied.n), 128);
    await source.query('DROP TRIGGER qualification_snapshot_copy');
    await runner.release();
    runner = null;
    await source.destroy();
    source = await connect([
      ...legacyMigrations,
      SuitePublicationSnapshots1791840009000,
    ]);
    await source.runMigrations();
    runner = source.createQueryRunner();
    await migration.up(runner);
    await new SuitePublication1791676809000().up(runner);
    const reader = new MysqlEditorialSnapshotReader(source, 'default');
    const before = await reader.read('suite', ids[0]);
    assert.deepEqual(before, {
      kind: 'suite',
      resourceId: ids[0],
      tenantId: 'default',
      revision: 1,
      deletedAt: null,
      content: {
        title: 'Approved 0',
        description: 'Approved description',
        applicationIds: applications,
        submittedRevision: 1,
        publishedAt: 2,
      },
    });
    await source.query('DELETE FROM suite_submissions WHERE suiteId=?', [
      ids[0],
    ]);
    await source.query('DELETE FROM private_suites WHERE id=?', [ids[0]]);
    assert.deepEqual(await reader.read('suite', ids[0]), before);
    await migration.up(runner);
    await new SuitePublication1791676809000().up(runner);
    assert.equal(
      (await new MysqlSuiteCatalog(source, 'default').select({ id: ids[0] }))
        .items[0].id,
      ids[0]
    );
    const activity = new MysqlPublicationActivity(source, 'default');
    assert.deepEqual((await activity.read('SnapshotOwner0', null, true))[0], {
      kind: 'suite',
      id: ids[0],
      at: 2,
      revision: 1,
      slug: null,
      applicationSlug: null,
      version: null,
    });
    assert.deepEqual(await activity.read('SnapshotOwner0', null, false), []);
    assert.deepEqual(await activity.read('OtherOwner', null, true), []);
    assert.deepEqual(
      await new MysqlPublicationActivity(source, 'other').read(
        'SnapshotOwner0',
        null,
        true
      ),
      []
    );
    const projection = projectEditorialSnapshot(
      await reader.read('suite', ids[0])
    );
    assert.equal(await projections.publish(projection), 'published');
    assert.deepEqual(await projections.find('suite', ids[0]), projection);
    const exported = await source.transaction(
      'REPEATABLE READ',
      async (manager) => {
        const entries = [];
        for await (const entry of captureEditorialPublications({
          reader: { query: (sql, values) => manager.query(sql, values) },
          owner: 'SnapshotOwner0',
          signal: new AbortController().signal,
          entry: (collection, data) => ({ collection, data }),
        }))
          entries.push(entry);
        return entries;
      }
    );
    assert.deepEqual(
      exported.find(
        (entry) =>
          entry.collection === 'suites.publications' &&
          entry.data.suiteId === ids[0]
      ).data.content,
      before.content
    );
    await source.query(
      'UPDATE suite_publications SET applicationIds=? WHERE suiteId=?',
      [JSON.stringify([applications[0], applications[0]]), ids[0]]
    );
    await assert.rejects(
      migration.up(runner),
      /publication content is invalid/
    );
    await assert.rejects(
      reader.read('suite', ids[0]),
      /publication content is invalid/
    );
    await source.query(
      'UPDATE suite_publications SET applicationIds=? WHERE suiteId=?',
      [JSON.stringify(applications), ids[0]]
    );
    await assert.rejects(migration.down(), /authoritative/);
    await source.query(
      'ALTER TABLE suite_publications DROP COLUMN description'
    );
    await assert.rejects(migration.up(runner), /Applied.*missing/);
    await assert.rejects(
      new SuitePublication1791676809000().up(runner),
      /Incompatible/
    );
    pass(
      'Suite publication snapshots: 131 exact approved copies migrate in 128-row transactions; missing approvals fail before DDL, interrupted backfill resumes, and missing applied schema/corrupt content/destructive rollback fail closed'
    );
    pass(
      'Public suite reads, canonical selection, owner/tenant-scoped profile activity, fresh Mongo materialization and owner export use approved frozen content after private draft/submission removal; later private edits cannot alter publication or member order'
    );
  } finally {
    await runner?.release();
    if (source?.isInitialized) await source.destroy();
    await host.query(`DROP DATABASE \`${database}\``);
  }
};
