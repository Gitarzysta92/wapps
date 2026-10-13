import {
  identityDataSource,
  parseIdentityMaintenance,
  runIdentityMaintenance,
} from './identity-maintenance';
import { DataSource } from 'typeorm';
import { MysqlQueryRunner } from 'typeorm/driver/mysql/MysqlQueryRunner';

describe('identity migration lock ownership', () => {
  const env = {
    MYSQL_HOST: 'localhost',
    MYSQL_PORT: '3306',
    MYSQL_DATABASE: 'qualification',
    MYSQL_USERNAME: 'test',
    MYSQL_PASSWORD: 'test',
  };
  function fixture(acquired: unknown) {
    jest
      .spyOn(DataSource.prototype, 'initialize')
      .mockResolvedValue(new DataSource({ type: 'mysql' }));
    const destroy = jest
      .spyOn(DataSource.prototype, 'destroy')
      .mockResolvedValue();
    const migrate = jest
      .spyOn(DataSource.prototype, 'runMigrations')
      .mockResolvedValue([]);
    jest
      .spyOn(MysqlQueryRunner.prototype, 'connect')
      .mockResolvedValue(undefined);
    jest.spyOn(MysqlQueryRunner.prototype, 'hasTable').mockResolvedValue(false);
    const release = jest
      .spyOn(MysqlQueryRunner.prototype, 'release')
      .mockResolvedValue();
    const query = jest
      .spyOn(MysqlQueryRunner.prototype, 'query')
      .mockImplementation(async (sql) =>
        sql.includes('GET_LOCK') ? [{ acquired }] : []
      );
    return { destroy, migrate, release, query };
  }
  afterEach(() => jest.restoreAllMocks());
  it.each([1, '1'])(
    'migrates and releases a lock represented as %j',
    async (acquired) => {
      const f = fixture(acquired),
        report = jest.fn();
      expect(await runIdentityMaintenance(['--migrate'], env, report)).toBe(0);
      expect(f.migrate).toHaveBeenCalledWith({ transaction: 'none' });
      expect(
        f.query.mock.calls.some(([sql]) => sql.includes('RELEASE_LOCK'))
      ).toBe(true);
      expect(f.release).toHaveBeenCalled();
      expect(f.destroy).toHaveBeenCalled();
      expect(report).toHaveBeenCalledWith({ migrated: [] });
    }
  );
  it.each([0, '0', null, undefined, true, '01'])(
    'does not migrate or release an unowned/malformed lock: %j',
    async (acquired) => {
      const f = fixture(acquired);
      await expect(
        runIdentityMaintenance(['--migrate'], env, jest.fn())
      ).rejects.toThrow('migration is already running');
      expect(f.migrate).not.toHaveBeenCalled();
      expect(
        f.query.mock.calls.some(([sql]) => sql.includes('RELEASE_LOCK'))
      ).toBe(false);
      expect(f.release).toHaveBeenCalled();
      expect(f.destroy).toHaveBeenCalled();
    }
  );
  it('releases acquired ownership after a migration failure without reporting success', async () => {
    const f = fixture('1'),
      report = jest.fn();
    f.migrate.mockRejectedValue(new Error('invalid audit'));
    await expect(
      runIdentityMaintenance(['--migrate'], env, report)
    ).rejects.toThrow('invalid audit');
    expect(report).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(([sql]) => sql.includes('RELEASE_LOCK'))
    ).toBe(true);
    expect(f.release).toHaveBeenCalled();
    expect(f.destroy).toHaveBeenCalled();
  });
});

describe('identity maintenance arguments', () => {
  it('leaves normal startup alone', () =>
    expect(parseIdentityMaintenance([])).toBeNull());
  it.each([
    '--migrate',
    '--outbox-status',
    '--cleanup-status',
    '--erasure-status',
  ])('accepts explicit %s', (command) =>
    expect(parseIdentityMaintenance([command])).toEqual({
      mode: command.slice(2),
    })
  );
  it('accepts reviewed event and cleanup requeues', () => {
    expect(parseIdentityMaintenance(['--erasure-requeue', 'Uid'])).toEqual({
      mode: 'erasure-requeue',
      id: 'Uid',
    });
    expect(
      parseIdentityMaintenance([
        '--outbox-requeue',
        '00000000-0000-4000-8000-000000000001',
      ])?.mode
    ).toBe('outbox-requeue');
    expect(parseIdentityMaintenance(['--cleanup-requeue', 'Uid'])?.mode).toBe(
      'cleanup-requeue'
    );
  });
  it.each([
    ['--migrate', '--force'],
    ['--outbox-requeue'],
    ['--outbox-requeue', 'all'],
    ['--cleanup-requeue', ''],
    ['--rebuild'],
    ['--cleanup-status', '--apply'],
  ])(
    'rejects unsafe/incomplete arguments before reading configuration: %j',
    async (...args) => {
      await expect(runIdentityMaintenance(args, {}, jest.fn())).rejects.toThrow(
        'Expected'
      );
    }
  );
  it('requires explicit SQL configuration', () =>
    expect(() => identityDataSource({})).toThrow('MYSQL_PORT'));
});
