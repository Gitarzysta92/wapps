export function validateManagementEnv(
  env: Record<string, unknown>
): Record<string, unknown> {
  if (!/^[\x21-\x7e]{1,128}$/.test(String(env['AUTH_ISSUER'] ?? '')))
    throw new Error('AUTH_ISSUER must be an exact issuer key');
  if (
    !/^[A-Za-z0-9_-]{32,128}$/.test(String(env['AUTH_SERVICE_SECRET'] ?? '')) ||
    [
      'INGRESS_AUTH_SECRET',
      'ACCOUNT_EXPORT_SOURCE_SECRET',
      'ACCOUNT_ERASURE_SECRET',
      'NOTIFICATION_SERVICE_SECRET',
    ].some((key) => env[key] === env['AUTH_SERVICE_SECRET'])
  )
    throw new Error(
      'AUTH_SERVICE_SECRET must be a distinct service credential'
    );
  if (
    ['ENABLE_GOOGLE', 'ENABLE_GITHUB', 'ENABLE_ANONYMOUS'].some(
      (key) => env[key] === 'true'
    )
  )
    throw new Error(
      'Only the password-session authentication contract is currently enabled'
    );
  for (const key of [
    'AUTHENTICATION_URL',
    'MYSQL_HOST',
    'MYSQL_PORT',
    'MYSQL_DATABASE',
    'MYSQL_USERNAME',
    'MYSQL_PASSWORD',
    'QUEUE_HOST',
    'QUEUE_USERNAME',
    'QUEUE_PASSWORD',
    'INGRESS_AUTH_SECRET',
    'ACCOUNT_EXPORT_SOURCE_SECRET',
    'ACCOUNT_ERASURE_SECRET',
    'NOTIFICATION_SERVICE_SECRET',
    'OPA_URL',
    'EDITORIAL_URL',
    'DISCUSSION_URL',
  ]) {
    if (typeof env[key] !== 'string' || !env[key].trim())
      throw new Error(`${key} is required`);
  }
  if (
    !/^[A-Za-z0-9_-]{32,128}$/.test(
      String(env['ACCOUNT_EXPORT_SOURCE_SECRET'])
    ) ||
    env['ACCOUNT_EXPORT_SOURCE_SECRET'] === env['INGRESS_AUTH_SECRET']
  )
    throw new Error(
      'ACCOUNT_EXPORT_SOURCE_SECRET must be 32-128 URL-safe characters distinct from ingress authentication'
    );
  if (
    !/^[A-Za-z0-9_-]{32,128}$/.test(String(env['ACCOUNT_ERASURE_SECRET'])) ||
    env['ACCOUNT_ERASURE_SECRET'] === env['INGRESS_AUTH_SECRET'] ||
    env['ACCOUNT_ERASURE_SECRET'] === env['ACCOUNT_EXPORT_SOURCE_SECRET']
  )
    throw new Error(
      'ACCOUNT_ERASURE_SECRET must be 32-128 URL-safe characters distinct from ingress and export authentication'
    );
  if (
    !/^[A-Za-z0-9_-]{32,128}$/.test(
      String(env['NOTIFICATION_SERVICE_SECRET'])
    ) ||
    [
      'INGRESS_AUTH_SECRET',
      'ACCOUNT_EXPORT_SOURCE_SECRET',
      'ACCOUNT_ERASURE_SECRET',
    ].some((key) => env[key] === env['NOTIFICATION_SERVICE_SECRET'])
  )
    throw new Error(
      'NOTIFICATION_SERVICE_SECRET must be 32-128 URL-safe characters distinct from other service credentials'
    );
  if (
    env['REPLY_NOTIFICATION_WORKER_ENABLED'] !== undefined &&
    env['REPLY_NOTIFICATION_WORKER_ENABLED'] !== 'true' &&
    env['REPLY_NOTIFICATION_WORKER_ENABLED'] !== 'false'
  )
    throw new Error('REPLY_NOTIFICATION_WORKER_ENABLED must be true or false');
  if (
    env['MENTION_NOTIFICATION_WORKER_ENABLED'] !== undefined &&
    env['MENTION_NOTIFICATION_WORKER_ENABLED'] !== 'true' &&
    env['MENTION_NOTIFICATION_WORKER_ENABLED'] !== 'false'
  )
    throw new Error(
      'MENTION_NOTIFICATION_WORKER_ENABLED must be true or false'
    );
  if (
    env['FAVORITE_UPDATE_WORKER_ENABLED'] !== undefined &&
    env['FAVORITE_UPDATE_WORKER_ENABLED'] !== 'true' &&
    env['FAVORITE_UPDATE_WORKER_ENABLED'] !== 'false'
  )
    throw new Error('FAVORITE_UPDATE_WORKER_ENABLED must be true or false');
  for (const key of ['MYSQL_PORT', 'QUEUE_PORT']) {
    const value = env[key] ?? '5672';
    if (
      typeof value !== 'string' ||
      !/^\d+$/.test(value) ||
      Number(value) < 1 ||
      Number(value) > 65535
    )
      throw new Error(`${key} must be a TCP port`);
  }
  const opa = new URL(String(env['OPA_URL']));
  if (
    !['http:', 'https:'].includes(opa.protocol) ||
    opa.username ||
    opa.password
  )
    throw new Error('OPA_URL must be an HTTP(S) service URL');
  for (const key of ['EDITORIAL_URL', 'DISCUSSION_URL', 'AUTHENTICATION_URL']) {
    const origin = new URL(String(env[key]));
    if (
      !['http:', 'https:'].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== '/'
    )
      throw new Error(`${key} must be an HTTP service origin`);
  }
  return env;
}
