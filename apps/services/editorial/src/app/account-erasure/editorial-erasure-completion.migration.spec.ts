import type { QueryRunner } from 'typeorm';
import { EditorialErasureCompletion1791840014000 } from './editorial-erasure-completion.migration';

function fixture(applied = false) {
  const indexes = new Set<string>(
    applied
      ? ['application_submissions', 'suite_submissions', 'article_publications']
      : []
  );
  const badColumns = new Set<string>();
  let badIndex = '';
  const query = jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith('SELECT name FROM editorial_migrations'))
      return applied
        ? [{ name: 'EditorialErasureCompletion1791840014000' }]
        : [];
    const table = String(args[0]);
    if (sql.includes('information_schema.COLUMNS'))
      return [
        {
          engine: 'InnoDB',
          type: 'varchar',
          length: 128,
          collation: badColumns.has(table)
            ? 'utf8mb4_general_ci'
            : 'utf8mb4_bin',
          nullable: table === 'article_publications' ? 'YES' : 'NO',
          defaultValue: null,
          extra: '',
          expression: '',
        },
      ];
    if (sql.includes('information_schema.STATISTICS'))
      return indexes.has(table)
        ? [
            {
              name: 'ownerIdentityId',
              prefix: null,
              nonUnique: 1,
              direction: 'A',
              visible: table === badIndex ? 'NO' : 'YES',
              expression: null,
            },
          ]
        : [];
    if (sql.startsWith('CREATE INDEX')) {
      indexes.add(sql.split(' ON ')[1].split(' ')[0]);
      return [];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
  const runner = {
    hasTable: jest.fn().mockResolvedValue(true),
    query,
  } as unknown as QueryRunner;
  return {
    runner,
    query,
    indexes,
    badColumns,
    corruptIndex: (name: string) => {
      badIndex = name;
    },
    migration: new EditorialErasureCompletion1791840014000(),
  };
}

describe('Editorial completion indexes', () => {
  it('validates all attribution before any DDL and resumes a partially installed index set', async () => {
    const f = fixture();
    f.indexes.add('application_submissions');
    f.badColumns.add('article_publications');
    await expect(f.migration.up(f.runner)).rejects.toThrow(
      'completion attribution'
    );
    expect(
      f.query.mock.calls.filter(([sql]) => sql.startsWith('CREATE'))
    ).toHaveLength(0);
    f.badColumns.clear();
    await f.migration.up(f.runner);
    expect(
      f.query.mock.calls.filter(([sql]) => sql.startsWith('CREATE'))
    ).toHaveLength(2);
    f.query.mockClear();
    await f.migration.up(f.runner);
    expect(
      f.query.mock.calls.filter(([sql]) => sql.startsWith('CREATE'))
    ).toHaveLength(0);
  });
  it('refuses missing or invisible applied indexes and destructive down', async () => {
    const f = fixture(true);
    f.indexes.delete('suite_submissions');
    await expect(f.migration.up(f.runner)).rejects.toThrow('completion index');
    f.indexes.add('suite_submissions');
    f.corruptIndex('suite_submissions');
    await expect(f.migration.up(f.runner)).rejects.toThrow('completion index');
    expect(
      f.query.mock.calls.filter(([sql]) => sql.startsWith('CREATE'))
    ).toHaveLength(0);
    await expect(f.migration.down()).rejects.toThrow('data-preserving');
  });
});
