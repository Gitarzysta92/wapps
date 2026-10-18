import { Table, type QueryRunner } from 'typeorm';
import { PrivateProfile1791676805000 } from './private-profile.migration';

function fixture(type?: string, nullable = true) {
  const table = new Table({
    name: 'identity_accounts',
    columns: [
      { name: 'identityId', type: 'varchar', length: '128', isPrimary: true },
      ...(type ? [{ name: 'socialLinks', type, isNullable: nullable }] : []),
    ],
  });
  const query = jest.fn().mockResolvedValue([]);
  const runner = {
    getTable: jest.fn().mockResolvedValue(table),
    query,
  } as unknown as QueryRunner;
  return { query, runner };
}

describe('additive private profile migration', () => {
  it('adds a nullable JSON field without overwriting existing account data', async () => {
    const f = fixture();
    await new PrivateProfile1791676805000().up(f.runner);
    expect(f.query.mock.calls[0][0]).toBe(
      'ALTER TABLE identity_accounts ADD COLUMN socialLinks JSON NULL'
    );
    expect(
      f.query.mock.calls.some(([sql]) => /UPDATE|DELETE|DROP/.test(sql))
    ).toBe(false);
  });
  it('can resume after DDL and validates existing data', async () => {
    const f = fixture('json');
    f.query.mockResolvedValue([
      { identityId: 'Uid', socialLinks: '{"github":"alice"}' },
    ]);
    await new PrivateProfile1791676805000().up(f.runner);
    expect(f.query.mock.calls[0][0]).toMatch(/^SELECT/);
    f.query.mockResolvedValue([
      { identityId: 'Uid', socialLinks: '{"website":"javascript:bad"}' },
    ]);
    await expect(
      new PrivateProfile1791676805000().up(f.runner)
    ).rejects.toThrow();
  });
  it.each([
    ['text', true],
    ['json', false],
  ] as const)(
    'refuses an incompatible existing column: %s %s',
    async (type, nullable) => {
      const f = fixture(type, nullable);
      await expect(
        new PrivateProfile1791676805000().up(f.runner)
      ).rejects.toThrow('Incompatible');
      expect(f.query).not.toHaveBeenCalled();
    }
  );
  it('requires reviewed data-preserving rollback', async () => {
    await expect(new PrivateProfile1791676805000().down()).rejects.toThrow(
      'data-preserving'
    );
  });
});
