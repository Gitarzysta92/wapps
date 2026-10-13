import type { QueryRunner } from 'typeorm';
import {
  ensureJournalTable,
  type JournalTableDefinition,
} from './validated-journal-table';

const definition: JournalTableDefinition = {
  name: 'delivery_journal',
  migration: 'DeliveryJournal1791840015000',
  create:
    'CREATE TABLE delivery_journal (id char(36) NOT NULL PRIMARY KEY) ENGINE=InnoDB',
  columns: { id: { type: 'char(36)', collation: 'ascii_bin' } },
  indexes: { PRIMARY: { columns: ['id'], unique: true } },
};
function fixture() {
  const columns = [
    {
      name: 'id',
      type: 'char(36)',
      nullable: 'NO',
      collation: 'ascii_bin',
      initial: null,
      extra: '',
      engine: 'InnoDB',
    },
  ];
  const indexes = [
    {
      name: 'PRIMARY',
      column: 'id',
      position: 1,
      nonUnique: 0,
      prefix: null,
      visible: 'YES',
      direction: 'A',
    },
  ];
  const state = {
    present: true,
    applied: false,
    triggers: false,
    constraints: false,
  };
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('information_schema.COLUMNS')) return columns;
    if (sql.includes('information_schema.STATISTICS')) return indexes;
    if (sql.includes('information_schema.TRIGGERS'))
      return state.triggers ? [{}] : [];
    if (sql.includes('information_schema.TABLE_CONSTRAINTS'))
      return state.constraints ? [{}] : [];
    if (sql.startsWith('SELECT name'))
      return state.applied ? [{ name: definition.migration }] : [];
    return [];
  });
  const runner = {
    connection: {
      options: {},
      driver: { escape: (name: string) => `\`${name}\`` },
    },
    hasTable: jest.fn(async (name) => name === 'migrations' || state.present),
    query,
  } as unknown as QueryRunner;
  return { runner, query, columns, indexes, state };
}
describe('physical durable journal schema', () => {
  it('accepts exact installed metadata and restarts an interrupted creation', async () => {
    const f = fixture();
    await ensureJournalTable(f.runner, definition);
    expect(f.query).not.toHaveBeenCalledWith(definition.create);
    f.state.present = false;
    await ensureJournalTable(f.runner, definition);
    expect(f.query).toHaveBeenCalledWith(definition.create);
  });
  it('refuses to silently recreate a lost applied delivery journal', async () => {
    const f = fixture();
    f.state.present = false;
    f.state.applied = true;
    await expect(ensureJournalTable(f.runner, definition)).rejects.toThrow(
      'is missing'
    );
    expect(f.query).not.toHaveBeenCalledWith(definition.create);
  });
  it.each([
    { type: 'varchar(36)' },
    { nullable: 'YES' },
    { collation: 'ascii_general_ci' },
    { extra: 'STORED GENERATED' },
    { engine: 'MyISAM' },
  ])('refuses incompatible column semantics %j', async (change) => {
    const f = fixture();
    Object.assign(f.columns[0], change);
    await expect(ensureJournalTable(f.runner, definition)).rejects.toThrow(
      'column'
    );
  });
  it.each([
    { column: 'other' },
    { position: 2 },
    { nonUnique: 1 },
    { prefix: 12 },
    { visible: 'NO' },
    { direction: 'D' },
  ])('rejects weakened physical index %j', async (change) => {
    const f = fixture();
    Object.assign(f.indexes[0], change);
    await expect(ensureJournalTable(f.runner, definition)).rejects.toThrow(
      'index'
    );
  });
  it('rejects unexpected columns, indexes, triggers and implicit cascading constraints', async () => {
    for (const corruption of [
      'columns',
      'indexes',
      'triggers',
      'constraints',
    ]) {
      const f = fixture();
      if (corruption === 'columns')
        f.columns.push({ ...f.columns[0], name: 'secret' });
      else if (corruption === 'indexes')
        f.indexes.push({ ...f.indexes[0], name: 'extra' });
      else if (corruption === 'triggers') f.state.triggers = true;
      else f.state.constraints = true;
      await expect(ensureJournalTable(f.runner, definition)).rejects.toThrow(
        'Unexpected'
      );
    }
  });
});
