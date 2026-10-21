import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  CLASSIFICATION_TABLES,
  classificationColumn,
} from './content-classification-schema';

/** NULL preserves legacy unclassified content; no publication is implicitly approved. */
export class ContentClassification1791886000000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    const applied =
      (await runner.hasTable('editorial_migrations')) &&
      (
        await runner.query(
          'SELECT name FROM editorial_migrations WHERE name=? LIMIT 1',
          ['ContentClassification1791886000000']
        )
      ).length > 0;
    const missing: string[] = [];
    for (const name of CLASSIFICATION_TABLES) {
      const table = await runner.getTable(name);
      const [storage]: { engine: string }[] = await runner.query(
        'SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',
        [name]
      );
      if (!table || storage?.engine !== 'InnoDB')
        throw new Error(
          `Missing transactional classification authority: ${name}`
        );
      const column = table.findColumnByName('classification');
      if (!column) {
        if (applied)
          throw new Error(`Applied classification column is missing: ${name}`);
        missing.push(name);
        continue;
      }
      const [physical]: {
        collation: string;
        extra: string;
        defaultValue: unknown;
      }[] = await runner.query(
        "SELECT COLLATION_NAME AS collation,EXTRA AS extra,COLUMN_DEFAULT AS defaultValue FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='classification'",
        [name]
      );
      if (
        column.type !== 'varchar' ||
        column.length !== '7' ||
        !column.isNullable ||
        column.isPrimary ||
        column.isGenerated ||
        physical?.collation !== 'utf8mb4_bin' ||
        physical.extra !== '' ||
        physical.defaultValue !== null
      )
        throw new Error(`Incompatible classification column: ${name}`);
      const invalid = await runner.query(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ classification FROM ${name} WHERE classification IS NOT NULL AND BINARY classification NOT IN ('general','mature') LIMIT 1`
      );
      if (invalid.length)
        throw new Error(`Invalid stored content classification: ${name}`);
    }
    for (const name of missing)
      await runner.addColumn(name, classificationColumn());
  }

  async down(): Promise<void> {
    throw new Error(
      'Reviewed classifications are authoritative; retain the additive schema on rollback'
    );
  }
}
