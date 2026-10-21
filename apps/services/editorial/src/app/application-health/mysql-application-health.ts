import type { DataSource, EntityManager } from 'typeorm';
import { lockIdentityWrites } from '@wapps/account-mysql';
import {
  HEALTH_INTERVAL_MS,
  HEALTH_MAX_MONITORS,
  HEALTH_MAX_SAMPLES,
  HealthConflictError,
  HealthInputError,
  HealthNotFoundError,
  HealthUnavailableError,
  healthId,
  healthInteger,
  parseHealthMonitor,
  parseHealthObservation,
  type HealthMonitor,
  type HealthObservation,
} from '@domains/reliability';
import type {
  HealthConfiguration,
  HealthStore,
  ProbeLease,
} from './application-health';

type Row = Record<string, unknown>;
const json = (value: unknown): unknown =>
  typeof value === 'string' ? JSON.parse(value) : value;
function monitor(row: Row): HealthMonitor {
  if (![0, 1].includes(Number(row['enabled'])))
    throw new HealthUnavailableError('Invalid monitor state');
  return parseHealthMonitor({
    id: row['id'],
    applicationId: row['applicationId'],
    revision: Number(row['revision']),
    name: row['name'],
    url: row['url'],
    enabled: Number(row['enabled']) === 1,
  });
}
const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

