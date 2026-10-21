import { createHash } from 'node:crypto';
import { MysqlLocalCredentials } from '@sdk/extras/identity-local';
import {
  credentialDataSource,
  assertCredentialDatabase,
} from './credential-data-source';

/** Explicit local operator command; credentials come from the environment, never CLI arguments. */
export async function provisionLocalUser(
  env: Record<string, string | undefined>
): Promise<{ subject: string }> {
  if (env['AUTH_PROVIDER'] !== 'local' || env['NODE_ENV'] === 'production')
    throw new Error(
      'Local user provisioning requires development local authentication'
    );
  const email = env['LOCAL_AUTH_USER_EMAIL'] ?? '',
    password = env['LOCAL_AUTH_USER_PASSWORD'] ?? '';
  const source = credentialDataSource(env);
  await source.initialize();
  try {
    await assertCredentialDatabase(source);
    if (await source.showMigrations())
      throw new Error(
        'Run authentication --migrate before provisioning a local user'
      );
    const credentials = new MysqlLocalCredentials(source);
    const registration = await credentials.registerOrAuthenticate(
      email,
      password,
      `local-user:${createHash('sha256')
        .update(email.toLowerCase())
        .digest('hex')}`
    );
    if (!registration.ok) throw registration.error;
    await credentials.setOperatorClaims(registration.value.uid, {
      roles: (env['LOCAL_AUTH_USER_ROLES'] ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      ...(env['LOCAL_AUTH_USER_TENANT']
        ? { tenantId: env['LOCAL_AUTH_USER_TENANT'] }
        : {}),
    });
    return { subject: registration.value.uid };
  } finally {
    await source.destroy();
  }
}
