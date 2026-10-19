import { DataSource } from 'typeorm';
import { FirebaseRegistration1792454400000 } from '@sdk/extras/identity-firebase';
import {
  LocalCredentials1792281600000,
  LocalEnrollment1792281602000,
} from '@sdk/extras/identity-local';

/** Refuse accidental reuse of a database owned by another capability. */
export async function assertCredentialDatabase(
  source: DataSource
): Promise<void> {
  const rows: Record<string, string>[] = await source.query('SHOW TABLES');
  const allowed = new Set([
    'migrations',
    'local_credential_users',
    'local_credential_sessions',
    'local_credential_enrollments',
    'firebase_credential_enrollments',
  ]);
  if (rows.some((row) => !allowed.has(Object.values(row)[0])))
    throw new Error('Authentication requires its own credential database');
}

export function credentialDataSource(
  env: Record<string, string | undefined>
): DataSource {
  const required = (name: string) => {
    const value = env[name];
    if (!value?.trim()) throw new Error(`${name} is required`);
    return value;
  };
  const port = Number(required('MYSQL_PORT'));
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid credential database port');
  return new DataSource({
    type: 'mysql',
    host: required('MYSQL_HOST'),
    port,
    username: required('MYSQL_USERNAME'),
    password: required('MYSQL_PASSWORD'),
    database: required('MYSQL_DATABASE'),
    entities: [],
    synchronize: false,
    migrationsRun: false,
    migrationsTransactionMode: 'none',
    migrations: [
      LocalCredentials1792281600000,
      LocalEnrollment1792281602000,
      FirebaseRegistration1792454400000,
    ],
    logging: false,
  });
}
