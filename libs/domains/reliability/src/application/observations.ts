export const HEALTH_INTERVAL_MS = 300_000;
export const HEALTH_STALE_AFTER_MS = 900_000;
export const HEALTH_HISTORY_DAYS = 30;
export const HEALTH_MAX_MONITORS = 8;
export const HEALTH_MAX_SAMPLES = HEALTH_HISTORY_DAYS * 288 + 1;

export type ObservedHealth = 'operational' | 'degraded' | 'outage' | 'unknown';
export type CurrentHealth = ObservedHealth | 'stale';
export type HealthReason =
  | 'http-success'
  | 'http-slow'
  | 'http-error'
  | 'timeout'
  | 'network-error'
  | 'blocked-target'
  | 'redirect'
  | 'access-denied';

export interface HealthMonitor {
  id: string;
  applicationId: string;
  revision: number;
  name: string;
  url: string;
  enabled: boolean;
}

export interface HealthObservation {
  monitorId: string;
  configurationRevision: number;
  slotAt: number;
  observedAt: number;
  status: ObservedHealth;
  reason: HealthReason;
  httpStatus: number | null;
  durationMs: number | null;
}

export interface HealthDay {
  day: number;
  status: ObservedHealth;
  expected: number;
  measured: number;
  available: number;
  availabilityPercent: number | null;
}

export interface MonitorHealth {
  id: string;
  name: string;
  url: string;
  revision: number;
  status: CurrentHealth;
  latest: HealthObservation | null;
  expected: number;
  measured: number;
  available: number;
  availabilityPercent: number | null;
  history: HealthDay[];
}

export class HealthInputError extends Error {}
export class HealthConflictError extends Error {}
export class HealthUnavailableError extends Error {}
export class HealthNotFoundError extends Error {}

export function healthObject(input: unknown, keys: readonly string[]) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== keys.length ||
    keys.some((key) => !Object.prototype.hasOwnProperty.call(input, key))
  )
    throw new HealthInputError('Invalid health fields');
  return input as Record<string, unknown>;
}
export function healthId(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      input
    )
  )
    throw new HealthInputError('Invalid health identity');
  return input;
}
export function healthInteger(
  input: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < min ||
    input > max
  )
    throw new HealthInputError('Invalid health number');
  return input;
}
export function healthUrl(input: unknown): string {
  if (
    typeof input !== 'string' ||
    input.length > 2048 ||
    input.trim() !== input ||
    [...input].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  )
    throw new HealthInputError('Invalid monitor URL');
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new HealthInputError('Invalid monitor URL');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.search ||
    !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(url.hostname) ||
    !url.hostname.includes('.') ||
    /^[0-9.]+$/.test(url.hostname)
  )
    throw new HealthInputError(
      'A public HTTP(S) hostname without credentials, query, fragment or custom port is required'
    );
  return url.href;
}
export function parseHealthMonitor(input: unknown): HealthMonitor {
  const value = healthObject(input, [
    'id',
    'applicationId',
    'revision',
    'name',
    'url',
    'enabled',
  ]);
  if (
    typeof value['name'] !== 'string' ||
    !value['name'].trim() ||
    value['name'].length > 80 ||
    [...value['name']].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    ) ||
    typeof value['enabled'] !== 'boolean'
  )
    throw new HealthInputError('Invalid monitor');
  return {
    id: healthId(value['id']),
    applicationId: healthId(value['applicationId']),
    revision: healthInteger(value['revision'], 1),
    name: value['name'].trim(),
    url: healthUrl(value['url']),
    enabled: value['enabled'],
  };
}
export function parseHealthObservation(input: unknown): HealthObservation {
  const value = healthObject(input, [
    'monitorId',
    'configurationRevision',
    'slotAt',
    'observedAt',
    'status',
    'reason',
    'httpStatus',
    'durationMs',
  ]);
  const slotAt = healthInteger(value['slotAt']),
    observedAt = healthInteger(value['observedAt']);
  if (
    slotAt % HEALTH_INTERVAL_MS !== 0 ||
    observedAt < slotAt ||
    observedAt >= slotAt + HEALTH_INTERVAL_MS
  )
    throw new HealthInputError(
      'Observation must belong to its measurement slot'
    );
  const status = value['status'],
    reason = value['reason'];
  const expected: Record<HealthReason, ObservedHealth> = {
    'http-success': 'operational',
    'http-slow': 'degraded',
    'http-error': 'outage',
    timeout: 'outage',
    'network-error': 'unknown',
    'blocked-target': 'unknown',
    redirect: 'unknown',
    'access-denied': 'unknown',
  };
  if (
    typeof reason !== 'string' ||
    !Object.prototype.hasOwnProperty.call(expected, reason) ||
    expected[reason as HealthReason] !== status
  )
    throw new HealthInputError(
      'Observation status does not match its evidence'
    );
  const httpStatus =
    value['httpStatus'] === null
      ? null
      : healthInteger(value['httpStatus'], 200, 599);
  const durationMs =
    value['durationMs'] === null
      ? null
      : healthInteger(value['durationMs'], 0, 15_000);
  if (
    (reason.startsWith('http-') ||
      reason === 'redirect' ||
      reason === 'access-denied') !==
      (httpStatus !== null) ||
    (httpStatus !== null && durationMs === null) ||
    (reason === 'timeout' && durationMs !== 10_000) ||
    ((reason === 'network-error' || reason === 'blocked-target') &&
      durationMs !== null) ||
    ((reason === 'http-success' || reason === 'http-slow') &&
      !(httpStatus !== null && httpStatus < 300)) ||
    (reason === 'http-success' && durationMs !== null && durationMs >= 2000) ||
    (reason === 'http-slow' && durationMs !== null && durationMs < 2000) ||
    (reason === 'redirect' &&
      !(httpStatus !== null && httpStatus >= 300 && httpStatus < 400)) ||
    (reason === 'access-denied' && httpStatus !== 401 && httpStatus !== 403) ||
    (reason === 'http-error' &&
      !(
        httpStatus !== null &&
        httpStatus >= 400 &&
        httpStatus !== 401 &&
        httpStatus !== 403
      ))
  )
    throw new HealthInputError('Invalid HTTP observation evidence');
  return {
    monitorId: healthId(value['monitorId']),
    configurationRevision: healthInteger(value['configurationRevision'], 1),
    slotAt,
    observedAt,
    status: status as ObservedHealth,
    reason: reason as HealthReason,
    httpStatus,
    durationMs,
  };
}

