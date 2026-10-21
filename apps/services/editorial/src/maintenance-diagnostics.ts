import type { Logger } from 'typeorm';

type DatabaseOperation = 'initialize' | 'runMigrations' | 'destroy';

const codes = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ER_CON_COUNT_ERROR',
  'ER_TOO_MANY_USER_CONNECTIONS',
  'ER_SERVER_SHUTDOWN',
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
  'ER_DUP_ENTRY',
  'ER_TABLE_EXISTS_ERROR',
  'ER_NO_SUCH_TABLE',
  'ER_BAD_FIELD_ERROR',
  'ER_PARSE_ERROR',
  'ER_SIGNAL_EXCEPTION',
]);
const names = new Set([
  'Error',
  'AggregateError',
  'QueryFailedError',
  'TypeORMError',
]);
const states = new Set([
  'HY000',
  'HY001',
  'HYT00',
  'HYT01',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08S01',
  '28000',
  '40001',
  '23000',
  '42000',
  '42S01',
  '42S02',
  '42S21',
  '42S22',
  '45000',
]);

/** Never copy messages, stacks, connection options, SQL, parameters or unknown codes. */
export function safeMaintenanceErrors(
  error: unknown
): Record<string, unknown>[] {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  const result: Record<string, unknown>[] = [];
  while (pending.length && result.length < 8) {
    const value = pending.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    const field = (key: string): unknown => {
      // Avoid invoking arbitrary accessors while reporting another failure.
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor && 'value' in descriptor ? descriptor.value : undefined;
    };
    const detail: Record<string, unknown> = {};
    const name =
      field('name') ??
      Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(value) ?? {},
        'name'
      )?.value;
    detail.name = typeof name === 'string' && names.has(name) ? name : 'Error';
    const code = field('code'),
      errno = field('errno'),
      state = field('sqlState');
    if (typeof code === 'string' && codes.has(code)) detail.code = code;
    if (
      typeof errno === 'number' &&
      Number.isSafeInteger(errno) &&
      errno > 0 &&
      errno <= 65535
    )
      detail.errno = errno;
    if (typeof state === 'string' && states.has(state)) detail.sqlState = state;
    const syscall = field('syscall');
    if (
      syscall === 'connect' ||
      syscall === 'read' ||
      syscall === 'write' ||
      syscall === 'getaddrinfo'
    )
      detail.syscall = syscall;
    result.push(detail);
    pending.push(field('driverError'), field('cause'));
    const errors = field('errors');
    if (Array.isArray(errors)) pending.push(...errors.slice(0, 8));
  }
  return result;
}

export async function diagnoseMaintenanceDatabase<T>(
  operation: DatabaseOperation,
  action: () => Promise<T>
): Promise<T> {
  const started = Date.now();
  try {
    return await action();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'editorial_maintenance_database_failure',
        operation,
        elapsedMs: Math.max(0, Date.now() - started),
        errors: safeMaintenanceErrors(error),
      })
    );
    throw error;
  }
}

/** TypeORM logs migration exception messages even with logging:false. */
export function safeMaintenanceLogger(migrations: readonly string[]): Logger {
  return {
    logQuery: () => undefined,
    logQueryError: () => undefined,
    logQuerySlow: () => undefined,
    logSchemaBuild: () => undefined,
    log: () => undefined,
    logMigration: (message: string) => {
      const migration = migrations.find((name) =>
        message.startsWith(`Migration "${name}" failed, error:`)
      );
      if (migration)
        console.error(
          JSON.stringify({
            event: 'editorial_maintenance_migration_failure',
            migration,
          })
        );
    },
  };
}
