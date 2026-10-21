/**
 * Validates env at app bootstrap. Used by ConfigModule.forRoot({ validate }).
 * Throws if required vars are missing or invalid.
 */
export function validateAuthenticatorEnv(
  env: Record<string, unknown>
): Record<string, unknown> {
  const provider = env['AUTH_PROVIDER'];
  if (!['local', 'firebase'].includes(String(provider)))
    throw new Error('AUTH_PROVIDER must be local or firebase');
  if (provider === 'local' && env['NODE_ENV'] === 'production')
    throw new Error('Local authentication is for development only');
  if (provider === 'firebase') {
    for (const key of ['FIREBASE_PROJECT_ID', 'FIREBASE_WEB_API_KEY']) {
      if (typeof env[key] !== 'string' || !env[key].trim())
        throw new Error(`${key} is required`);
    }
  }
  if (
    provider === 'local' &&
    ['ENABLE_GOOGLE', 'ENABLE_GITHUB', 'ENABLE_ANONYMOUS'].some(
      (key) => env[key] === 'true'
    )
  )
    throw new Error('Local authentication supports email/password only');
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

  if (!/^[A-Za-z0-9_-]{32,128}$/.test(String(env['AUTH_SERVICE_SECRET'] ?? '')))
    throw new Error('AUTH_SERVICE_SECRET must be 32-128 URL-safe characters');
  if (!/^[\x21-\x7e]{1,128}$/.test(String(env['AUTH_ISSUER'] ?? '')))
    throw new Error('AUTH_ISSUER must be an exact issuer key');

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
  if (provider === 'firebase' && !get('FIREBASE_WEB_API_KEY')) {
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
