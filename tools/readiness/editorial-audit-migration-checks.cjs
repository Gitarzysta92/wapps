const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  EditorialAuditErasure1791840013000,
} = require('../../apps/services/editorial/src/app/account-erasure/editorial-audit-erasure.migration');
const migrationName = 'EditorialAuditErasure1791840013000';

module.exports = async function qualifyAuditMigration({
  source,
  peerApp,
  peerGrant,
  pass,
}) {
  const database = 'audit_erasure_migration';
  await source.query(
    `CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
  );
  const scratch = new DataSource({
    ...source.options,
    database,
    migrations: [],
    migrationsRun: false,
  });
  await scratch.initialize();
  const runner = scratch.createQueryRunner();
  const migration = new EditorialAuditErasure1791840013000();
  try {
    const tables = await source.query(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'"
    );
    for (const { name } of tables) {
      assert.match(name, /^[a-z_]+$/);
      await scratch.query(`CREATE TABLE ${name} LIKE suites.${name}`);
      await scratch.query(`INSERT INTO ${name} SELECT * FROM suites.${name}`);
    }
    await scratch.query('DELETE FROM editorial_migrations WHERE name=?', [
      migrationName,
    ]);
    await scratch.query('DROP TABLE application_ownership_history');
    const stamps = await scratch.query(
      "SELECT TABLE_NAME AS tableName,COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_NAME IN ('reviewerErasedAt','actorErasedAt')"
    );
    for (const { tableName, name } of stamps)
      await scratch.query(`ALTER TABLE ${tableName} DROP COLUMN ${name}`);
    await scratch.query(
      'ALTER TABLE application_ownership_decisions MODIFY actorIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL'
    );
    const indexes = await scratch.query(
      "SELECT DISTINCT TABLE_NAME AS tableName,INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND INDEX_NAME LIKE 'idx_erasure_%'"
    );
    for (const { tableName, name } of indexes)
      await scratch.query(`DROP INDEX ${name} ON ${tableName}`);

    // Populated legacy grants cross a real 128-row backfill transaction boundary.
    const originals = {};
    for (const [table, column, id] of [
      ['app_records', 'id', peerApp.id],
      ['editorial_resource_states', 'resourceId', peerApp.id],
      ['application_ownership_claims', 'id', peerGrant.id],
      ['application_ownership_grants', 'claimId', peerGrant.id],
      ['application_ownership_decisions', 'claimId', peerGrant.id],
    ]) {
      [originals[table]] = await scratch.query(
        `SELECT * FROM ${table} WHERE ${column}=?`,
        [id]
      );
      assert.ok(originals[table]);
    }
    for (let i = 0; i < 130; i++) {
      const applicationId = randomUUID(),
        claimId = randomUUID();
      for (const [table, original] of Object.entries(originals)) {
        const row = { ...original };
        if (table === 'app_records')
          Object.assign(row, { id: applicationId, slug: `legacy-audit-${i}` });
        if (table === 'editorial_resource_states')
          row.resourceId = applicationId;
        if (table === 'application_ownership_claims')
          Object.assign(row, {
            id: claimId,
            applicationId,
            applicationSlug: `legacy-audit-${i}`,
          });
        if (table === 'application_ownership_grants')
          Object.assign(row, { applicationId, claimId });
        if (table === 'application_ownership_decisions') row.claimId = claimId;
        const columns = Object.keys(row);
        await scratch.query(
          `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns
            .map(() => '?')
            .join(',')})`,
          columns.map((key) => row[key])
        );
      }
    }
    await scratch.query(
      'ALTER TABLE application_ownership_commands MODIFY actorIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL'
    );
    await assert.rejects(migration.up(runner), /audit authority/);
    assert.equal(
      await runner.hasColumn('application_submissions', 'reviewerErasedAt'),
      false,
      'preflight fails before implicit DDL'
    );
    await scratch.query(
      'ALTER TABLE application_ownership_commands MODIFY actorIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL'
    );
    const originalTransaction = scratch.transaction.bind(scratch);
    let pages = 0;
    scratch.transaction = (...args) => {
      if (++pages === 2) throw new Error('Injected audit backfill page loss');
      return originalTransaction(...args);
    };
    try {
      await assert.rejects(
        migration.up(runner),
        /Injected audit backfill page loss/
      );
    } finally {
      scratch.transaction = originalTransaction;
    }
    assert.equal(
      Number(
        (
          await scratch.query(
            'SELECT COUNT(*) AS n FROM application_ownership_history'
          )
        )[0].n
      ),
      128
    );
    await migration.up(runner);
    assert.equal(
      Number(
        (
          await scratch.query(
            'SELECT COUNT(*) AS n FROM application_ownership_history'
          )
        )[0].n
      ),
      Number(
        (
          await scratch.query(
            'SELECT COUNT(*) AS n FROM application_ownership_grants'
          )
        )[0].n
      )
    );
    assert.equal(
      (
        await scratch.query(
          "SELECT c.applicationId FROM application_ownership_claims c JOIN application_ownership_decisions d ON d.claimId=c.id AND d.action='approve' JOIN application_ownership_history h ON h.applicationId=c.applicationId WHERE h.establishedAt>d.createdAt"
        )
      ).length,
      0,
      'legacy transfer history predates every surviving approval, not only the current grant'
    );
    await scratch.query(
      'INSERT INTO editorial_migrations (timestamp,name) VALUES (?,?)',
      [1791840013000, migrationName]
    );
    const query = runner.query.bind(runner);
    let ddl = 0;
    runner.query = (sql, ...args) => {
      if (/^(ALTER|CREATE|DROP) /i.test(sql)) ddl++;
      return query(sql, ...args);
    };
    await migration.up(runner);
    assert.equal(ddl, 0, 'successful reentry performs no implicit-commit DDL');
    runner.query = query;
    const getTable = runner.getTable.bind(runner);
    runner.getTable = async (...args) => {
      const table = (await getTable(...args))?.clone();
      for (const index of table?.indices ?? []) index.columnNames.reverse();
      return table;
    };
    try {
      for (const item of source.migrations)
        if (
          /^(SuitePublication179167|ApplicationPublication|ApplicationOwnership)/.test(
            item.constructor.name
          )
        )
          await item.up(runner);
    } finally {
      runner.getTable = getTable;
    }
    const [history] = await scratch.query(
      'SELECT * FROM application_ownership_history ORDER BY applicationId LIMIT 1'
    );
    await scratch.query(
      'DELETE FROM application_ownership_history WHERE applicationId=?',
      [history.applicationId]
    );
    await assert.rejects(migration.up(runner), /history entry is missing/);
    await scratch.query(
      'INSERT INTO application_ownership_history (applicationId,tenantId,establishedAt) VALUES (?,?,?)',
      [history.applicationId, history.tenantId, history.establishedAt]
    );
    for (const [broken, repair, pattern] of [
      [
        'ALTER TABLE article_submissions ALTER INDEX idx_erasure_reviewer INVISIBLE',
        'ALTER TABLE article_submissions ALTER INDEX idx_erasure_reviewer VISIBLE',
        /audit index/,
      ],
      [
        'ALTER TABLE article_submissions ALTER COLUMN reviewerErasedAt SET DEFAULT 1',
        'ALTER TABLE article_submissions ALTER COLUMN reviewerErasedAt DROP DEFAULT',
        /audit stamp/,
      ],
      [
        'DROP INDEX idx_erasure_claim ON application_ownership_checks',
        'CREATE INDEX idx_erasure_claim ON application_ownership_checks (claimId,tenantId,actorIdentityId,commandKey)',
        /audit index/,
      ],
      [
        'CREATE TRIGGER qualification_audit_history_trigger BEFORE DELETE ON application_ownership_history FOR EACH ROW SET @audit_qualification=1',
        'DROP TRIGGER qualification_audit_history_trigger',
        /history constraint/,
      ],
    ]) {
      await scratch.query(broken);
      try {
        await assert.rejects(migration.up(runner), pattern);
      } finally {
        await scratch.query(repair);
      }
    }
    const [decision] = await scratch.query(
      "SELECT d.* FROM application_ownership_decisions d JOIN application_ownership_claims c ON c.id=d.claimId AND c.revision=d.revision WHERE d.action='approve' LIMIT 1"
    );
    await scratch.query(
      'UPDATE application_ownership_decisions SET actorIdentityId=NULL,actorErasedAt=? WHERE claimId=? AND revision=?',
      [decision.createdAt, decision.claimId, decision.revision]
    );
    await assert.rejects(migration.up(runner), /differs from its claim/);
    await scratch.query(
      'UPDATE application_ownership_claims SET reviewerIdentityId=NULL,reviewerErasedAt=? WHERE id=?',
      [decision.createdAt, decision.claimId]
    );
    await migration.up(runner);
    await scratch.query(
      'UPDATE application_ownership_decisions SET actorErasedAt=? WHERE claimId=? AND revision=?',
      [Number(decision.createdAt) - 1, decision.claimId, decision.revision]
    );
    await assert.rejects(migration.up(runner), /erasure timestamp/);
    await scratch.query(
      'UPDATE application_ownership_decisions SET actorErasedAt=? WHERE claimId=? AND revision=?',
      [decision.createdAt, decision.claimId, decision.revision]
    );
    const [undecided] = await scratch.query(
      "SELECT id FROM application_ownership_claims WHERE status='awaiting-proof' LIMIT 1"
    );
    await scratch.query(
      'UPDATE application_ownership_claims SET reviewerErasedAt=1 WHERE id=?',
      [undecided.id]
    );
    await assert.rejects(migration.up(runner), /Undecided Editorial review/);
    await scratch.query(
      'UPDATE application_ownership_claims SET reviewerErasedAt=NULL WHERE id=?',
      [undecided.id]
    );
    await migration.up(runner);
    await assert.rejects(migration.down(), /reviewed/);
    pass(
      'real populated audit migration backfills >128 grants, fails physical preflight before DDL, survives interrupted page/reentry without repeated DDL, and rejects missing history/indexes, invisible indexes, stamp defaults, triggers and inconsistent anonymous decisions'
    );
  } finally {
    await runner.release();
    await scratch.destroy();
    await source.query(`DROP DATABASE ${database}`);
  }
};
