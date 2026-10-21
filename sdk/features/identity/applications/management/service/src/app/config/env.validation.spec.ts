import { validateManagementEnv } from './env.validation';

const valid = {
  MYSQL_HOST: 'sql',
  MYSQL_PORT: '3306',
  MYSQL_DATABASE: 'identity',
  MYSQL_USERNAME: 'identity',
  MYSQL_PASSWORD: 'test',
  QUEUE_HOST: 'queue',
  QUEUE_USERNAME: 'test',
  QUEUE_PASSWORD: 'test',
  AUTHENTICATION_URL: 'http://credentials.test',
  AUTH_ISSUER: 'issuer-A',
  AUTH_SERVICE_SECRET: 'secret-'.repeat(8),
  INGRESS_AUTH_SECRET: 'test',
  ACCOUNT_EXPORT_SOURCE_SECRET: 'export-test-'.repeat(4),
  ACCOUNT_ERASURE_SECRET: 'qualification-erasure-secret-2026-only',
  NOTIFICATION_SERVICE_SECRET: 'qualification-notification-secret-2026-only',
  OPA_URL: 'http://opa:8181',
  EDITORIAL_URL: 'http://editorial:1337',
  DISCUSSION_URL: 'http://discussion:1338',
};
describe('management configuration', () => {
  it('accepts explicit local credentials without Firebase configuration', () => {
    const local = {
      ...valid,
      AUTH_PROVIDER: 'local',
      FIREBASE_PROJECT_ID: undefined,
      FIREBASE_WEB_API_KEY: undefined,
    };
    expect(validateManagementEnv(local)).toEqual(local);
  });
  it('rejects weak or reused authentication-service credentials', () => {
    expect(() =>
      validateManagementEnv({ ...valid, AUTH_SERVICE_SECRET: 'short' })
    ).toThrow('AUTH_SERVICE_SECRET');
    expect(() =>
      validateManagementEnv({
        ...valid,
        AUTH_SERVICE_SECRET: valid.ACCOUNT_EXPORT_SOURCE_SECRET,
      })
    ).toThrow('AUTH_SERVICE_SECRET');
  });
  it.each([
    'short',
    'x'.repeat(129),
    valid.INGRESS_AUTH_SECRET,
    valid.ACCOUNT_EXPORT_SOURCE_SECRET,
    valid.ACCOUNT_ERASURE_SECRET,
  ])('rejects weak or reused notification credentials: %s', (value) => {
    expect(() =>
      validateManagementEnv({ ...valid, NOTIFICATION_SERVICE_SECRET: value })
    ).toThrow('NOTIFICATION_SERVICE_SECRET');
  });
  it.each([
    'REPLY_NOTIFICATION_WORKER_ENABLED',
    'MENTION_NOTIFICATION_WORKER_ENABLED',
    'FAVORITE_UPDATE_WORKER_ENABLED',
  ])('requires an explicit boolean string to activate %s', (flag) => {
    expect(
      validateManagementEnv({
        ...valid,
        [flag]: 'true',
      })
    ).toBeDefined();
    expect(() =>
      validateManagementEnv({
        ...valid,
        [flag]: 'yes',
      })
    ).toThrow(flag);
  });
  it.each([
    'short',
    'x'.repeat(129),
    'has spaces'.repeat(4),
    valid.ACCOUNT_EXPORT_SOURCE_SECRET,
    valid.INGRESS_AUTH_SECRET,
  ])('rejects invalid or shared erasure credentials (%s)', (value) => {
    expect(() =>
      validateManagementEnv({ ...valid, ACCOUNT_ERASURE_SECRET: value })
    ).toThrow();
  });
  it.each(['short', 'x'.repeat(129), 'has spaces'.repeat(4)])(
    'rejects invalid export credentials (%s)',
    (value) =>
      expect(() =>
        validateManagementEnv({ ...valid, ACCOUNT_EXPORT_SOURCE_SECRET: value })
      ).toThrow()
  );
  it('rejects reuse of ingress credentials for private export capture', () =>
    expect(() =>
      validateManagementEnv({
        ...valid,
        INGRESS_AUTH_SECRET: valid.ACCOUNT_EXPORT_SOURCE_SECRET,
      })
    ).toThrow());
  it('requires concrete production adapters', () =>
    expect(validateManagementEnv(valid)).toEqual(valid));
  it.each(Object.keys(valid))('refuses missing %s', (key) =>
    expect(() => validateManagementEnv({ ...valid, [key]: '' })).toThrow()
  );
  it.each(['0', '65536', '1234abc', '-1'])(
    'refuses invalid SQL port %s',
    (port) =>
      expect(() =>
        validateManagementEnv({ ...valid, MYSQL_PORT: port })
      ).toThrow()
  );
  it('refuses non-HTTP policy URLs', () =>
    expect(() =>
      validateManagementEnv({ ...valid, OPA_URL: 'file:///tmp/policy' })
    ).toThrow());
});
