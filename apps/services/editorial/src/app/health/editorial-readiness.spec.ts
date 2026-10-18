import { ConfigService } from '@nestjs/config';
import {
  EditorialReadiness,
  MaterializerProgress,
  QueueObservation,
} from './editorial-readiness';
import { EditorialReadinessProbes } from './editorial-readiness.probes';
import { HealthController } from './health.controller';

const idle: QueueObservation = {
  pending: 0,
  failed: 0,
  consumers: 1,
  unacknowledged: 0,
  acknowledged: 4,
};

describe('Editorial catalog operational readiness', () => {
  it('detects a live but stuck consumer and recovers after acknowledgement', () => {
    const progress = new MaterializerProgress();
    const blocked = { ...idle, unacknowledged: 1 };
    expect(progress.inspect(blocked, 0, 1000).code).toBe('ok');
    expect(progress.inspect(blocked, 1000, 1000).code).toBe('worker_stalled');
    expect(
      progress.inspect({ ...blocked, acknowledged: 5 }, 1100, 1000).code
    ).toBe('ok');
    expect(progress.inspect(idle, 3000, 1000).stalledMs).toBe(0);
  });

  it('reports absent consumers and retained poison independently of connectivity', () => {
    const progress = new MaterializerProgress();
    expect(progress.inspect({ ...idle, consumers: 0 }, 0, 1000).code).toBe(
      'worker_missing'
    );
    expect(progress.inspect({ ...idle, failed: 1 }, 0, 1000)).toMatchObject({
      code: 'poison_messages',
      failed: 1,
    });
    expect(progress.inspect(idle, 1000, 1000).code).toBe('ok');
  });

  it('shares concurrent read-only probes and keeps liveness available during a dependency outage', async () => {
    const probes = {
      sql: jest.fn(async () => ({
        sql: { code: 'ok' },
        schema: { code: 'schema_incompatible' },
        outbox: { code: 'not_checked' },
      })),
      projection: jest.fn(async () => ({ code: 'ok' })),
      policy: jest.fn(async () => ({ code: 'policy_unavailable' })),
      queue: jest.fn(async () => idle),
    };
    const readiness = new EditorialReadiness(
      probes as unknown as EditorialReadinessProbes,
      new ConfigService()
    );
    const [first, second] = await Promise.all([
      readiness.check(),
      readiness.check(),
    ]);
    expect(first).toEqual(second);
    expect(first.status).toBe('unready');
    expect(first.checks.schema.code).toBe('schema_incompatible');
    expect(probes.sql).toHaveBeenCalledTimes(1);
    const controller = new HealthController(readiness);
    expect(controller.check().status).toBe('ok');
    await expect(controller.ready()).rejects.toMatchObject({ status: 503 });
  });
});
