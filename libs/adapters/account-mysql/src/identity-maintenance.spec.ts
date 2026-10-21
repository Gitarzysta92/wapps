import {
  identityDataSource,
  parseIdentityMaintenance,
  runIdentityMaintenance,
} from './identity-maintenance';
import { DataSource } from 'typeorm';
import { MysqlQueryRunner } from 'typeorm/driver/mysql/MysqlQueryRunner';
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { legacyEvidenceHash } from './legacy-identity-plan';

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

describe('offline legacy plan files', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'legacy-plan-test-'));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  it('produces a private plan without database configuration and never overwrites an existing plan', async () => {
    const identityId = '01992000-0000-7000-8000-000000000001';
    const input = join(directory, 'evidence.json'),
      output = join(directory, 'plan.json');
    await writeFile(
      input,
      JSON.stringify({
        sourceDatabase: 'legacy_identity',
        capturedAt: 200,
        subjects: [
          {
            id: 'external-mapping',
            provider: 'provider',
            externalId: 'external',
            identityId,
            createdAt: 100,
            updatedAt: 100,
            deletedAt: 0,
          },
        ],
        nodes: [
          {
            _id: 'node',
            id: identityId,
            kind: 'identity',
            createdAt: 100,
            updatedAt: 100,
            deletedAt: 0,
          },
        ],
        accounts: [
          {
            _id: identityId,
            status: 'STUB',
            createdAt: 100,
            updatedAt: 100,
            deletedAt: 0,
          },
        ],
        profiles: [
          { _id: identityId, createdAt: 100, updatedAt: 100, deletedAt: 0 },
        ],
      })
    );
    const report = jest.fn();
    expect(
      await runIdentityMaintenance(['--legacy-plan', input, output], {}, report)
    ).toBe(0);
    const plan = JSON.parse(await readFile(output, 'utf8'));
    expect(report).toHaveBeenCalledWith({
      planned: 1,
      policy: 'restricted-stubs',
      approvedHash: legacyEvidenceHash(plan),
    });
    expect((await stat(output)).mode & 0o777).toBe(0o600);
    await expect(
      runIdentityMaintenance(['--legacy-plan', input, output], {}, report)
    ).rejects.toMatchObject({ code: 'EEXIST' });
  });
  it('refuses symlink evidence', async () => {
    const input = join(directory, 'evidence.json'),
      link = join(directory, 'link.json');
    await writeFile(input, '{}');
    await symlink(input, link);
    await expect(
      runIdentityMaintenance(
        ['--legacy-plan', link, join(directory, 'out.json')],
        {},
        jest.fn()
      )
    ).rejects.toMatchObject({ code: 'ELOOP' });
  });
  it('refuses oversized evidence before parsing', async () => {
    const input = join(directory, 'large.json');
    await writeFile(input, Buffer.alloc(1024 * 1024 + 1));
    await expect(
      runIdentityMaintenance(
        ['--legacy-plan', input, join(directory, 'out.json')],
        {},
        jest.fn()
      )
    ).rejects.toThrow('bounded regular file');
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
  it('requires an exact reviewed hash for staged legacy import', () => {
    expect(
      parseIdentityMaintenance(['--legacy-plan', 'source.json', 'plan.json'])
    ).toEqual({
      mode: 'legacy-plan',
      input: 'source.json',
      output: 'plan.json',
    });
    expect(
      parseIdentityMaintenance(['--legacy-import', 'plan.json', 'a'.repeat(64)])
    ).toEqual({
      mode: 'legacy-import',
      input: 'plan.json',
      approvedHash: 'a'.repeat(64),
    });
    expect(() =>
      parseIdentityMaintenance(['--legacy-import', 'plan.json', '--force'])
    ).toThrow('Expected');
  });
});
