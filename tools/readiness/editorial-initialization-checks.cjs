const assert = require('node:assert/strict');
const { createServer } = require('node:net');

module.exports = async function editorialInitialization(fixture) {
  const { sql, launch, observe, environment, save } = fixture;
  const records = [];
  const fSql = () => ({
    host: fixture.sqlOptions.host,
    port: fixture.sqlOptions.port,
    username: fixture.sqlOptions.user,
    password: fixture.sqlOptions.password,
  });
  async function migrate(name, database, options = {}, expected = 0) {
    const started = Date.now();
    const cli = launch(
      name,
      'apps/services/editorial',
      ['--migrate'],
      {
        EDITORIAL_DATABASE_NAME: database,
        ...options,
      },
      process.env.WAPPS_RECOVERY_OBSERVE_SCHEMA === '1'
        ? 'editorial-schema-observer.cjs'
        : false
    );
    let logs;
    try {
      logs = await cli.finish(expected);
    } catch (error) {
      const { DataSource } = require('typeorm');
      const source = new DataSource({ type: 'mysql', ...fSql(), database });
      try {
        await source.initialize();
        const runner = source.createQueryRunner();
        try {
          const actual = await runner.getTable('application_image_cleanup');
          const physical = await source.query(
            "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='application_image_cleanup' ORDER BY ORDINAL_POSITION"
          );
          const indexes = await source.query(
            "SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='application_image_cleanup' ORDER BY INDEX_NAME, SEQ_IN_INDEX"
          );
          save(name + '.schema.json', { table: actual, physical, indexes });
        } finally {
          await runner.release();
        }
      } finally {
        if (source.isInitialized) await source.destroy();
      }
      records.push({
        name,
        expectedExitCode: expected,
        actualExitCode: cli.child.exitCode,
        elapsedMs: Date.now() - started,
      });
      save('initialization-attempts.json', records);
      throw error;
    }
    const diagnostics = logs.split('\n').flatMap((line) => {
      try {
        const value = JSON.parse(line);
        return value.event === 'editorial_maintenance_database_failure'
          ? [value]
          : [];
      } catch {
        return [];
      }
    });
    records.push({
      name,
      expectedExitCode: expected,
      elapsedMs: Date.now() - started,
      diagnostics,
    });
    save('initialization-attempts.json', records);
    return { logs, diagnostics };
  }
  const databases = Array.from(
    { length: 12 },
    (_, i) => `init_${fixture.id}_${i}`
  );
  for (const database of databases)
    await sql.query(
      `CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
    );
  for (let i = 0; i < 8; i++) {
    const { logs } = await migrate(`init-fresh-${i}`, databases[i]);
    const report = JSON.parse(logs.trim());
    assert.equal(
      report.applied.length,
      27,
      'The complete shared production migration roster'
    );
    const [rows] = await sql.query(
      `SELECT COUNT(*) n FROM ${databases[i]}.editorial_migrations`
    );
    assert.equal(rows[0].n, 27);
    const again = await migrate(`init-reentry-${i}`, databases[i]);
    assert.deepEqual(JSON.parse(again.logs.trim()).applied, []);
  }
  const concurrent = await Promise.allSettled(
    databases
      .slice(8)
      .map((database, i) => migrate(`init-concurrent-${i}`, database))
  );
  for (const result of concurrent) {
    assert.equal(result.status, 'fulfilled');
    assert.equal(JSON.parse(result.value.logs.trim()).applied.length, 27);
  }
  observe(
    'Editorial initialization: 12 fresh databases, 8 re-entries and four concurrent isolated initializations; no retries',
    { rootCauseEstablished: false }
  );

  const wrongPassword = 'diagnostic-credential-must-not-appear';
  const denied = await migrate(
    'init-fault-credentials',
    databases[0],
    { EDITORIAL_DATABASE_PASSWORD: wrongPassword },
    1
  );
  assert.equal(denied.diagnostics[0]?.operation, 'initialize');
  assert.ok(
    denied.diagnostics[0].errors.some(
      (error) => error.code === 'ER_ACCESS_DENIED_ERROR'
    )
  );
  assert.ok(!denied.logs.includes(wrongPassword));
  const missing = await migrate(
    'init-fault-database',
    `absent_${fixture.id}`,
    {},
    1
  );
  assert.equal(missing.diagnostics[0]?.operation, 'initialize');
  assert.ok(
    missing.diagnostics[0].errors.some(
      (error) => error.code === 'ER_BAD_DB_ERROR'
    )
  );
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const closedPort = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const refused = await migrate(
    'init-fault-refused',
    databases[0],
    { EDITORIAL_DATABASE_PORT: String(closedPort) },
    1
  );
  assert.equal(refused.diagnostics[0]?.operation, 'initialize');
  assert.ok(
    refused.diagnostics[0].errors.some((error) => error.code === 'ECONNREFUSED')
  );

  const database = `init_fault_${fixture.id}`;
  await sql.query(
    `CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
  );
  await sql.query(
    `CREATE TABLE ${database}.editorial_migrations (id int NOT NULL AUTO_INCREMENT PRIMARY KEY, timestamp bigint NOT NULL, name varchar(255) NOT NULL)`
  );
  const privateMessage = 'private-DSN-payload-SQL-must-not-appear';
  await sql.query(
    `CREATE TRIGGER ${database}.reject_receipt BEFORE INSERT ON ${database}.editorial_migrations FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '${privateMessage}'`
  );
  const ddl = await migrate('init-fault-migration-receipt', database, {}, 1);
  assert.equal(ddl.diagnostics[0]?.operation, 'runMigrations');
  assert.ok(
    ddl.diagnostics[0].errors.some(
      (error) => error.code === 'ER_SIGNAL_EXCEPTION'
    )
  );
  assert.ok(!ddl.logs.includes(privateMessage));
  await sql.query(`DROP TRIGGER ${database}.reject_receipt`);
  const recovery = await migrate('init-fault-explicit-recovery', database);
  assert.equal(JSON.parse(recovery.logs.trim()).applied.length, 27);
  observe(
    'Editorial safe diagnostics distinguish authentication, absent database, refused connection and migration-receipt faults; explicit recovery retains 27 receipts',
    { failureCauseOfI28: 'unresolved', expectedFaults: 4 }
  );
  save('initialization-assessment.json', {
    retainedFailure:
      '/tmp/wapps-integration-a28-20261018-l4s2868l/runtime-member.log',
    freshDatabases: 12,
    reentries: 8,
    concurrentFreshDatabases: 4,
    expectedFaults: 4,
    originalFailureReproduced: false,
    rootCauseEstablished: false,
    limits:
      'This bounded repetition and classified faults do not explain the intermittent I28 failure. No operation retries, startup sleeps or gateway substitution were added.',
    databaseHost: environment.EDITORIAL_DATABASE_HOST,
  });
};
