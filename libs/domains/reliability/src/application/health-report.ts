import {
  HEALTH_HISTORY_DAYS,
  HEALTH_INTERVAL_MS,
  HEALTH_MAX_MONITORS,
  HEALTH_STALE_AFTER_MS,
  HealthInputError,
  healthId,
  healthInteger,
  healthObject,
  parseHealthMonitor,
  parseHealthObservation,
  type CurrentHealth,
  type HealthDay,
  type MonitorHealth,
} from './observations';

export interface ApplicationHealthReport {
  application: { id: string; slug: string; name: string };
  asOf: number;
  monitors: MonitorHealth[];
}
const ratio = (available: number, measured: number) =>
  measured ? Math.round((available * 10_000) / measured) / 100 : null;
export function overallHealth(
  monitors: readonly Pick<MonitorHealth, 'status'>[]
): CurrentHealth {
  if (!monitors.length) return 'unknown';
  for (const status of ['outage', 'degraded', 'stale', 'unknown'] as const)
    if (monitors.some((monitor) => monitor.status === status)) return status;
  return 'operational';
}
export function parseApplicationHealthReport(
  input: unknown
): ApplicationHealthReport {
  const value = healthObject(input, ['application', 'asOf', 'monitors']);
  const app = healthObject(value['application'], ['id', 'slug', 'name']);
  const application = {
    id: healthId(app['id']),
    slug: app['slug'],
    name: app['name'],
  };
  if (
    typeof application.slug !== 'string' ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(application.slug) ||
    application.slug.length > 80 ||
    typeof application.name !== 'string' ||
    !application.name.trim() ||
    application.name.length > 200
  )
    throw new HealthInputError('Invalid health application');
  const asOf = healthInteger(value['asOf'], 30 * 86_400_000);
  if (
    !Array.isArray(value['monitors']) ||
    value['monitors'].length > HEALTH_MAX_MONITORS
  )
    throw new HealthInputError('Invalid health monitor selection');
  const monitors = value['monitors'].map((inputMonitor) => {
    const row = healthObject(inputMonitor, [
      'id',
      'name',
      'url',
      'revision',
      'status',
      'latest',
      'expected',
      'measured',
      'available',
      'availabilityPercent',
      'history',
    ]);
    const monitor = parseHealthMonitor({
      id: row['id'],
      applicationId: application.id,
      name: row['name'],
      url: row['url'],
      revision: row['revision'],
      enabled: true,
    });
    const latest =
      row['latest'] === null ? null : parseHealthObservation(row['latest']);
    if (
      latest &&
      (latest.monitorId !== monitor.id ||
        latest.configurationRevision !== monitor.revision ||
        latest.observedAt > asOf)
    )
      throw new HealthInputError('Invalid latest health observation');
    const status: CurrentHealth = !latest
      ? 'unknown'
      : latest.observedAt + HEALTH_STALE_AFTER_MS <= asOf
      ? 'stale'
      : latest.status;
    if (
      row['status'] !== status ||
      !Array.isArray(row['history']) ||
      row['history'].length !== HEALTH_HISTORY_DAYS
    )
      throw new HealthInputError('Invalid current health state');
    const start = Math.floor(asOf / 86_400_000) * 86_400_000 - 29 * 86_400_000;
    const history = row['history'].map((inputDay, index): HealthDay => {
      const data = healthObject(inputDay, [
        'day',
        'status',
        'expected',
        'measured',
        'available',
        'availabilityPercent',
      ]);
      const day = start + index * 86_400_000,
        expected =
          Math.floor(
            (Math.min(day + 86_400_000 - 1, asOf) - day) / HEALTH_INTERVAL_MS
          ) + 1;
      const measured = healthInteger(data['measured'], 0, expected),
        available = healthInteger(data['available'], 0, measured);
      const dayStatus = data['status'];
      if (
        data['day'] !== day ||
        data['expected'] !== expected ||
        data['availabilityPercent'] !== ratio(available, measured) ||
        !['operational', 'degraded', 'outage', 'unknown'].includes(
          String(dayStatus)
        ) ||
        (!measured && dayStatus !== 'unknown') ||
        (dayStatus === 'operational' &&
          (measured !== expected || available !== measured)) ||
        (dayStatus === 'outage' && available === measured) ||
        (available < measured && dayStatus !== 'outage')
      )
        throw new HealthInputError('Invalid daily health evidence');
      return {
        day,
        status: dayStatus as HealthDay['status'],
        expected,
        measured,
        available,
        availabilityPercent: ratio(available, measured),
      };
    });
    const expected = history.reduce((sum, day) => sum + day.expected, 0),
      measured = history.reduce((sum, day) => sum + day.measured, 0),
      available = history.reduce((sum, day) => sum + day.available, 0);
    if (
      (!latest && measured > 0) ||
      (latest && latest.slotAt < start && measured > 0)
    )
      throw new HealthInputError('Missing latest observation evidence');
    if (latest && latest.slotAt >= start && latest.status !== 'unknown') {
      const day = history[Math.floor((latest.slotAt - start) / 86_400_000)];
      if (
        !day.measured ||
        (latest.status !== 'outage' && !day.available) ||
        (latest.status === 'outage' && day.status !== 'outage') ||
        (latest.status === 'degraded' &&
          !['degraded', 'outage'].includes(day.status))
      )
        throw new HealthInputError(
          'Latest observation contradicts daily evidence'
        );
    }
    if (
      row['expected'] !== expected ||
      row['measured'] !== measured ||
      row['available'] !== available ||
      row['availabilityPercent'] !== ratio(available, measured)
    )
      throw new HealthInputError('Invalid health totals');
    return {
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      revision: monitor.revision,
      status,
      latest,
      expected,
      measured,
      available,
      availabilityPercent: ratio(available, measured),
      history,
    };
  });
  if (new Set(monitors.map((monitor) => monitor.id)).size !== monitors.length)
    throw new HealthInputError('Duplicate health monitor');
  return {
    application: {
      id: application.id,
      name: application.name,
      slug: application.slug,
    },
    asOf,
    monitors,
  };
}
