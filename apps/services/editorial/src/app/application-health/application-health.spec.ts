import { ok, err } from '@sdk/kernel/standard';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  HealthUnavailableError,
  HealthConflictError,
  type HealthMonitor,
} from '@domains/reliability';
import {
  ApplicationHealth,
  ObserveApplicationHealth,
  type HealthStore,
} from './application-health';

const id = '10000000-0000-4000-8000-000000000001',
  applicationId = '10000000-0000-4000-8000-000000000002';
const monitor: HealthMonitor = {
  id,
  applicationId,
  revision: 1,
  name: 'Website',
  url: 'https://example.com/',
  enabled: true,
};
const actor = {
  identityId: 'Staff',
  tenantId: 'default',
  roles: ['editorial:health-manager'],
};
const now = Date.UTC(2026, 9, 13, 12);
const input = {
  expectedRevision: 0,
  expectedApplicationRevision: 1,
  name: monitor.name,
  url: monitor.url,
  enabled: true,
};
function setup() {
  const store: jest.Mocked<HealthStore> = {
    configurations: jest.fn(),
    configure: jest.fn().mockResolvedValue(monitor),
    read: jest.fn().mockResolvedValue([]),
    candidates: jest.fn().mockResolvedValue([id]),
    claim: jest.fn().mockResolvedValue({
      monitor,
      slotAt: now,
      leaseId: applicationId,
      expiresAt: now + 20_000,
    }),
    record: jest.fn(),
  };
  const policy = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  const health = new ApplicationHealth(store, policy, 'default', () => now);
  const probe = {
    observe: jest.fn().mockResolvedValue({
      status: 'operational',
      reason: 'http-success',
      httpStatus: 200,
      durationMs: 100,
    }),
  };
  const worker = new ObserveApplicationHealth(
    health,
    store,
    probe,
    () => applicationId,
    () => now
  );
  return { store, policy, health, worker, probe };
}
describe('Application health boundaries', () => {
  it('reports store failure as unavailable while preserving conflicts', async () => {
    const f = setup();
    f.store.configure.mockRejectedValue(new Error('SQL connection failed'));
    await expect(
      f.health.configure(actor, applicationId, id, input)
    ).rejects.toBeInstanceOf(HealthUnavailableError);
    f.store.configurations.mockRejectedValue(new Error('SQL unavailable'));
    await expect(
      f.health.configurations(actor, applicationId, {})
    ).rejects.toBeInstanceOf(HealthUnavailableError);
    f.store.configure.mockRejectedValue(new HealthConflictError('Changed'));
    await expect(
      f.health.configure(actor, applicationId, id, input)
    ).rejects.toBeInstanceOf(HealthConflictError);
  });
  it('authorizes configuration and management reads before parsing or persistence', async () => {
    const f = setup();
    f.policy.evaluate.mockResolvedValue(ok(false));
    await expect(
      f.health.configure(actor, applicationId, id, {})
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      f.health.configurations(actor, applicationId, {})
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(f.store.configure).not.toHaveBeenCalled();
    expect(f.store.configurations).not.toHaveBeenCalled();
  });
  it('rejects foreign tenant scope even with a permissive policy', async () => {
    const f = setup();
    await expect(
      f.health.configure(
        { ...actor, tenantId: 'other' },
        applicationId,
        id,
        input
      )
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(f.policy.evaluate).not.toHaveBeenCalled();
    expect(f.store.configure).not.toHaveBeenCalled();
  });
  it('fails closed on both explicit and thrown policy outages', async () => {
    const f = setup();
    f.policy.evaluate
      .mockResolvedValueOnce(err(new Error()))
      .mockRejectedValueOnce(new Error());
    for (let i = 0; i < 2; i++)
      await expect(
        f.health.configure(actor, applicationId, id, input)
      ).rejects.toBeInstanceOf(HealthUnavailableError);
    expect(f.store.configure).not.toHaveBeenCalled();
  });
  it('binds configuration to the canonical application and immutable next revision', async () => {
    const f = setup();
    await expect(
      f.health.configure(actor, applicationId, id, input)
    ).resolves.toEqual(monitor);
    expect(f.store.configure).toHaveBeenCalledWith({
      actor,
      monitor,
      expectedRevision: 0,
      expectedApplicationRevision: 1,
    });
    expect(f.policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'editorial.health.configure',
        resource: {
          type: 'application-health',
          id: applicationId,
          tenantId: 'default',
        },
      })
    );
  });
  it('rejects inconsistent stored selections without returning invented health', async () => {
    const f = setup();
    f.store.read.mockResolvedValue([
      {
        monitor: { ...monitor, applicationId: id },
        observations: [],
        latest: null,
      },
    ]);
    await expect(f.health.read(applicationId)).rejects.toBeInstanceOf(
      HealthUnavailableError
    );
    f.store.read.mockRejectedValue(new Error('storage'));
    await expect(f.health.read(applicationId)).rejects.toBeInstanceOf(
      HealthUnavailableError
    );
  });
  it('requires the exact worker policy before enumerating or probing', async () => {
    const f = setup();
    f.policy.evaluate.mockResolvedValue(ok(false));
    await expect(f.worker.batch(null)).rejects.toBeInstanceOf(
      PermissionDeniedError
    );
    expect(f.store.candidates).not.toHaveBeenCalled();
    expect(f.probe.observe).not.toHaveBeenCalled();
    expect(f.policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: 'wapps-health-monitor',
        tenantId: 'health',
        actionName: 'editorial.health.probe',
      })
    );
  });
  it('records only leased live observations and does not invent missed samples', async () => {
    const f = setup();
    expect(await f.worker.batch(null)).toEqual({
      after: null,
      recorded: 1,
      failed: 0,
    });
    expect(f.store.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        slotAt: now,
        observedAt: now,
        monitorId: id,
        configurationRevision: 1,
      }),
      now
    );
    f.store.claim.mockResolvedValue(null);
    await f.worker.batch(null);
    expect(f.probe.observe).toHaveBeenCalledTimes(1);
  });
  it('continues after one failed observation so other monitors are not starved', async () => {
    const f = setup();
    f.store.candidates.mockResolvedValue([id, applicationId]);
    f.store.claim.mockRejectedValueOnce(new Error('changed'));
    expect(await f.worker.batch(null)).toEqual({
      after: null,
      recorded: 1,
      failed: 1,
    });
    expect(f.store.claim).toHaveBeenCalledTimes(2);
  });
});
