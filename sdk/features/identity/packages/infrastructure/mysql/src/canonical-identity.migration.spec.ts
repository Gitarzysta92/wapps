import { QueryRunner, Table } from 'typeorm';
import { CanonicalIdentity1791676804000 } from './canonical-identity.migration';
import { CreateIdentities1788566400000 } from './create-identities.migration';

async function fixture() {
  let identities!: Table;
  await new CreateIdentities1788566400000().up({
    createTable: async (table: Table) => {
      identities = table;
    },
  } as unknown as QueryRunner);
  const tables = new Map([['identities', identities]]);
  const invalid = {
    lifecycle: false,
    legacy: false,
    triggers: false,
    engine: false,
  };
  const ddl: string[] = [];
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('information_schema.TABLES'))
      return [...tables.keys()].map((tableName) => ({
        tableName,
        engine: invalid.engine ? 'MyISAM' : 'InnoDB',
      }));
    if (sql.includes('information_schema.COLUMNS'))
      return [...tables].flatMap(([tableName, table]) =>
        table.columns.map((column) => ({
          tableName,
          columnName: column.name,
          collation:
            column.type === 'varchar' ||
            column.type === 'char' ||
            column.type === 'text'
              ? 'utf8mb4_bin'
              : null,
        }))
      );
    if (sql.includes('information_schema.TRIGGERS'))
      return invalid.triggers ? [{}] : [];
    if (sql.startsWith('SELECT 1 FROM identity_subjects'))
      return invalid.legacy ? [{}] : [];
    if (sql.startsWith('SELECT id FROM identities'))
      return invalid.lifecycle ? [{}] : [];
    if (sql.startsWith('SELECT id, identity_id')) return [];
    ddl.push(sql);
    return [];
  });
  const runner = {
    query,
    getTable: async (name: string) => tables.get(name),
  } as unknown as QueryRunner;
  return {
    identities,
    tables,
    invalid,
    ddl,
    query,
    run: () => new CanonicalIdentity1791676804000().up(runner),
  };
}

function jobs(): Table {
  return new Table({
    name: 'identity_deletion_jobs',
    columns: [
      { name: 'identityId', type: 'varchar', length: '128', isPrimary: true },
      { name: 'revision', type: 'bigint', unsigned: true },
      { name: 'createdAt', type: 'bigint' },
      { name: 'availableAt', type: 'bigint' },
      { name: 'attempts', type: 'int', unsigned: true, default: '0' },
      { name: 'leaseToken', type: 'varchar', length: '36', isNullable: true },
      ...['leasedUntil', 'completedAt', 'failedAt'].map((name) => ({
        name,
        type: 'bigint',
        isNullable: true,
      })),
    ],
    indices: [
      {
        name: 'idx_pending',
        columnNames: ['completedAt', 'failedAt', 'availableAt', 'leasedUntil'],
      },
    ],
  });
}

describe('canonical migration preflight', () => {
  it('checks exact composite key membership independently of metadata column order', async () => {
    const f = await fixture();
    const commands = new Table({
      name: 'identity_account_commands',
      columns: [
        { name: 'commandKey', type: 'varchar', length: '128', isPrimary: true },
        { name: 'identityId', type: 'varchar', length: '128', isPrimary: true },
        { name: 'fingerprint', type: 'char', length: '64' },
        { name: 'revision', type: 'bigint', unsigned: true },
        { name: 'createdAt', type: 'bigint' },
      ],
    });
    f.tables.set(commands.name, commands);
    await f.run();
    commands.columns[0].isPrimary = false;
    f.ddl.length = 0;
    await expect(f.run()).rejects.toThrow('primary key');
    expect(f.ddl).toEqual([]);
  });
  it('validates all authority before issuing migration DDL', async () => {
    const f = await fixture();
    await f.run();
    expect(f.ddl).toHaveLength(5);
    expect(f.ddl[0]).toContain('utf8mb4_bin');
    expect(f.ddl[0]).toContain('revision bigint unsigned');
  });
  it.each(['engine', 'lifecycle', 'triggers'] as const)(
    'refuses %s before any DDL',
    async (field) => {
      const f = await fixture();
      f.invalid[field] = true;
      await expect(f.run()).rejects.toThrow('refused');
      expect(f.ddl).toEqual([]);
    }
  );
  it('requires verified legacy identity/account mapping rather than silently orphaning it', async () => {
    const f = await fixture();
    f.tables.set('identity_subjects', new Table({ name: 'identity_subjects' }));
    f.invalid.legacy = true;
    await expect(f.run()).rejects.toThrow('verified');
    expect(f.ddl).toEqual([]);
  });
  it.each(['claim', 'id', 'provider_type', 'created_at'])(
    'rejects missing base field %s',
    async (name) => {
      const f = await fixture();
      f.identities.columns = f.identities.columns.filter(
        (column) => column.name !== name
      );
      await expect(f.run()).rejects.toThrow();
      expect(f.ddl).toEqual([]);
    }
  );
  it('accepts complete prior journal DDL when TypeORM omits a default database collation', async () => {
    const f = await fixture();
    f.tables.set('identity_deletion_jobs', jobs());
    await f.run();
    expect(f.ddl).toHaveLength(5);
  });
  it.each([
    'identityId',
    'revision',
    'createdAt',
    'availableAt',
    'attempts',
    'leaseToken',
    'leasedUntil',
    'completedAt',
    'failedAt',
  ])('rejects a partial deletion journal missing %s', async (name) => {
    const f = await fixture();
    const table = jobs();
    table.columns = table.columns.filter((column) => column.name !== name);
    f.tables.set(table.name, table);
    await expect(f.run()).rejects.toThrow();
    expect(f.ddl).toEqual([]);
  });
  it.each([
    'type',
    'length',
    'nullable',
    'unsigned',
    'default',
    'index',
    'unique',
  ] as const)('rejects incompatible journal %s', async (mutation) => {
    const f = await fixture();
    const table = jobs();
    f.tables.set(table.name, table);
    const attempts = table.columns.find((column) => column.name === 'attempts');
    if (!attempts) throw new Error('Fixture is missing attempts');
    if (mutation === 'type') attempts.type = 'varchar';
    if (mutation === 'length') table.columns[0].length = '36';
    if (mutation === 'nullable') attempts.isNullable = true;
    if (mutation === 'unsigned') attempts.unsigned = false;
    if (mutation === 'default') attempts.default = '12';
    if (mutation === 'index') table.indices = [];
    if (mutation === 'unique') attempts.isUnique = true;
    await expect(f.run()).rejects.toThrow();
    expect(f.ddl).toEqual([]);
  });
  it('never drops identity authority through migration rollback', async () => {
    await expect(new CanonicalIdentity1791676804000().down()).rejects.toThrow(
      'forward'
    );
    await expect(new CreateIdentities1788566400000().down()).rejects.toThrow(
      'forward'
    );
  });
});
