import type { MigrationInterface, QueryRunner } from 'typeorm';
import { identityErasureBarrier } from './mysql-identity-write-barrier';

/** Installed independently in each service that owns member-authored data. */
export class IdentityWriteBarrier1791840000000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('identity_erasure_barriers'))) {
      const history =
        runner.connection.options.migrationsTableName ?? 'migrations';
      if (await runner.hasTable(history)) {
        const applied: unknown[] = await runner.query(
          `SELECT name FROM ${runner.connection.driver.escape(
            history
          )} WHERE name = ?`,
          ['IdentityWriteBarrier1791840000000']
        );
        if (applied.length)
          throw new Error(
            'Applied identity write barrier table is missing; restore its erasure markers before continuing'
          );
      }
      await runner.query(`CREATE TABLE identity_erasure_barriers (
        identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        erasureRevision bigint UNSIGNED NULL,
        requestedAt bigint UNSIGNED NULL,
        PRIMARY KEY (identityId)
      ) ENGINE=InnoDB`);
    }
    const table = await runner.getTable('identity_erasure_barriers');
    const metadata: {
      engine: string;
      name: string;
      collation: string | null;
    }[] = await runner.query(
      "SELECT t.ENGINE AS engine, c.COLUMN_NAME AS name, c.COLLATION_NAME AS collation FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = 'identity_erasure_barriers'"
    );
    const triggers: unknown[] = await runner.query(
      "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = 'identity_erasure_barriers'"
    );
    if (
      !table ||
      table.primaryColumns.length !== 1 ||
      table.primaryColumns[0].name !== 'identityId' ||
      table.foreignKeys.length ||
      table.columns.length !== 3 ||
      triggers.length ||
      [
        ...table.uniques,
        ...table.indices.filter((index) => index.isUnique),
      ].some(
        (index) =>
          index.columnNames.length !== 1 ||
          index.columnNames[0] !== 'identityId'
      )
    )
      throw new Error('Incompatible identity write barrier schema');
    for (const name of ['identityId', 'erasureRevision', 'requestedAt']) {
      const column = table.columns.find((entry) => entry.name === name);
      const info = metadata.find((entry) => entry.name === name);
      if (
        !column ||
        info?.engine.toLowerCase() !== 'innodb' ||
        column.isGenerated ||
        (name === 'identityId'
          ? column.type !== 'varchar' ||
            column.length !== '128' ||
            column.isNullable ||
            info.collation !== 'utf8mb4_bin'
          : column.type !== 'bigint' || !column.unsigned || !column.isNullable)
      )
        throw new Error(`Incompatible identity_erasure_barriers.${name}`);
    }
    let after: string | null = null;
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        'SELECT identityId, erasureRevision, requestedAt FROM identity_erasure_barriers WHERE (? IS NULL OR identityId > ?) ORDER BY identityId LIMIT 256',
        [after, after]
      );
      for (const row of rows) after = identityErasureBarrier(row).identityId;
      if (rows.length < 256) break;
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Identity erasure barriers require a reviewed data-preserving rollback'
    );
  }
}
