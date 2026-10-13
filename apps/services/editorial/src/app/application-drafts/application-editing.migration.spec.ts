import { Table, type QueryRunner } from 'typeorm';
import { ApplicationEditing1791676813000 } from './application-editing.migration';

describe('application editing migration index authority', () => {
  function fixture(names = ['applicationId', 'draftId']) {
    let table: Table;
    const runner = {
      hasTable: jest.fn().mockResolvedValue(false),
      createTable: jest.fn(async (value: Table) => {
        table = value;
      }),
      getTable: jest.fn(async () => {
        const result = table.clone();
        result.indices[0].columnNames.reverse();
        return result;
      }),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('TABLES')) return [{ engine: 'InnoDB' }];
        if (sql.includes('COLUMNS'))
          return table.columns.map((column) => ({
            name: column.name,
            collation: column.collation ?? null,
          }));
        if (sql.includes("INDEX_NAME = 'PRIMARY'"))
          return [{ name: 'draftId' }];
        if (sql.includes('STATISTICS'))
          return names.map((name) => ({
            name,
            prefix: null,
            nonUnique: 1,
            direction: 'A',
            visible: 'YES',
            expression: null,
          }));
        return [];
      }),
    };
    return runner as unknown as QueryRunner;
  }
  it('accepts the physical index despite unordered ORM metadata', async () => {
    await expect(
      new ApplicationEditing1791676813000().up(fixture())
    ).resolves.toBeUndefined();
  });
  it.each([
    { names: [] },
    { names: ['draftId', 'applicationId'] },
    { names: ['applicationId'] },
  ])(
    'rejects missing or differently ordered physical keys: $names',
    async ({ names }) => {
      await expect(
        new ApplicationEditing1791676813000().up(fixture(names))
      ).rejects.toThrow('Incompatible application editing target schema');
    }
  );
});