const DAY = 86_400_000;
const availability = (available: number, measured: number) =>
  measured ? Math.round((available * 10_000) / measured) / 100 : null;

/** One canonical sample per slot; missing intervals and unknown checks never become uptime. */
export function summarizeMonitor(
  input: HealthMonitor,
  observations: readonly HealthObservation[],
  inputNow: number,
  lastKnown: HealthObservation | null = null
): MonitorHealth {
  const monitor = parseHealthMonitor(input),
    now = healthInteger(inputNow);
  if (!monitor.enabled || observations.length > HEALTH_MAX_SAMPLES)
    throw new HealthInputError('Invalid monitor history');
  const today = Math.floor(now / DAY) * DAY,
    start = today - (HEALTH_HISTORY_DAYS - 1) * DAY;
  const slots = new Set<number>();
  const history: HealthDay[] = Array.from(
    { length: HEALTH_HISTORY_DAYS },
    (_, index) => {
      const day = start + index * DAY;
      return {
        day,
        status: 'unknown',
        expected:
          Math.floor(
            (Math.min(day + DAY - 1, now) - day) / HEALTH_INTERVAL_MS
          ) + 1,
        measured: 0,
        available: 0,
        availabilityPercent: null,
      };
    }
  );
  let latest = lastKnown ? parseHealthObservation(lastKnown) : null;
  if (
    latest &&
    (latest.monitorId !== monitor.id ||
      latest.configurationRevision !== monitor.revision ||
      latest.observedAt > now)
  )
    throw new HealthInputError('Invalid last observation');
  for (const inputObservation of observations) {
    const observation = parseHealthObservation(inputObservation);
    if (
      observation.monitorId !== monitor.id ||
      observation.configurationRevision !== monitor.revision ||
      observation.observedAt > now ||
      observation.slotAt < start ||
      slots.has(observation.slotAt)
    )
      throw new HealthInputError('Inconsistent monitor history');
    slots.add(observation.slotAt);
    if (!latest || observation.slotAt > latest.slotAt) latest = observation;
    else if (
      latest.slotAt === observation.slotAt &&
      JSON.stringify(latest) !== JSON.stringify(observation)
    )
      throw new HealthInputError('Conflicting last observation');
    if (observation.status === 'unknown') continue;
    const day = history[Math.floor((observation.slotAt - start) / DAY)];
    day.measured++;
    if (observation.status !== 'outage') day.available++;
    if (
      observation.status === 'outage' ||
      (observation.status === 'degraded' && day.status !== 'outage')
    )
      day.status = observation.status;
  }
  for (const day of history) {
    if (day.status === 'unknown' && day.measured === day.expected)
      day.status = 'operational';
    day.availabilityPercent = availability(day.available, day.measured);
  }
  const expected = history.reduce((sum, day) => sum + day.expected, 0),
    measured = history.reduce((sum, day) => sum + day.measured, 0),
    available = history.reduce((sum, day) => sum + day.available, 0);
  return {
    id: monitor.id,
    revision: monitor.revision,
    name: monitor.name,
    url: monitor.url,
    status: !latest
      ? 'unknown'
      : latest.observedAt + HEALTH_STALE_AFTER_MS <= now
      ? 'stale'
      : latest.status,
    latest,
    expected,
    measured,
    available,
    availabilityPercent: availability(available, measured),
    history,
  };
}
