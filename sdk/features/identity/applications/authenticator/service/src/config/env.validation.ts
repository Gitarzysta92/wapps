/**
 * Validates env at app bootstrap. Used by ConfigModule.forRoot({ validate }).
 * Throws if required vars are missing or invalid.
 */
export function validateAuthenticatorEnv(
  env: Record<string, unknown>
): Record<string, unknown> {
  const get = (key: string): string | undefined =>
    env[key] === undefined || env[key] === null
      ? undefined
      : String(env[key]).trim() || undefined;

  const missing: string[] = [];

  // MySQL (required)
  if (!get('MYSQL_HOST')) missing.push('MYSQL_HOST');
  const portRaw = get('MYSQL_PORT');
  if (portRaw === undefined || portRaw === '') missing.push('MYSQL_PORT');
  else {
    const port = Number(portRaw);
    if (
      !/^\d+$/.test(portRaw) ||
      !Number.isInteger(port) ||
      port <= 0 ||
      port > 65535
    ) {
      throw new Error(
        `Authenticator startup failed: MYSQL_PORT must be a positive integer, received "${portRaw}".`
      );
    }
  }
  if (!get('MYSQL_USERNAME')) missing.push('MYSQL_USERNAME');
  if (!get('MYSQL_PASSWORD')) missing.push('MYSQL_PASSWORD');
  if (!get('MYSQL_DATABASE')) missing.push('MYSQL_DATABASE');

  for (const key of [
    'QUEUE_HOST',
    'QUEUE_USERNAME',
    'QUEUE_PASSWORD',
    'FIREBASE_PROJECT_ID',
    'INGRESS_AUTH_SECRET',
  ]) {
    if (!get(key)) missing.push(key);
  }
  const queuePort = get('QUEUE_PORT');
  if (
    queuePort !== undefined &&
    (!/^\d+$/.test(queuePort) ||
      Number(queuePort) < 1 ||
      Number(queuePort) > 65535)
  )
    throw new Error('QUEUE_PORT must be a TCP port');

  // OAuth (conditional)
  const enableGoogle = get('ENABLE_GOOGLE') === 'true';
  const enableGithub = get('ENABLE_GITHUB') === 'true';
  if (enableGoogle) {
    if (!get('GOOGLE_CLIENT_ID')) missing.push('GOOGLE_CLIENT_ID');
    if (!get('GOOGLE_CLIENT_SECRET')) missing.push('GOOGLE_CLIENT_SECRET');
  }
  if (enableGithub) {
    if (!get('GITHUB_CLIENT_ID')) missing.push('GITHUB_CLIENT_ID');
    if (!get('GITHUB_CLIENT_SECRET')) missing.push('GITHUB_CLIENT_SECRET');
  }

  // Every REST session flow, including OAuth token exchange, requires this key.
  if (!get('FIREBASE_WEB_API_KEY')) {
    missing.push('FIREBASE_WEB_API_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `Authenticator startup failed: missing required env: ${missing.join(
        ', '
      )}. Set them or disable the corresponding provider.`
    );
  }

  return env;
}
