import { Table, type QueryRunner } from 'typeorm';
import {
  CLASSIFICATION_TABLES,
  classificationColumn,
} from './content-classification-schema';
import { ContentClassification1791886000000 } from './content-classification.migration';

function setup(applied = false) {
  const tables = new Map(
    CLASSIFICATION_TABLES.map((name) => [
      name,
      new Table({ name, columns: [] }),
    ])
  );
  const addColumn = jest.fn(
    async (name: (typeof CLASSIFICATION_TABLES)[number]) => {
      tables.get(name)!.addColumn(classificationColumn());
    }
  );
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM editorial_migrations'))
      return applied ? [{ name: 'applied' }] : [];
    if (sql.includes('information_schema.TABLES'))
      return [{ engine: 'InnoDB' }];
    if (sql.includes('information_schema.COLUMNS'))
      return [{ collation: 'utf8mb4_bin', extra: '', defaultValue: null }];
    return [];
  });
  const runner = {
    hasTable: async () => true,
    getTable: async (name: (typeof CLASSIFICATION_TABLES)[number]) =>
      tables.get(name),
    addColumn,
    query,
  } as unknown as QueryRunner;
  return {
    runner,
    tables,
    addColumn,
    query,
    migration: new ContentClassification1791886000000(),
  };
}

describe('additive content classification migration', () => {
  it('resumes partial DDL without assigning classifications to legacy records', async () => {
    const h = setup();
    h.tables.get('app_records')!.addColumn(classificationColumn());
    await h.migration.up(h.runner);
    expect(h.addColumn).toHaveBeenCalledTimes(5);
    await h.migration.up(h.runner);
    expect(h.addColumn).toHaveBeenCalledTimes(5);
    expect(
      h.query.mock.calls.some(([sql]) => /^(UPDATE|DELETE)/.test(sql))
    ).toBe(false);
  });
  it('refuses recorded column loss before attempting DDL', async () => {
    const h = setup(true);
    await expect(h.migration.up(h.runner)).rejects.toThrow(
      'Applied classification column is missing'
    );
    expect(h.addColumn).not.toHaveBeenCalled();
  });
  it('refuses incompatible columns and destructive rollback', async () => {
    const h = setup();
    const column = classificationColumn();
    column.isNullable = false;
    h.tables.get('suite_publications')!.addColumn(column);
    await expect(h.migration.up(h.runner)).rejects.toThrow(
      'Incompatible classification column'
    );
    expect(h.addColumn).not.toHaveBeenCalled();
    await expect(h.migration.down()).rejects.toThrow(
      'retain the additive schema'
    );
  });
});