/** Canonical SQL observations need no asynchronously updated status projection. */
export class MysqlApplicationHealth implements HealthStore {
  constructor(
    private readonly source: DataSource,
    private readonly publicTenant: string
  ) {}
  async configurations(applicationId: string) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const application = await this.application(
        manager,
        healthId(applicationId)
      );
      if (!application) throw new HealthNotFoundError('Application not found');
      const rows = await manager.query<Row[]>(
        'SELECT * FROM health_monitors WHERE tenantId=? AND applicationId=? ORDER BY id LIMIT ?',
        [this.publicTenant, applicationId, HEALTH_MAX_MONITORS + 1]
      );
      if (
        rows.length > HEALTH_MAX_MONITORS ||
        typeof application['website'] !== 'string'
      )
        throw new HealthUnavailableError('Invalid health configurations');
      const monitors = rows.map(monitor);
      for (const definition of monitors)
        await this.confirmVersion(manager, definition);
      return {
        applicationRevision: healthInteger(Number(application['revision']), 1),
        website: application['website'],
        monitors,
      };
    });
  }
  async configure(command: HealthConfiguration) {
    const requested = parseHealthMonitor(command.monitor);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      if (command.actor.tenantId !== this.publicTenant)
        throw new HealthNotFoundError('Application not found');
      await lockIdentityWrites(manager, [command.actor.identityId]);
      const application = await this.application(
        manager,
        requested.applicationId,
        true
      );
      if (!application) throw new HealthNotFoundError('Application not found');
      if (
        Number(application['revision']) !== command.expectedApplicationRevision
      )
        throw new HealthConflictError(
          'Application changed; reload its current details'
        );
      this.target(requested, application);
      const [row] = await manager.query<Row[]>(
        'SELECT * FROM health_monitors WHERE id=? FOR UPDATE',
        [requested.id]
      );
      if (
        row &&
        (row['tenantId'] !== this.publicTenant ||
          row['applicationId'] !== requested.applicationId)
      )
        throw new HealthConflictError('Monitor identity is already in use');
      const [version] = await manager.query<Row[]>(
        'SELECT applicationRevision,configuration FROM health_monitor_versions WHERE monitorId=? AND revision=?',
        [requested.id, requested.revision]
      );
      if (version) {
        if (!row)
          throw new HealthUnavailableError(
            'Monitor configuration history is inconsistent'
          );
        await this.confirmVersion(manager, monitor(row));
        if (
          Number(version['applicationRevision']) !==
            command.expectedApplicationRevision ||
          !same(parseHealthMonitor(json(version['configuration'])), requested)
        )
          throw new HealthConflictError(
            'This monitor revision already contains another configuration'
          );
        return requested;
      }
      if (
        (row ? Number(row['revision']) : 0) !== command.expectedRevision ||
        requested.revision !== command.expectedRevision + 1
      )
        throw new HealthConflictError(
          'Monitor changed; reload before updating'
        );
      if (!row) {
        const [{ count }] = await manager.query<{ count: string }[]>(
          'SELECT COUNT(*) AS count FROM health_monitors WHERE tenantId=? AND applicationId=?',
          [this.publicTenant, requested.applicationId]
        );
        if (Number(count) >= HEALTH_MAX_MONITORS)
          throw new HealthConflictError('Application monitor limit reached');
      }
      await manager.query(
        'INSERT INTO health_monitor_versions (monitorId,revision,applicationRevision,configuration) VALUES (?,?,?,?)',
        [
          requested.id,
          requested.revision,
          command.expectedApplicationRevision,
          JSON.stringify(requested),
        ]
      );
      await manager.query(
        `INSERT INTO health_monitors (id,applicationId,tenantId,revision,name,url,enabled) VALUES (?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE revision=VALUES(revision),name=VALUES(name),url=VALUES(url),enabled=VALUES(enabled)`,
        [
          requested.id,
          requested.applicationId,
          this.publicTenant,
          requested.revision,
          requested.name,
          requested.url,
          requested.enabled ? 1 : 0,
        ]
      );
      return requested;
    });
  }
  async read(applicationId: string, now: number) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const application = await this.application(
        manager,
        healthId(applicationId)
      );
      if (!application) throw new HealthNotFoundError('Application not found');
      const rows = await manager.query<Row[]>(
        'SELECT * FROM health_monitors WHERE tenantId=? AND applicationId=? AND enabled=1 ORDER BY id LIMIT ?',
        [this.publicTenant, applicationId, HEALTH_MAX_MONITORS + 1]
      );
      if (rows.length > HEALTH_MAX_MONITORS)
        throw new HealthUnavailableError('Monitor capacity is inconsistent');
      const result: {
        monitor: HealthMonitor;
        observations: HealthObservation[];
        latest: HealthObservation | null;
      }[] = [];
      const start = Math.floor(now / 86_400_000) * 86_400_000 - 29 * 86_400_000;
      for (const row of rows) {
        const definition = monitor(row);
        if (!this.sameOrigin(definition, application)) continue;
        await this.confirmVersion(manager, definition);
        const samples = await manager.query<Row[]>(
          'SELECT slotAt,observation FROM health_observations WHERE monitorId=? AND configurationRevision=? AND slotAt>=? AND observation IS NOT NULL ORDER BY slotAt LIMIT ?',
          [definition.id, definition.revision, start, HEALTH_MAX_SAMPLES + 1]
        );
        if (samples.length > HEALTH_MAX_SAMPLES)
          throw new HealthUnavailableError(
            'Observation history exceeds bounds'
          );
        const [last] = await manager.query<Row[]>(
          'SELECT slotAt,observation FROM health_observations WHERE monitorId=? AND configurationRevision=? AND observation IS NOT NULL ORDER BY slotAt DESC LIMIT 1',
          [definition.id, definition.revision]
        );
        const latest = last
          ? parseHealthObservation(json(last['observation']))
          : null;
        if (latest && latest.slotAt !== Number(last['slotAt']))
          throw new HealthUnavailableError(
            'Last observation slot is inconsistent'
          );
        result.push({
          monitor: definition,
          latest,
          observations: samples.map((row) => {
            const observation = parseHealthObservation(
              json(row['observation'])
            );
            if (observation.slotAt !== Number(row['slotAt']))
              throw new HealthUnavailableError(
                'Observation slot is inconsistent'
              );
            return observation;
          }),
        });
      }
      return result;
    });
  }
  async candidates(after: string | null) {
    const rows = await this.source.query<{ id: string }[]>(
      `SELECT m.id FROM health_monitors m
      JOIN editorial_resource_states e ON e.resourceKind='app' AND e.resourceId=m.applicationId AND e.tenantId=m.tenantId
      JOIN app_records a ON a.id=m.applicationId
      WHERE m.tenantId=? AND m.enabled=1 AND e.deletedAt IS NULL AND a.isSuspended=0 AND m.id>? ORDER BY m.id LIMIT 20`,
      [this.publicTenant, after ?? '']
    );
    return rows.map((row) => healthId(row.id));
  }
  async claim(id: string, leaseId: string, now: number) {
    healthId(id);
    healthId(leaseId);
    healthInteger(now);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      // All mutations lock application before monitor to serialize capacity, lifecycle and configuration.
      const [selected] = await manager.query<Row[]>(
        'SELECT applicationId FROM health_monitors WHERE id=? AND tenantId=?',
        [id, this.publicTenant]
      );
      if (!selected) return null;
      const application = await this.application(
        manager,
        String(selected['applicationId']),
        true
      );
      if (!application) return null;
      const [row] = await manager.query<Row[]>(
        'SELECT * FROM health_monitors WHERE id=? AND tenantId=? FOR UPDATE',
        [id, this.publicTenant]
      );
      if (!row || Number(row['enabled']) !== 1) return null;
      const definition = monitor(row);
      if (!this.sameOrigin(definition, application)) return null;
      await this.confirmVersion(manager, definition);
      const slotAt = Math.floor(now / HEALTH_INTERVAL_MS) * HEALTH_INTERVAL_MS;
      const expiresAt = now + 20_000;
      if (expiresAt >= slotAt + HEALTH_INTERVAL_MS) return null;
      const [job] = await manager.query<Row[]>(
        'SELECT * FROM health_observations WHERE monitorId=? AND configurationRevision=? AND slotAt=? FOR UPDATE',
        [id, definition.revision, slotAt]
      );
      if (
        job &&
        (job['observation'] !== null ||
          Number(job['leaseUntil']) > now ||
          Number(job['attempts']) >= 3)
      )
        return null;
      await manager.query(
        `INSERT INTO health_observations (monitorId,configurationRevision,slotAt,leaseId,leaseUntil,attempts,observation) VALUES (?,?,?,?,?,1,NULL)
        ON DUPLICATE KEY UPDATE leaseId=VALUES(leaseId),leaseUntil=VALUES(leaseUntil),attempts=attempts+1`,
        [id, definition.revision, slotAt, leaseId, expiresAt]
      );
      return { monitor: definition, slotAt, leaseId, expiresAt };
    });
  }
  async record(lease: ProbeLease, input: HealthObservation, now: number) {
    const observation = parseHealthObservation(input);
    if (
      observation.monitorId !== lease.monitor.id ||
      observation.configurationRevision !== lease.monitor.revision ||
      observation.slotAt !== lease.slotAt ||
      observation.observedAt !== now
    )
      throw new HealthInputError('Observation does not match its lease');
    await this.source.transaction('READ COMMITTED', async (manager) => {
      const application = await this.application(
        manager,
        lease.monitor.applicationId,
        true
      );
      if (!application)
        throw new HealthConflictError('Application is no longer public');
      const [row] = await manager.query<Row[]>(
        'SELECT * FROM health_monitors WHERE id=? AND tenantId=? FOR UPDATE',
        [lease.monitor.id, this.publicTenant]
      );
      if (
        !row ||
        !same(monitor(row), lease.monitor) ||
        !lease.monitor.enabled ||
        !this.sameOrigin(lease.monitor, application)
      )
        throw new HealthConflictError(
          'Monitor configuration changed during observation'
        );
      await this.confirmVersion(manager, lease.monitor);
      const [job] = await manager.query<Row[]>(
        'SELECT * FROM health_observations WHERE monitorId=? AND configurationRevision=? AND slotAt=? FOR UPDATE',
        [lease.monitor.id, lease.monitor.revision, lease.slotAt]
      );
      if (!job || job['leaseId'] !== lease.leaseId)
        throw new HealthConflictError('Observation lease was superseded');
      if (job['observation'] !== null) {
        if (
          !same(parseHealthObservation(json(job['observation'])), observation)
        )
          throw new HealthConflictError(
            'Observation already recorded with different evidence'
          );
        return;
      }
      if (
        Number(job['leaseUntil']) <= now ||
        lease.expiresAt !== Number(job['leaseUntil'])
      )
        throw new HealthConflictError('Observation lease expired');
      await manager.query(
        'UPDATE health_observations SET observation=? WHERE monitorId=? AND configurationRevision=? AND slotAt=?',
        [
          JSON.stringify(observation),
          lease.monitor.id,
          lease.monitor.revision,
          lease.slotAt,
        ]
      );
    });
  }
  private async application(
    manager: EntityManager,
    id: string,
    lock = false
  ): Promise<Row | null> {
    const [row] = await manager.query<Row[]>(
      `SELECT a.id,a.website,e.revision FROM editorial_resource_states e JOIN app_records a ON a.id=e.resourceId
      WHERE e.resourceKind='app' AND e.resourceId=? AND e.tenantId=? AND e.deletedAt IS NULL AND a.isSuspended=0${
        lock ? ' FOR UPDATE' : ''
      }`,
      [id, this.publicTenant]
    );
    return row ?? null;
  }
  private sameOrigin(monitor: HealthMonitor, application: Row) {
    try {
      return (
        typeof application['website'] === 'string' &&
        new URL(monitor.url).origin === new URL(application['website']).origin
      );
    } catch {
      return false;
    }
  }
  private target(monitor: HealthMonitor, application: Row) {
    if (!this.sameOrigin(monitor, application))
      throw new HealthInputError(
        'Monitor must use the current approved application website origin'
      );
  }
  private async confirmVersion(
    manager: EntityManager,
    definition: HealthMonitor
  ) {
    const [version] = await manager.query<Row[]>(
      'SELECT configuration FROM health_monitor_versions WHERE monitorId=? AND revision=?',
      [definition.id, definition.revision]
    );
    if (
      !version ||
      !same(parseHealthMonitor(json(version['configuration'])), definition)
    )
      throw new HealthUnavailableError(
        'Monitor configuration history is inconsistent'
      );
  }
}
