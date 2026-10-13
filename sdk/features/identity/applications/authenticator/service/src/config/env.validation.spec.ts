import { validateAuthenticatorEnv } from './env.validation';

describe('authenticator required configuration', () => {
  const env = {
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
  it('requires trusted-ingress configuration', () =>
    expect(() =>
      validateAuthenticatorEnv({ ...env, INGRESS_AUTH_SECRET: '' })
    ).toThrow('INGRESS_AUTH_SECRET'));
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
  it('rejects invalid queue ports', () =>
    expect(() =>
      validateAuthenticatorEnv({ ...env, QUEUE_PORT: '5672junk' })
    ).toThrow());
  it('accepts complete configuration with a default queue port', () =>
    expect(validateAuthenticatorEnv(env)).toEqual(env));
});
