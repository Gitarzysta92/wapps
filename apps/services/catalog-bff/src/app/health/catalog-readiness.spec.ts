import { ConfigService } from '@nestjs/config';
import { CatalogReadiness, parseEditorialReadiness } from './catalog-readiness';
import { HealthController } from './health.controller';

const ready = () => ({
  status: 'ready',
  service: 'editorial',
  scope: 'editorial-catalog',
  checks: Object.fromEntries(
    ['sql', 'schema', 'outbox', 'projection', 'policy', 'materializer'].map(
      (name) => [name, { code: 'ok' }]
    )
  ),
});

describe('bounded owner readiness contract', () => {
  it('accepts a complete ready report and preserves distinct failure codes', () => {
    expect(parseEditorialReadiness(ready(), 200)?.schema).toEqual({
      code: 'ok',
    });
    const failed = ready();
    failed.status = 'unready';
    failed.checks.schema.code = 'schema_incompatible';
    expect(parseEditorialReadiness(failed, 503)?.schema.code).toBe(
      'schema_incompatible'
    );
  });

  it.each([
    null,
    {},
    { ...ready(), scope: 'all-services' },
    { ...ready(), checks: {} },
  ])('rejects incomplete or unrelated reports %p', (value) => {
    expect(parseEditorialReadiness(value, 200)).toBeNull();
  });

  it('rejects success-shaped owner failures and strips unrecognized data', () => {
    expect(parseEditorialReadiness(ready(), 503)).toBeNull();
    const value = ready();
    value.checks.policy.code = 'policy_unavailable';
    expect(parseEditorialReadiness(value, 200)).toBeNull();
    expect(
      parseEditorialReadiness(
        {
          ...ready(),
          secret: 'do-not-reflect',
          checks: {
            ...ready().checks,
            sql: { code: 'ok', password: 'do-not-reflect' },
          },
        },
        200
      )?.sql
    ).toEqual({ code: 'ok' });
  });

  it('never claims readiness without an explicitly configured owner; liveness still succeeds', async () => {
    const controller = new HealthController(
      new CatalogReadiness(new ConfigService())
    );
    expect(controller.check().status).toBe('ok');
    await expect(controller.ready()).rejects.toMatchObject({ status: 503 });
  });
});
