import {
  HEALTH_INTERVAL_MS,
  HEALTH_MAX_MONITORS,
  HealthNotFoundError,
  HealthInputError,
  HealthConflictError,
  HealthUnavailableError,
  healthId,
  healthInteger,
  healthObject,
  parseHealthMonitor,
  parseHealthObservation,
  summarizeMonitor,
  type HealthMonitor,
  type HealthObservation,
} from '@domains/reliability';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import type { EditorialActor } from '../application/editorial.ports';
import { assertEditorialActor } from '../application/editorial-commands';
import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';

export interface HealthConfiguration {
  monitor: HealthMonitor;
  expectedRevision: number;
  expectedApplicationRevision: number;
  actor: EditorialActor;
}
export interface ProbeLease {
  monitor: HealthMonitor;
  slotAt: number;
  leaseId: string;
  expiresAt: number;
}
export interface HealthStore {
  configurations(applicationId: string): Promise<{
    applicationRevision: number;
    website: string;
    monitors: HealthMonitor[];
  }>;
  configure(command: HealthConfiguration): Promise<HealthMonitor>;
  read(
    applicationId: string,
    now: number
  ): Promise<
    {
      monitor: HealthMonitor;
      observations: HealthObservation[];
      latest: HealthObservation | null;
    }[]
  >;
  candidates(after: string | null): Promise<string[]>;
  claim(id: string, leaseId: string, now: number): Promise<ProbeLease | null>;
  record(
    lease: ProbeLease,
    observation: HealthObservation,
    now: number
  ): Promise<void>;
}
export interface HealthProbe {
  observe(
    url: string
  ): Promise<
    Pick<HealthObservation, 'status' | 'reason' | 'httpStatus' | 'durationMs'>
  >;
}

export class ApplicationHealth {
  constructor(
    private readonly store: HealthStore,
    private readonly policy: IPolicyEvaluator,
    private readonly publicTenant: string,
    private readonly clock: () => number = Date.now
  ) {}
  async configurations(
    actor: EditorialActor,
    applicationId: string,
    query: unknown
  ) {
    assertEditorialActor(actor);
    healthId(applicationId);
    if (actor.tenantId !== this.publicTenant)
      throw new PermissionDeniedError('editorial.health.configure');
    await this.authorize(
      actor,
      'editorial.health.configure',
      'application-health',
      applicationId
    );
    healthObject(query, []);
    return this.stored(() => this.store.configurations(applicationId));
  }
  async configure(
    actor: EditorialActor,
    applicationId: string,
    id: string,
    input: unknown
  ) {
    assertEditorialActor(actor);
    healthId(applicationId);
    healthId(id);
    if (actor.tenantId !== this.publicTenant)
      throw new PermissionDeniedError('editorial.health.configure');
    await this.authorize(
      actor,
      'editorial.health.configure',
      'application-health',
      applicationId
    );
    const body = healthObject(input, [
      'expectedRevision',
      'expectedApplicationRevision',
      'name',
      'url',
      'enabled',
    ]);
    const expectedRevision = healthInteger(body['expectedRevision']),
      expectedApplicationRevision = healthInteger(
        body['expectedApplicationRevision'],
        1
      );
    const monitor = parseHealthMonitor({
      id,
      applicationId,
      revision: expectedRevision + 1,
      name: body['name'],
      url: body['url'],
      enabled: body['enabled'],
    });
    return this.stored(() =>
      this.store.configure({
        monitor,
        expectedRevision,
        expectedApplicationRevision,
        actor,
      })
    );
  }
  async read(applicationId: string) {
    healthId(applicationId);
    const now = this.clock();
    try {
      const rows = await this.store.read(healthId(applicationId), now);
      if (
        rows.length > HEALTH_MAX_MONITORS ||
        new Set(rows.map((row) => row.monitor.id)).size !== rows.length ||
        rows.some((row) => row.monitor.applicationId !== applicationId)
      )
        throw new HealthUnavailableError('Invalid health selection');
      return {
        asOf: now,
        monitors: rows.map((row) =>
          summarizeMonitor(row.monitor, row.observations, now, row.latest)
        ),
      };
    } catch (error) {
      if (error instanceof HealthNotFoundError) throw error;
      throw new HealthUnavailableError(
        'Application observations are temporarily unavailable'
      );
    }
  }
  async authorizeWorker() {
    await this.authorize(
      {
        identityId: 'wapps-health-monitor',
        tenantId: 'health',
        roles: ['health:monitor'],
      },
      'editorial.health.probe',
      'health-worker',
      'editorial'
    );
  }
  private async stored<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (
        error instanceof HealthInputError ||
        error instanceof HealthConflictError ||
        error instanceof HealthNotFoundError ||
        error instanceof CanonicalIdentityAccessDenied
      )
        throw error;
      throw new HealthUnavailableError(
        'Health configuration is temporarily unavailable'
      );
    }
  }
  private async authorize(
    actor: EditorialActor,
    actionName: string,
    type: string,
    id: string
  ) {
    let decision;
    try {
      decision = await this.policy.evaluate({
        identityId: actor.identityId,
        tenantId: actor.tenantId,
        actionName,
        timestamp: this.clock(),
        subject: { roles: actor.roles },
        resource: { type, id, tenantId: actor.tenantId },
      });
    } catch {
      throw new HealthUnavailableError('Health authorization is unavailable');
    }
    if (!decision.ok)
      throw new HealthUnavailableError('Health authorization is unavailable');
    if (decision.value !== true) throw new PermissionDeniedError(actionName);
  }
}

/** Missed intervals stay missing: a later request cannot measure an earlier slot. */
export class ObserveApplicationHealth {
  constructor(
    private readonly access: Pick<ApplicationHealth, 'authorizeWorker'>,
    private readonly store: HealthStore,
    private readonly probe: HealthProbe,
    private readonly newId: () => string,
    private readonly clock: () => number = Date.now
  ) {}
  async batch(after: string | null) {
    await this.access.authorizeWorker();
    if (after) healthId(after);
    const ids = await this.store.candidates(after);
    if (
      ids.length > 20 ||
      ids.some((id, i) => id <= (i ? ids[i - 1] : after ?? ''))
    )
      throw new HealthUnavailableError('Invalid monitor batch');
    let recorded = 0,
      failed = 0;
    for (const id of ids) {
      healthId(id);
      try {
        const now = this.clock();
        if (now % HEALTH_INTERVAL_MS > HEALTH_INTERVAL_MS - 15_000) continue;
        const lease = await this.store.claim(
          healthId(id),
          healthId(this.newId()),
          now
        );
        if (!lease) continue;
        const evidence = await this.probe.observe(lease.monitor.url),
          observedAt = this.clock();
        const observation = parseHealthObservation({
          ...evidence,
          monitorId: lease.monitor.id,
          configurationRevision: lease.monitor.revision,
          slotAt: lease.slotAt,
          observedAt,
        });
        await this.store.record(lease, observation, observedAt);
        recorded++;
      } catch {
        failed++;
      }
    }
    return {
      after: ids.length === 20 ? ids[ids.length - 1] : null,
      recorded,
      failed,
    };
  }
}
