import { validateAuthenticatorEnv } from './env.validation';

describe('authenticator required configuration', () => {
  const env = {
    AUTH_PROVIDER: 'firebase',
    AUTH_SERVICE_SECRET: 'secret-'.repeat(8),
    AUTH_ISSUER: 'issuer-A',
    MYSQL_HOST: 'sql',
    MYSQL_PORT: '3306',
    MYSQL_USERNAME: 'identity',
    MYSQL_PASSWORD: 'test',
    MYSQL_DATABASE: 'identity',
    QUEUE_HOST: 'queue',
    QUEUE_USERNAME: 'identity',
    QUEUE_PASSWORD: 'test',
    FIREBASE_PROJECT_ID: 'test',
    FIREBASE_WEB_API_KEY: 'test',
    INGRESS_AUTH_SECRET: 'test',
  };
  it('accepts explicit local mode without Firebase configuration', () => {
    const local = {
      ...env,
      AUTH_PROVIDER: 'local',
      FIREBASE_PROJECT_ID: undefined,
      FIREBASE_WEB_API_KEY: undefined,
    };
    expect(validateAuthenticatorEnv(local)).toEqual(local);
  });
  it.each([
    { AUTH_PROVIDER: 'unknown' },
    { AUTH_PROVIDER: 'local', NODE_ENV: 'production' },
    { AUTH_PROVIDER: 'local', ENABLE_GOOGLE: 'true' },
    { AUTH_PROVIDER: 'local', ENABLE_ANONYMOUS: 'true' },
  ])('rejects invalid provider configuration %j', (config) => {
    expect(() => validateAuthenticatorEnv({ ...env, ...config })).toThrow();
  });
  it('requires service authentication', () =>
    expect(() =>
      validateAuthenticatorEnv({ ...env, AUTH_SERVICE_SECRET: '' })
    ).toThrow('AUTH_SERVICE_SECRET'));
  it('requires the REST key even when email/password is disabled', () =>
    expect(() =>
      validateAuthenticatorEnv({
        ...env,
        ENABLE_EMAIL_PASSWORD: 'false',
        FIREBASE_WEB_API_KEY: '',
      })
    ).toThrow('FIREBASE_WEB_API_KEY'));
  it.each(['3306junk', '0', '65536'])('rejects invalid SQL port %s', (port) =>
    expect(() =>
      validateAuthenticatorEnv({ ...env, MYSQL_PORT: port })
    ).toThrow()
  );
  it('does not require broker or Identity credentials', () => {
    expect(
      validateAuthenticatorEnv({
        ...env,
        QUEUE_HOST: undefined,
        QUEUE_USERNAME: undefined,
        QUEUE_PASSWORD: undefined,
        INGRESS_AUTH_SECRET: undefined,
      })
    ).toBeDefined();
  });
  it('accepts complete configuration with a default queue port', () =>
    expect(validateAuthenticatorEnv(env)).toEqual(env));
});
