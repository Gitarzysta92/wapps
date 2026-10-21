import {
  diagnoseMaintenanceDatabase,
  safeMaintenanceErrors,
  safeMaintenanceLogger,
} from './maintenance-diagnostics';

describe('safe maintenance database diagnostics', () => {
  it('suppresses ORM SQL/error output and emits only a trusted failed migration identity', () => {
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const logger = safeMaintenanceLogger(['KnownMigration1234567890123']);
      logger.logQueryError('private', 'private SQL', ['private']);
      logger.logMigration('Migrations failed, error: private');
      logger.logMigration('Migration "foreign" failed, error: private');
      logger.logMigration(
        'Migration "KnownMigration1234567890123" failed, error: private'
      );
      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.parse(log.mock.calls[0][0])).toEqual({
        event: 'editorial_maintenance_migration_failure',
        migration: 'KnownMigration1234567890123',
      });
    } finally {
      log.mockRestore();
    }
  });
  it('retains nested driver and aggregate network codes without sensitive error fields', () => {
    const secret = 'mysql://operator:credential@host/private';
    const driver = Object.assign(new Error(secret), {
      code: 'ER_ACCESS_DENIED_ERROR',
      errno: 1045,
      sqlState: '28000',
      sql: secret,
      parameters: [secret],
      config: { password: secret },
    });
    const error = Object.assign(new Error(secret), {
      name: 'AggregateError',
      errors: [
        Object.assign(new Error(secret), {
          code: 'ECONNREFUSED',
          syscall: 'connect',
          address: secret,
        }),
        Object.assign(new Error(secret), { driverError: driver }),
      ],
    });
    const details = safeMaintenanceErrors(error);
    expect(details).toContainEqual({
      name: 'Error',
      code: 'ECONNREFUSED',
      syscall: 'connect',
    });
    expect(details).toContainEqual({
      name: 'Error',
      code: 'ER_ACCESS_DENIED_ERROR',
      errno: 1045,
      sqlState: '28000',
    });
    expect(JSON.stringify(details)).not.toContain(secret);
    expect(JSON.stringify(details)).not.toMatch(
      /parameters|password|address|stack|message|config/
    );
  });

  it('bounds cyclic errors, rejects unknown fields and does not invoke accessors', () => {
    const getter = jest.fn(() => {
      throw new Error('sensitive');
    });
    const error = {
      name: 'secret',
      code: 'SECRET',
      errno: -1,
      sqlState: 'SECRT',
      cause: {},
    };
    error.cause = error;
    Object.defineProperty(error, 'driverError', { get: getter });
    expect(safeMaintenanceErrors(error)).toEqual([{ name: 'Error' }]);
    expect(getter).not.toHaveBeenCalled();
    expect(
      safeMaintenanceErrors({
        name: 'AggregateError',
        errors: Array.from({ length: 100 }, () => new Error()),
      })
    ).toHaveLength(8);
  });

  it('reports the operation exactly once and preserves failure identity and successful results', async () => {
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const error = Object.assign(new Error('private SQL'), {
        code: 'ETIMEDOUT',
      });
      const action = jest.fn().mockRejectedValue(error);
      await expect(
        diagnoseMaintenanceDatabase('initialize', action)
      ).rejects.toBe(error);
      expect(action).toHaveBeenCalledTimes(1);
      expect(JSON.parse(log.mock.calls[0][0])).toEqual({
        event: 'editorial_maintenance_database_failure',
        operation: 'initialize',
        elapsedMs: expect.any(Number),
        errors: [{ name: 'Error', code: 'ETIMEDOUT' }],
      });
      expect(
        await diagnoseMaintenanceDatabase('runMigrations', async () => 27)
      ).toBe(27);
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
});
